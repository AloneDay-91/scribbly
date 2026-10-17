export function resolveNoteHref(from: string, href: string): string | null {
  const raw = href.trim();
  if (!raw || raw.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return null;
  }

  const pathOnly = raw.split("#")[0]?.split("?")[0] ?? "";
  if (!pathOnly.toLowerCase().endsWith(".md")) {
    return null;
  }

  let decoded = pathOnly;
  try {
    decoded = decodeURIComponent(pathOnly);
  } catch {
    decoded = pathOnly;
  }

  const parts = from.split("/").slice(0, -1);
  for (const part of decoded.split("/")) {
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
    parts.push(part);
  }

  return parts.join("/");
}

export type NoteSummary = {
  path: string;
  title: string;
  /** Last modification time in ms since epoch (absent with an older backend). */
  modified?: number;
};

export type TrashedNote = {
  name: string;
  title: string;
  origin: string;
  deleted: number;
};

export type SidebarEntry =
  | { kind: "folder"; folder: NoteFolder }
  | { kind: "note"; note: NoteSummary };

export type NoteFolder = {
  name: string;
  path: string;
  folders: NoteFolder[];
  notes: NoteSummary[];
  items: SidebarEntry[];
};

/** Parent folder path → ordered child ids (`note:…` or `folder:…`). */
export type SidebarOrder = Record<string, string[]>;

export type DropSpot =
  | { kind: "into"; folder: string }
  | { kind: "before"; parent: string; id: string }
  | { kind: "after"; parent: string; id: string };

export function noteKey(path: string) {
  return `note:${path}`;
}

export function folderKey(path: string) {
  return `folder:${path}`;
}

export function folderOf(path: string) {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
}

function emptyFolder(name: string, path: string): NoteFolder {
  return { name, path, folders: [], notes: [], items: [] };
}

export function buildNoteTree(
  notes: NoteSummary[],
  extraFolders: string[] = [],
  order: SidebarOrder = {},
): NoteFolder {
  const root = emptyFolder("", "");
  for (const folderPath of extraFolders) {
    if (!folderPath || folderPath.split("/").some((part) => !part || part.startsWith(".") || part === "assets")) {
      continue;
    }
    let folder = root;
    for (const part of folderPath.split("/")) {
      let next = folder.folders.find((child) => child.name === part);
      if (!next) {
        const path = folder.path ? `${folder.path}/${part}` : part;
        next = emptyFolder(part, path);
        folder.folders.push(next);
      }
      folder = next;
    }
  }
  for (const note of notes) {
    let folder = root;
    for (const part of note.path.split("/").slice(0, -1)) {
      let next = folder.folders.find((child) => child.name === part);
      if (!next) {
        const path = folder.path ? `${folder.path}/${part}` : part;
        next = emptyFolder(part, path);
        folder.folders.push(next);
      }
      folder = next;
    }
    folder.notes.push(note);
  }
  sortFolder(root, order);
  return root;
}

function entryId(entry: SidebarEntry) {
  switch (entry.kind) {
    case "note":
      return noteKey(entry.note.path);
    case "folder":
      return folderKey(entry.folder.path);
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
}

function entryLabel(entry: SidebarEntry) {
  switch (entry.kind) {
    case "note":
      return entry.note.title;
    case "folder":
      return entry.folder.name;
    default: {
      const exhaustive: never = entry;
      return exhaustive;
    }
  }
}

function sortFolder(folder: NoteFolder, order: SidebarOrder) {
  const rank = new Map((order[folder.path] ?? []).map((id, index) => [id, index]));
  const items: SidebarEntry[] = [
    ...folder.folders.map((child) => ({ kind: "folder" as const, folder: child })),
    ...folder.notes.map((note) => ({ kind: "note" as const, note })),
  ];
  items.sort((left, right) => {
    const leftRank = rank.get(entryId(left));
    const rightRank = rank.get(entryId(right));
    if (leftRank !== undefined && rightRank !== undefined) {
      return leftRank - rightRank;
    }
    if (leftRank !== undefined) {
      return -1;
    }
    if (rightRank !== undefined) {
      return 1;
    }
    return entryLabel(left).localeCompare(entryLabel(right), "fr");
  });
  folder.items = items;
  for (const child of folder.folders) {
    sortFolder(child, order);
  }
}

export function orderOfTree(folder: NoteFolder) {
  return snapshotOrder(folder);
}

function snapshotOrder(folder: NoteFolder): SidebarOrder {
  const lists: SidebarOrder = { [folder.path]: folder.items.map(entryId) };
  for (const item of folder.items) {
    if (item.kind === "folder") {
      Object.assign(lists, snapshotOrder(item.folder));
    }
  }
  return lists;
}

/** New sibling order after dropping a note. `toPath` is the path once the file has moved. */
export function placeNote(tree: NoteFolder, fromPath: string, toPath: string, spot: DropSpot): SidebarOrder {
  const lists = snapshotOrder(tree);
  const fromId = noteKey(fromPath);
  const toId = noteKey(toPath);
  for (const key of Object.keys(lists)) {
    lists[key] = lists[key].filter((id) => id !== fromId && id !== toId);
  }
  const parent = spot.kind === "into" ? spot.folder : spot.parent;
  const list = lists[parent] ?? [];
  let index = list.length;
  if (spot.kind === "before" || spot.kind === "after") {
    const at = list.indexOf(spot.id);
    if (at !== -1) {
      index = spot.kind === "before" ? at : at + 1;
    }
  }
  list.splice(index, 0, toId);
  lists[parent] = list;
  return lists;
}

function shiftPath(path: string, from: string, to: string) {
  if (path === from) {
    return to;
  }
  if (path.startsWith(`${from}/`)) {
    return `${to}${path.slice(from.length)}`;
  }
  return path;
}

function rewriteOrder(order: SidebarOrder, from: string, to: string) {
  const next: SidebarOrder = {};
  for (const [parent, ids] of Object.entries(order)) {
    const mappedParent = shiftPath(parent, from, to);
    next[mappedParent] = ids.map((id) => {
      const split = id.indexOf(":");
      if (split === -1) {
        return id;
      }
      const kind = id.slice(0, split);
      const path = id.slice(split + 1);
      return `${kind}:${shiftPath(path, from, to)}`;
    });
  }
  return next;
}

/** New sibling order after dropping a folder. `toPath` is the path once the directory has moved. */
export function placeFolder(tree: NoteFolder, fromPath: string, toPath: string, spot: DropSpot): SidebarOrder {
  const lists = rewriteOrder(snapshotOrder(tree), fromPath, toPath);
  const toId = folderKey(toPath);
  for (const key of Object.keys(lists)) {
    lists[key] = lists[key].filter((id) => id !== toId);
  }
  const rawParent = spot.kind === "into" ? spot.folder : spot.parent;
  const parent = shiftPath(rawParent, fromPath, toPath);
  const list = lists[parent] ?? [];
  let index = list.length;
  if (spot.kind === "before" || spot.kind === "after") {
    const at = list.indexOf(spot.id);
    if (at !== -1) {
      index = spot.kind === "before" ? at : at + 1;
    }
  }
  list.splice(index, 0, toId);
  lists[parent] = list;
  return lists;
}

export function renameInOrder(order: SidebarOrder, fromPath: string, toPath: string): SidebarOrder {
  const fromId = noteKey(fromPath);
  const toId = noteKey(toPath);
  const next: SidebarOrder = {};
  for (const [parent, ids] of Object.entries(order)) {
    next[parent] = ids.map((id) => (id === fromId ? toId : id));
  }
  return next;
}

export function sameOrder(left: SidebarOrder, right: SidebarOrder) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    const a = left[key] ?? [];
    const b = right[key] ?? [];
    if (a.length !== b.length || a.some((id, index) => id !== b[index])) {
      return false;
    }
  }
  return true;
}
