import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { exists, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { isTauri } from "@/lib/platform";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg"] as const;

export type MediaFile = {
  name: string;
  path: string;
  modified: number;
  image: boolean;
};

export type MediaChange = {
  path: string;
  notes: string[];
};

let rootRequest: Promise<string> | null = null;

export function resetNotesRoot() {
  rootRequest = null;
}

function notesRoot() {
  rootRequest ??= invoke<string>("notes_directory");
  return rootRequest;
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("lecture impossible")));
    reader.readAsDataURL(file);
  });
}

function imageExtension(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  const extension = match?.[1]?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.find((item) => item === extension) ?? null;
}

function safeStem(name: string) {
  const stem = name.replace(/\.[a-z0-9]+$/i, "");
  const slug = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "image";
}

async function uniqueName(directory: string, filename: string) {
  const extension = imageExtension(filename) ?? "png";
  const stem = safeStem(filename);
  let candidate = `${stem}.${extension}`;
  let suffix = 2;
  while (await exists(`${directory}/${candidate}`)) {
    candidate = `${stem}-${suffix}.${extension}`;
    suffix += 1;
  }
  return candidate;
}

export function imageFiles(list: FileList | null | undefined) {
  if (!list) {
    return [];
  }
  return [...list].filter((file) => file.type.startsWith("image/") || imageExtension(file.name) !== null);
}

function relativeToNote(notePath: string, assetPath: string) {
  const from = notePath.split("/").slice(0, -1);
  const to = assetPath.split("/");
  let shared = 0;
  while (shared < from.length && shared < to.length && from[shared] === to[shared]) {
    shared += 1;
  }
  return [...from.slice(shared).map(() => ".."), ...to.slice(shared)].join("/");
}

function resolveInsideNotes(notePath: string, src: string) {
  const parts = notePath.split("/").slice(0, -1);
  for (const part of src.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      if (parts.length === 0) {
        return null;
      }
      parts.pop();
      continue;
    }
    if (part.includes("\\") || part.includes("\0")) {
      return null;
    }
    parts.push(part);
  }
  return parts.join("/");
}

export async function storeImages(notePath: string, files: File[]) {
  if (!isTauri()) {
    return Promise.all(
      files.map(async (file) => ({
        src: await readDataUrl(file),
        alt: file.name,
      })),
    );
  }
  const root = await notesRoot();
  const directory = `${root}/assets`;
  await mkdir(directory, { recursive: true });
  const stored: { src: string; alt: string }[] = [];
  for (const file of files) {
    const name = await uniqueName(directory, file.name);
    await writeFile(`${directory}/${name}`, new Uint8Array(await file.arrayBuffer()));
    stored.push({ src: relativeToNote(notePath, `assets/${name}`), alt: file.name });
  }
  return stored;
}

export async function displaySrc(notePath: string, src: string) {
  if (!src || /^(https?:|data:|blob:|asset:|tauri:)/i.test(src) || !isTauri()) {
    return src;
  }
  const relative = resolveInsideNotes(notePath, src);
  if (!relative) {
    return src;
  }
  const root = await notesRoot();
  return convertFileSrc(`${root}/${relative}`);
}
