use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::Manager;
use tauri_plugin_fs::FsExt;

#[derive(Serialize)]
struct NoteSummary {
    path: String,
    title: String,
    /// Last modification time, in milliseconds since the Unix epoch (0 if unknown).
    modified: u64,
}

fn modified_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

/// A top-level folder name: no separators, no `..`, no hidden names.
fn validate_folder_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name.contains("..")
        || name.starts_with('.')
        || name.contains('\0')
    {
        return Err("invalid folder name".into());
    }
    Ok(name.to_string())
}

/// Replace the first H1 line of a note, or prepend one if the note has none.
fn set_title(text: &str, title: &str) -> String {
    let mut out = String::with_capacity(text.len() + title.len() + 4);
    let mut replaced = false;
    for line in text.split_inclusive('\n') {
        if !replaced && !line.trim().is_empty() {
            replaced = true;
            if line.trim_start().starts_with("# ") {
                let ending = if line.ends_with("\r\n") {
                    "\r\n"
                } else if line.ends_with('\n') {
                    "\n"
                } else {
                    ""
                };
                out.push_str(&format!("# {title}{ending}"));
                continue;
            }
            out.push_str(&format!("# {title}\n\n"));
        }
        out.push_str(line);
    }
    if !replaced {
        out.push_str(&format!("# {title}\n"));
    }
    out
}

/// Active wiki. Empty until the interface calls `set_workspace`.
static ACTIVE_ROOT: Mutex<Option<PathBuf>> = Mutex::new(None);

fn default_workspace_icon() -> String {
    "logo".to_string()
}

#[derive(Serialize, serde::Deserialize)]
struct WorkspaceMeta {
    name: String,
    #[serde(default = "default_workspace_icon")]
    icon: String,
    #[serde(default)]
    image: String,
}

#[derive(Serialize)]
struct WorkspaceInfo {
    name: String,
    path: String,
    icon: String,
    /// Absolute path of a custom image, or empty when the environment uses an icon.
    image: String,
}

/// Checkout folder when this binary was built on a machine where the repo is still present.
/// A GitHub build embeds `/Users/runner/work/...`, which does not exist after installation.
fn project_folder(name: &str) -> Option<PathBuf> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join(name);
    path.parent()?.is_dir().then_some(path)
}

fn data_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "dossier personnel introuvable".to_string())?;
    let dir = if cfg!(target_os = "macos") {
        PathBuf::from(home).join("Library/Application Support/Scribbly")
    } else if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(home).join("AppData/Roaming"))
            .join("Scribbly")
    } else {
        PathBuf::from(home).join(".local/share/scribbly")
    };
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    dir.canonicalize().map_err(|err| err.to_string())
}

fn default_notes_root() -> Result<PathBuf, String> {
    let root = match project_folder("notes") {
        Some(path) if path.is_dir() => path,
        _ => {
            let path = data_dir()?.join("notes");
            fs::create_dir_all(&path).map_err(|err| err.to_string())?;
            path
        }
    };
    root.canonicalize().map_err(|err| err.to_string())
}

fn workspaces_dir() -> Result<PathBuf, String> {
    let dir = match project_folder("workspaces") {
        Some(path) => path,
        None => data_dir()?.join("workspaces"),
    };
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    dir.canonicalize().map_err(|err| err.to_string())
}

const WORKSPACE_ICONS: &[&str] = &["logo", "book", "briefcase", "folder", "pen", "star"];
const MAX_WORKSPACE_IMAGE: usize = 512 * 1024;

fn read_workspace_meta(dir: &Path, fallback: &str) -> WorkspaceMeta {
    let meta_path = dir.join(".scribbly.json");
    if let Ok(text) = fs::read_to_string(meta_path) {
        if let Ok(mut meta) = serde_json::from_str::<WorkspaceMeta>(&text) {
            let name = meta.name.trim();
            if !name.is_empty() {
                meta.name = name.to_string();
                if !WORKSPACE_ICONS.contains(&meta.icon.as_str()) {
                    meta.icon = default_workspace_icon();
                }
                return meta;
            }
        }
    }
    WorkspaceMeta {
        name: fallback.to_string(),
        icon: default_workspace_icon(),
        image: String::new(),
    }
}

fn workspace_image_path(dir: &Path, filename: &str) -> String {
    if filename.is_empty()
        || filename.contains('/')
        || filename.contains('\\')
        || filename.contains("..")
    {
        return String::new();
    }
    let path = dir.join(".scribbly").join(filename);
    if path.is_file() {
        path.to_string_lossy().into_owned()
    } else {
        String::new()
    }
}

fn write_workspace_meta(dir: &Path, meta: &WorkspaceMeta) -> Result<(), String> {
    let text = serde_json::to_string(meta).map_err(|err| err.to_string())?;
    fs::write(dir.join(".scribbly.json"), text).map_err(|err| err.to_string())
}

fn image_extension(ext: &str) -> Result<&'static str, String> {
    match ext.to_ascii_lowercase().as_str() {
        "png" => Ok("png"),
        "jpg" | "jpeg" => Ok("jpg"),
        "webp" => Ok("webp"),
        "gif" => Ok("gif"),
        "svg" => Ok("svg"),
        _ => Err("format d'image invalide".into()),
    }
}

fn notes_root() -> Result<PathBuf, String> {
    let active = ACTIVE_ROOT.lock().map_err(|err| err.to_string())?;
    if let Some(path) = active.as_ref() {
        if path.is_dir() {
            return Ok(path.clone());
        }
    }
    default_notes_root()
}

/// The built-in notes folder, or a directory created under `workspaces/`.
fn resolve_workspace(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    if !path.is_dir() {
        return Err("environnement introuvable".into());
    }
    let path = path.canonicalize().map_err(|err| err.to_string())?;
    if path == default_notes_root()? {
        return Ok(path);
    }
    let parent = workspaces_dir()?;
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    if path.parent() == Some(parent.as_path()) && !name.is_empty() && !name.starts_with('.') {
        return Ok(path);
    }
    Err("environnement invalide".into())
}

fn workspace_info(dir: &Path, fallback: &str) -> WorkspaceInfo {
    let meta = read_workspace_meta(dir, fallback);
    let image = workspace_image_path(dir, &meta.image);
    WorkspaceInfo {
        name: meta.name,
        path: dir.to_string_lossy().into_owned(),
        icon: meta.icon,
        image,
    }
}

#[tauri::command]
fn list_workspaces() -> Result<Vec<WorkspaceInfo>, String> {
    let notes = default_notes_root()?;
    let mut workspaces = vec![workspace_info(&notes, "Notes")];
    let parent = workspaces_dir()?;
    let mut extra = Vec::new();
    for entry in fs::read_dir(&parent).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || !entry.path().is_dir() {
            continue;
        }
        let dir = entry.path().canonicalize().map_err(|err| err.to_string())?;
        extra.push(workspace_info(&dir, &name));
    }
    extra.sort_by(|left, right| left.name.cmp(&right.name));
    workspaces.append(&mut extra);
    Ok(workspaces)
}

#[tauri::command]
fn set_workspace(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let path = resolve_workspace(&path)?;
    app.fs_scope()
        .allow_directory(&path, true)
        .map_err(|err| err.to_string())?;
    *ACTIVE_ROOT.lock().map_err(|err| err.to_string())? = Some(path);
    Ok(())
}

#[tauri::command]
fn create_workspace(name: String) -> Result<WorkspaceInfo, String> {
    let display = name.trim();
    if display.is_empty() || display.chars().any(|ch| ch.is_control()) {
        return Err("nom invalide".into());
    }
    let folder = slug(display)?;
    let parent = workspaces_dir()?;
    let dir = parent.join(&folder);
    if dir.exists() {
        return Err("un environnement porte déjà ce nom".into());
    }
    fs::create_dir(&dir).map_err(|err| err.to_string())?;
    if let Err(err) = write_workspace_meta(
        &dir,
        &WorkspaceMeta {
            name: display.to_string(),
            icon: default_workspace_icon(),
            image: String::new(),
        },
    ) {
        let _ = fs::remove_dir(&dir);
        return Err(err.to_string());
    }
    let dir = dir.canonicalize().map_err(|err| err.to_string())?;
    if dir.parent() != Some(parent.as_path()) {
        let _ = fs::remove_dir_all(&dir);
        return Err("environnement invalide".into());
    }
    Ok(workspace_info(&dir, display))
}

#[tauri::command]
fn update_workspace(
    path: String,
    name: String,
    icon: String,
    image: Option<Vec<u8>>,
    image_ext: Option<String>,
    clear_image: bool,
) -> Result<WorkspaceInfo, String> {
    let dir = resolve_workspace(&path)?;
    let display = name.trim();
    if display.is_empty() || display.chars().any(|ch| ch.is_control()) {
        return Err("nom invalide".into());
    }
    let icon = icon.trim();
    if !WORKSPACE_ICONS.contains(&icon) {
        return Err("icône invalide".into());
    }
    let mut meta = read_workspace_meta(&dir, display);
    meta.name = display.to_string();
    meta.icon = icon.to_string();

    let store = dir.join(".scribbly");
    if let Some(bytes) = image {
        if bytes.len() > MAX_WORKSPACE_IMAGE {
            return Err("image trop lourde".into());
        }
        let ext = image_extension(image_ext.as_deref().unwrap_or(""))?;
        fs::create_dir_all(&store).map_err(|err| err.to_string())?;
        clear_workspace_images(&store)?;
        let filename = format!("icon.{ext}");
        fs::write(store.join(&filename), bytes).map_err(|err| err.to_string())?;
        meta.image = filename;
    } else if clear_image {
        clear_workspace_images(&store)?;
        meta.image.clear();
    }

    write_workspace_meta(&dir, &meta)?;
    Ok(workspace_info(&dir, display))
}

fn clear_workspace_images(store: &Path) -> Result<(), String> {
    if !store.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(store).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with("icon.") && entry.path().is_file() {
            fs::remove_file(entry.path()).map_err(|err| err.to_string())?;
        }
    }
    Ok(())
}

fn is_markdown(path: &Path) -> bool {
    path.extension().and_then(|ext| ext.to_str()) == Some("md")
}

fn title_of(path: &Path, filename: &str) -> String {
    let fallback = Path::new(filename)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(filename)
        .to_string();
    let Ok(text) = fs::read_to_string(path) else {
        return fallback;
    };
    let Some(first) = text.lines().find(|line| !line.trim().is_empty()) else {
        return fallback;
    };
    match first.trim().strip_prefix("# ") {
        Some(title) if !title.trim().is_empty() => title.trim().to_string(),
        _ => fallback,
    }
}

fn relative_note_path(root: &Path, path: &Path) -> Result<String, String> {
    let rel = path.strip_prefix(root).map_err(|err| err.to_string())?;
    Ok(rel.to_string_lossy().replace('\\', "/"))
}

fn path_is_rejected(path: &str) -> bool {
    path.is_empty()
        || path.starts_with('/')
        || path.starts_with('\\')
        || Path::new(path).is_absolute()
        || path.split(['/', '\\']).any(|part| part == "..")
}

fn resolve_existing_note(path: &str) -> Result<PathBuf, String> {
    if path_is_rejected(path) {
        return Err("invalid note path".into());
    }

    let root = notes_root()?;
    let full = root.join(path);
    if !full.is_file() {
        return Err("note not found".into());
    }
    let full = full.canonicalize().map_err(|err| err.to_string())?;
    if !full.starts_with(&root) || !is_markdown(&full) {
        return Err("invalid note path".into());
    }
    Ok(full)
}

fn slug(title: &str) -> Result<String, String> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err("empty title".into());
    }
    let mut slug = String::new();
    let mut prev_dash = false;
    for ch in trimmed.chars() {
        if ch.is_alphanumeric() {
            for lower in ch.to_lowercase() {
                slug.push(lower);
            }
            prev_dash = false;
        } else if !prev_dash && !slug.is_empty() {
            slug.push('-');
            prev_dash = true;
        }
    }
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() || slug.contains("..") {
        return Err("invalid title".into());
    }
    Ok(slug)
}

fn folder_path_ok(folder: &str) -> bool {
    !folder.is_empty()
        && !path_is_rejected(folder)
        && !folder
            .split(['/', '\\'])
            .any(|part| part.is_empty() || part.starts_with('.') || part == "assets")
}

fn chapter_dir(folder: &str) -> Result<PathBuf, String> {
    let root = notes_root()?;
    let folder = folder.trim();
    if folder.is_empty() {
        return Ok(root);
    }
    if !folder_path_ok(folder) {
        return Err("dossier invalide".into());
    }
    let dir = root.join(folder);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    }
    if !dir.is_dir() {
        return Err("dossier invalide".into());
    }
    let dir = dir.canonicalize().map_err(|err| err.to_string())?;
    if !dir.starts_with(&root) || dir == root {
        return Err("dossier invalide".into());
    }
    Ok(dir)
}

fn collect_notes(root: &Path, dir: &Path, depth: usize, out: &mut Vec<NoteSummary>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|err| err.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            if name != "assets" && depth < 32 {
                collect_notes(root, &path, depth + 1, out)?;
            }
            continue;
        }
        if is_markdown(&path) {
            out.push(NoteSummary {
                path: relative_note_path(root, &path)?,
                title: title_of(&path, &name),
                modified: modified_ms(&path),
            });
        }
    }
    Ok(())
}

#[tauri::command]
fn list_notes() -> Result<Vec<NoteSummary>, String> {
    let root = notes_root()?;
    let mut notes = Vec::new();
    collect_notes(&root, &root, 0, &mut notes)?;
    notes.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(notes)
}

#[derive(Serialize)]
struct MediaFile {
    name: String,
    path: String,
    modified: u64,
    image: bool,
}

fn is_image_name(name: &str) -> bool {
    let extension = name.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    matches!(
        extension.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg"
    )
}

#[tauri::command]
fn list_media() -> Result<Vec<MediaFile>, String> {
    let root = notes_root()?;
    let dir = root.join("assets");
    if !dir.is_dir() {
        return Ok(Vec::new());
    }
    let mut files = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || !entry.path().is_file() {
            continue;
        }
        files.push(MediaFile {
            path: format!("assets/{name}"),
            image: is_image_name(&name),
            modified: modified_ms(&entry.path()),
            name,
        });
    }
    files.sort_by(|left, right| right.modified.cmp(&left.modified).then(left.name.cmp(&right.name)));
    Ok(files)
}

fn media_name_ok(name: &str) -> bool {
    !name.is_empty()
        && !name.starts_with('.')
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains('\0')
        && name != "."
        && name != ".."
        && !name.chars().any(|ch| ch.is_control())
}

fn resolve_asset_file(path: &str) -> Result<(PathBuf, String), String> {
    let path = path.trim().replace('\\', "/");
    let Some(name) = path.strip_prefix("assets/") else {
        return Err("fichier invalide".into());
    };
    if name.contains('/') || !media_name_ok(name) {
        return Err("fichier invalide".into());
    }
    let root = notes_root()?;
    let assets = root.join("assets");
    let full = assets.join(name);
    if !full.is_file() {
        return Err("fichier introuvable".into());
    }
    let full = full.canonicalize().map_err(|err| err.to_string())?;
    let assets = assets.canonicalize().map_err(|err| err.to_string())?;
    if full.parent() != Some(assets.as_path()) {
        return Err("fichier invalide".into());
    }
    Ok((full, name.to_string()))
}

fn normalized_media_name(requested: &str, current: &str) -> Result<String, String> {
    let requested = requested.trim();
    if !media_name_ok(requested) {
        return Err("nom invalide".into());
    }
    let current_ext = current.rsplit_once('.').map(|(_, ext)| ext).unwrap_or("");
    let name = if requested.contains('.') {
        requested.to_string()
    } else if current_ext.is_empty() {
        requested.to_string()
    } else {
        format!("{requested}.{current_ext}")
    };
    if !media_name_ok(&name) {
        return Err("nom invalide".into());
    }
    Ok(name)
}

#[derive(Serialize)]
struct MediaChange {
    path: String,
    notes: Vec<String>,
}

fn path_byte(text: &str, index: usize) -> Option<u8> {
    text.as_bytes().get(index).copied()
}

fn is_path_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-' || byte == b'.'
}

fn replace_asset_token(text: &str, from_name: &str, to_name: &str) -> String {
    let from = format!("assets/{from_name}");
    let to = format!("assets/{to_name}");
    let mut out = String::new();
    let mut rest = text;
    while let Some(index) = rest.find(&from) {
        let after = index + from.len();
        let before_ok = index == 0 || path_byte(rest, index - 1).is_none_or(|byte| !is_path_byte(byte));
        let after_ok = after >= rest.len() || path_byte(rest, after).is_none_or(|byte| !is_path_byte(byte));
        if before_ok && after_ok {
            out.push_str(&rest[..index]);
            out.push_str(&to);
            rest = &rest[after..];
        } else {
            out.push_str(&rest[..index + 1]);
            rest = &rest[index + 1..];
        }
    }
    out.push_str(rest);
    out
}

fn drop_asset_mentions(text: &str, name: &str) -> String {
    let token = format!("assets/{name}");
    let mut out = String::new();
    let mut rest = text;
    while let Some(index) = rest.find(&token) {
        let after = index + token.len();
        let before_ok = index == 0 || path_byte(rest, index - 1).is_none_or(|byte| !is_path_byte(byte));
        let after_ok = after >= rest.len() || path_byte(rest, after).is_none_or(|byte| !is_path_byte(byte));
        if !before_ok || !after_ok {
            out.push_str(&rest[..index + 1]);
            rest = &rest[index + 1..];
            continue;
        }
        let prefix = &rest[..index];
        if let Some(start) = link_start(prefix) {
            if let Some(end) = link_end(&rest[after..]) {
                out.push_str(&rest[..start]);
                rest = &rest[after + end..];
                continue;
            }
        }
        out.push_str(prefix);
        rest = &rest[after..];
    }
    out.push_str(rest);
    out
}

fn link_start(prefix: &str) -> Option<usize> {
    let marker = prefix.rfind("](")?;
    let gap = &prefix[marker + 2..];
    if !gap.chars().all(|ch| ch == '.' || ch == '/') {
        return None;
    }
    let head = &prefix[..marker];
    if let Some(start) = head.rfind("![") {
        let alt = &head[start + 2..];
        if !alt.contains('\n') {
            return Some(start);
        }
    }
    let start = head.rfind('[')?;
    let label = &head[start + 1..];
    if label.contains('\n') {
        return None;
    }
    Some(start)
}

fn link_end(suffix: &str) -> Option<usize> {
    let skipped = suffix.len() - suffix.trim_start().len();
    let rest = suffix.trim_start();
    if let Some(stripped) = rest.strip_prefix(')') {
        return Some(skipped + rest.len() - stripped.len());
    }
    let quoted = rest.strip_prefix('"')?;
    let end = quoted.find('"')?;
    let after = quoted[end + 1..].trim_start();
    if !after.starts_with(')') {
        return None;
    }
    let consumed = rest.len() - after.len() + 1;
    Some(skipped + consumed)
}

fn rewrite_media_dir(
    root: &Path,
    dir: &Path,
    from_name: &str,
    to_name: Option<&str>,
    changed: &mut Vec<String>,
    depth: usize,
) -> Result<(), String> {
    if depth >= 32 {
        return Ok(());
    }
    for entry in fs::read_dir(dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "assets" {
            continue;
        }
        let path = entry.path();
        if path.is_dir() {
            rewrite_media_dir(root, &path, from_name, to_name, changed, depth + 1)?;
            continue;
        }
        if !is_markdown(&path) {
            continue;
        }
        let text = fs::read_to_string(&path).map_err(|err| err.to_string())?;
        let next = match to_name {
            Some(next_name) => replace_asset_token(&text, from_name, next_name),
            None => drop_asset_mentions(&text, from_name),
        };
        if next == text {
            continue;
        }
        fs::write(&path, next).map_err(|err| err.to_string())?;
        changed.push(relative_note_path(root, &path)?);
    }
    Ok(())
}

fn rewrite_media_mentions(from_name: &str, to_name: Option<&str>) -> Result<Vec<String>, String> {
    let root = notes_root()?;
    let mut changed = Vec::new();
    rewrite_media_dir(&root, &root, from_name, to_name, &mut changed, 0)?;
    Ok(changed)
}

#[tauri::command]
fn rename_media(path: String, name: String) -> Result<MediaChange, String> {
    let (full, current) = resolve_asset_file(&path)?;
    let next_name = normalized_media_name(&name, &current)?;
    let root = notes_root()?;
    let target = root.join("assets").join(&next_name);
    if next_name != current {
        if target.exists() {
            return Err("un fichier porte déjà ce nom".into());
        }
        fs::rename(&full, &target).map_err(|err| err.to_string())?;
    }
    let notes = rewrite_media_mentions(&current, Some(&next_name))?;
    Ok(MediaChange {
        path: format!("assets/{next_name}"),
        notes,
    })
}

#[tauri::command]
fn delete_media(path: String) -> Result<Vec<String>, String> {
    let (full, name) = resolve_asset_file(&path)?;
    fs::remove_file(&full).map_err(|err| err.to_string())?;
    rewrite_media_mentions(&name, None)
}

#[tauri::command]
fn notes_directory() -> Result<String, String> {
    Ok(notes_root()?.to_string_lossy().into_owned())
}

#[tauri::command]
fn read_note(path: String) -> Result<String, String> {
    let full = resolve_existing_note(&path)?;
    fs::read_to_string(full).map_err(|err| err.to_string())
}

#[tauri::command]
fn create_note(folder: String, title: String) -> Result<String, String> {
    let stem = slug(&title)?;
    let dir = chapter_dir(folder.trim())?;
    let root = notes_root()?;
    let mut filename = format!("{stem}.md");
    let mut suffix = 2u32;
    while dir.join(&filename).exists() {
        filename = format!("{stem}-{suffix}.md");
        suffix += 1;
    }
    let full = dir.join(&filename);
    if !full.starts_with(&root) {
        return Err("invalid note path".into());
    }
    let body = format!("# {}\n", title.trim());
    fs::write(&full, body).map_err(|err| err.to_string())?;
    relative_note_path(&root, &full)
}

#[tauri::command]
fn update_note(path: String, markdown: String) -> Result<(), String> {
    let full = resolve_existing_note(&path)?;
    fs::write(full, markdown).map_err(|err| err.to_string())
}

fn collect_folders(root: &Path, dir: &Path, depth: usize, out: &mut Vec<String>) -> Result<(), String> {
    if depth >= 32 {
        return Ok(());
    }
    for entry in fs::read_dir(dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "assets" || !entry.path().is_dir() {
            continue;
        }
        out.push(relative_note_path(root, &entry.path())?);
        collect_folders(root, &entry.path(), depth + 1, out)?;
    }
    Ok(())
}

#[tauri::command]
fn list_folders() -> Result<Vec<String>, String> {
    let root = notes_root()?;
    let mut folders = Vec::new();
    collect_folders(&root, &root, 0, &mut folders)?;
    folders.sort();
    Ok(folders)
}

#[tauri::command]
fn create_folder(parent: String, name: String) -> Result<String, String> {
    let name = validate_folder_name(&name)?;
    let root = notes_root()?;
    let dir = destination_dir(parent.trim())?;
    let target = dir.join(&name);
    if target.exists() {
        return Err("un dossier porte déjà ce nom".into());
    }
    fs::create_dir(&target).map_err(|err| err.to_string())?;
    let target = target.canonicalize().map_err(|err| err.to_string())?;
    if !target.starts_with(&root) || target.parent() != Some(dir.as_path()) {
        let _ = fs::remove_dir(&target);
        return Err("dossier invalide".into());
    }
    relative_note_path(&root, &target)
}

#[tauri::command]
fn rename_note(path: String, title: String) -> Result<String, String> {
    let full = resolve_existing_note(&path)?;
    let root = notes_root()?;
    let title = title.trim().to_string();
    let stem = slug(&title)?;
    let dir = full.parent().ok_or("invalid note path")?.to_path_buf();
    let mut target = dir.join(format!("{stem}.md"));
    let mut suffix = 2u32;
    while target != full && target.exists() {
        target = dir.join(format!("{stem}-{suffix}.md"));
        suffix += 1;
    }
    if !target.starts_with(&root) || !is_markdown(&target) {
        return Err("invalid note path".into());
    }
    let text = fs::read_to_string(&full).map_err(|err| err.to_string())?;
    fs::write(&full, set_title(&text, &title)).map_err(|err| err.to_string())?;
    if target != full {
        fs::rename(&full, &target).map_err(|err| err.to_string())?;
    }
    relative_note_path(&root, &target)
}

fn destination_dir(folder: &str) -> Result<PathBuf, String> {
    let root = notes_root()?;
    let folder = folder.trim();
    if folder.is_empty() {
        return Ok(root);
    }
    if !folder_path_ok(folder) {
        return Err("dossier invalide".into());
    }
    let dir = root.join(folder);
    if !dir.is_dir() {
        return Err("dossier introuvable".into());
    }
    let dir = dir.canonicalize().map_err(|err| err.to_string())?;
    if !dir.starts_with(&root) {
        return Err("dossier invalide".into());
    }
    Ok(dir)
}

#[tauri::command]
fn move_note(path: String, folder: String) -> Result<String, String> {
    let full = resolve_existing_note(&path)?;
    let root = notes_root()?;
    let dir = destination_dir(&folder)?;
    let current_dir = full.parent().ok_or("invalid note path")?;
    if current_dir == dir {
        return relative_note_path(&root, &full);
    }
    let filename = full
        .file_name()
        .ok_or("invalid note path")?
        .to_os_string();
    let stem = full
        .file_stem()
        .ok_or("invalid note path")?
        .to_string_lossy()
        .to_string();
    let mut target = dir.join(&filename);
    let mut suffix = 2u32;
    while target.exists() {
        target = dir.join(format!("{stem}-{suffix}.md"));
        suffix += 1;
    }
    if !target.starts_with(&root) || !is_markdown(&target) {
        return Err("invalid note path".into());
    }
    fs::rename(&full, &target).map_err(|err| err.to_string())?;
    relative_note_path(&root, &target)
}

fn path_is_inside(path: &Path, parent: &Path) -> bool {
    path == parent || path.starts_with(parent)
}

#[tauri::command]
fn move_folder(path: String, folder: String) -> Result<String, String> {
    let root = notes_root()?;
    let source = destination_dir(&path)?;
    if source == root {
        return Err("dossier invalide".into());
    }
    let dest = destination_dir(folder.trim())?;
    if path_is_inside(&dest, &source) {
        return Err("impossible de déplacer un dossier dans lui-même".into());
    }
    let stem = source
        .file_name()
        .ok_or("dossier invalide")?
        .to_string_lossy()
        .to_string();
    let mut target = dest.join(&stem);
    let mut suffix = 2u32;
    while target.exists() {
        target = dest.join(format!("{stem}-{suffix}"));
        suffix += 1;
    }
    if !target.starts_with(&root) {
        return Err("dossier invalide".into());
    }
    fs::rename(&source, &target).map_err(|err| err.to_string())?;
    relative_note_path(&root, &target)
}

fn trash_note_file(root: &Path, full: &Path) -> Result<(), String> {
    let rel = relative_note_path(root, full)?;
    let trash = trash_dir(root);
    fs::create_dir_all(&trash).map_err(|err| err.to_string())?;
    let flat = rel.replace(['/', '\\'], "__");
    let mut stamp = now_ms();
    let mut target = trash.join(format!("{stamp}-{flat}"));
    while target.exists() {
        stamp += 1;
        target = trash.join(format!("{stamp}-{flat}"));
    }
    if !target.starts_with(root) {
        return Err("invalid note path".into());
    }
    fs::rename(full, target).map_err(|err| err.to_string())
}

fn trash_notes_under(root: &Path, dir: &Path) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        if path.is_dir() {
            if name != "assets" {
                trash_notes_under(root, &path)?;
            }
            continue;
        }
        if is_markdown(&path) {
            trash_note_file(root, &path)?;
        }
    }
    Ok(())
}

#[tauri::command]
fn delete_folder(path: String) -> Result<(), String> {
    let root = notes_root()?;
    let dir = destination_dir(&path)?;
    if dir == root {
        return Err("dossier invalide".into());
    }
    trash_notes_under(&root, &dir)?;
    fs::remove_dir_all(&dir).map_err(|err| err.to_string())
}

fn valid_order_parent(parent: &str) -> bool {
    parent.is_empty()
        || (!path_is_rejected(parent)
            && !parent
                .split(['/', '\\'])
                .any(|part| part.is_empty() || part.starts_with('.')))
}

fn valid_order_id(id: &str) -> bool {
    let Some((kind, path)) = id.split_once(':') else {
        return false;
    };
    if kind != "note" && kind != "folder" {
        return false;
    }
    !path_is_rejected(path)
        && !path
            .split(['/', '\\'])
            .any(|part| part.is_empty() || part.starts_with('.'))
}

fn sanitize_order(order: HashMap<String, Vec<String>>) -> HashMap<String, Vec<String>> {
    order
        .into_iter()
        .filter(|(parent, _)| valid_order_parent(parent))
        .map(|(parent, ids)| {
            let ids = ids.into_iter().filter(|id| valid_order_id(id)).collect();
            (parent, ids)
        })
        .collect()
}

#[tauri::command]
fn read_sidebar_order() -> Result<HashMap<String, Vec<String>>, String> {
    let path = notes_root()?.join(".scribbly-order.json");
    if !path.is_file() {
        return Ok(HashMap::new());
    }
    let text = fs::read_to_string(path).map_err(|err| err.to_string())?;
    let raw = serde_json::from_str(text.as_str()).map_err(|err| err.to_string())?;
    Ok(sanitize_order(raw))
}

#[tauri::command]
fn write_sidebar_order(order: HashMap<String, Vec<String>>) -> Result<(), String> {
    let text = serde_json::to_string(&sanitize_order(order)).map_err(|err| err.to_string())?;
    fs::write(notes_root()?.join(".scribbly-order.json"), text).map_err(|err| err.to_string())
}

#[derive(Serialize)]
struct TrashedNote {
    /// File name inside `notes/.trash`.
    name: String,
    title: String,
    /// Where the note will go back to, relative to the wiki root.
    origin: String,
    /// Deletion time, in milliseconds since the Unix epoch.
    deleted: u64,
}

fn trash_dir(root: &Path) -> PathBuf {
    root.join(".trash")
}

fn trash_entry(root: &Path, name: &str) -> Result<PathBuf, String> {
    if name.is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name.contains("..")
        || name.starts_with('.')
        || name.contains('\0')
    {
        return Err("invalid trash entry".into());
    }
    let trash = trash_dir(root);
    let full = trash.join(name);
    if !full.is_file() || !is_markdown(&full) {
        return Err("note not found".into());
    }
    let full = full.canonicalize().map_err(|err| err.to_string())?;
    let trash = trash.canonicalize().map_err(|err| err.to_string())?;
    if full.parent() != Some(trash.as_path()) {
        return Err("invalid trash entry".into());
    }
    Ok(full)
}

fn original_relative(name: &str) -> Result<String, String> {
    let (_, rest) = name.split_once('-').ok_or("invalid trash entry")?;
    let path = rest.replace("__", "/");
    if path_is_rejected(&path)
        || !path.to_ascii_lowercase().ends_with(".md")
        || path.split('/').any(|part| part.is_empty() || part.starts_with('.'))
    {
        return Err("invalid trash entry".into());
    }
    Ok(path)
}

fn deleted_ms(name: &str) -> Option<u64> {
    name.split_once('-')?.0.parse().ok()
}

#[tauri::command]
fn list_trash() -> Result<Vec<TrashedNote>, String> {
    let root = notes_root()?;
    let trash = trash_dir(&root);
    if !trash.is_dir() {
        return Ok(Vec::new());
    }
    let mut items = Vec::new();
    for entry in fs::read_dir(&trash).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path();
        if name.starts_with('.') || !path.is_file() || !is_markdown(&path) {
            continue;
        }
        items.push(TrashedNote {
            title: title_of(&path, &name),
            origin: original_relative(&name).unwrap_or_default(),
            deleted: deleted_ms(&name).unwrap_or_else(|| modified_ms(&path)),
            name,
        });
    }
    items.sort_by(|left, right| right.deleted.cmp(&left.deleted));
    Ok(items)
}

#[tauri::command]
fn restore_note(name: String) -> Result<String, String> {
    let root = notes_root()?;
    let source = trash_entry(&root, &name)?;
    let relative = original_relative(&name)?;
    let mut target = root.join(&relative);
    let parent = target
        .parent()
        .ok_or("invalid note path")?
        .to_path_buf();
    fs::create_dir_all(&parent).map_err(|err| err.to_string())?;
    let parent = parent.canonicalize().map_err(|err| err.to_string())?;
    if !parent.starts_with(&root) {
        return Err("invalid note path".into());
    }
    let file_name = target
        .file_name()
        .ok_or("invalid note path")?
        .to_os_string();
    target = parent.join(file_name);
    if target.exists() {
        let stem = target
            .file_stem()
            .and_then(|stem| stem.to_str())
            .ok_or("invalid note path")?
            .to_string();
        let mut suffix = 2u32;
        loop {
            target = parent.join(format!("{stem}-{suffix}.md"));
            if !target.exists() {
                break;
            }
            suffix += 1;
        }
    }
    if !target.starts_with(&root) || !is_markdown(&target) {
        return Err("invalid note path".into());
    }
    fs::rename(&source, &target).map_err(|err| err.to_string())?;
    relative_note_path(&root, &target)
}

#[tauri::command]
fn purge_note(name: String) -> Result<(), String> {
    let root = notes_root()?;
    let full = trash_entry(&root, &name)?;
    fs::remove_file(full).map_err(|err| err.to_string())
}

/// Move a note into `notes/.trash/` (hidden from the list) instead of erasing it.
#[tauri::command]
fn delete_note(path: String) -> Result<(), String> {
    let full = resolve_existing_note(&path)?;
    let root = notes_root()?;
    let trash = root.join(".trash");
    fs::create_dir_all(&trash).map_err(|err| err.to_string())?;
    let flat = path.replace(['/', '\\'], "__");
    let target = trash.join(format!("{}-{flat}", now_ms()));
    if !target.starts_with(&root) {
        return Err("invalid note path".into());
    }
    fs::rename(&full, &target).map_err(|err| err.to_string())
}

#[tauri::command]
fn dismiss_splash(app: tauri::AppHandle) {
    let Some(main) = app.get_webview_window("main") else {
        return;
    };
    // A borderless window that has never been shown stays invisible on Windows.
    #[cfg(not(target_os = "macos"))]
    let _ = main.set_decorations(false);
    if main.show().is_err() {
        return;
    }
    let _ = main.unminimize();
    #[cfg(target_os = "windows")]
    if let Ok(size) = main.inner_size() {
        let _ = main.set_size(tauri::PhysicalSize::new(size.width.saturating_add(1), size.height));
        let _ = main.set_size(size);
    }
    let _ = main.set_focus();
    if let Some(splash) = app.get_webview_window("splashscreen") {
        let _ = splash.close();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let root = notes_root().map_err(std::io::Error::other)?;
            app.fs_scope().allow_directory(&root, true)?;
            // macOS keeps the overlay title bar (native traffic lights). Linux drops the
            // system chrome immediately. Windows must be shown first: WebView2 does not
            // start while the window is hidden, and removing the frame before that first
            // show leaves the window invisible after the splash closes.
            #[cfg(target_os = "linux")]
            if let Some(window) = app.get_webview_window("main") {
                window.set_decorations(false).map_err(std::io::Error::other)?;
            }
            #[cfg(target_os = "windows")]
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
                if let Some(splash) = app.get_webview_window("splashscreen") {
                    let _ = splash.set_always_on_top(true);
                    let _ = splash.set_focus();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            dismiss_splash,
            list_notes,
            list_media,
            rename_media,
            delete_media,
            list_workspaces,
            set_workspace,
            create_workspace,
            update_workspace,
            notes_directory,
            read_note,
            create_note,
            update_note,
            list_folders,
            create_folder,
            rename_note,
            move_note,
            move_folder,
            delete_folder,
            read_sidebar_order,
            write_sidebar_order,
            delete_note,
            list_trash,
            restore_note,
            purge_note
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::project_folder;

    #[test]
    fn project_folder_sees_this_checkout() {
        let notes = project_folder("notes").expect("repo root");
        assert!(notes.ends_with("notes"));
    }
}
