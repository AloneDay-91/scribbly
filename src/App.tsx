import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Check,
  CircleAlert,
  Code,
  Copy,
  FilePlus2,
  MoreHorizontal,
  Pencil,
  Save,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { CreateNoteDialog } from "@/components/create-note-dialog";
import { Library } from "@/components/library";
import { MediaLibrary } from "@/components/media-library";
import { DeleteNoteDialog, TextPromptDialog } from "@/components/note-dialogs";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from "@/components/ui/Menu";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/Sidebar";
import { Spinner } from "@/components/ui/Spinner";
import { useToastManager } from "@/components/ui/Toast";
import { TitleBar } from "@/components/title-bar";
import { VisualEditor } from "@/components/visual-editor";
import { TrashView } from "@/components/trash";
import { reportError, toastManager } from "@/lib/errors";
import { resetNotesRoot, type MediaChange, type MediaFile } from "@/lib/images";
import {
  buildNoteTree,
  folderOf,
  orderOfTree,
  placeFolder,
  placeNote,
  renameInOrder,
  sameOrder,
  type DropSpot,
  type NoteSummary,
  type SidebarOrder,
  type TrashedNote,
} from "@/lib/notes";
import { isMac, isTauri, modKey } from "@/lib/platform";
import { findUpdate } from "@/lib/updates";
import { defaultPrefs, loadPrefs, savePrefs, type Prefs } from "@/lib/prefs";
import {
  applyOpen,
  blankSession,
  createTab,
  forgetPath,
  forgetUnder,
  moveTab,
  pruneMissing,
  replacePath,
  replacePrefix,
  tabPath,
  withoutTab,
  type OpenMode,
  type Tab,
} from "@/lib/tabs";
import { Onboarding, type OnboardingResult } from "@/components/onboarding";
import { SplashScreen } from "@/components/splash-screen";
import { SettingsView, settingsPageLabel, type SettingsPage } from "@/components/settings-view";
import { WorkspaceDialog, type WorkspaceDraft } from "@/components/workspace-dialog";
import type { Workspace } from "@/lib/workspaces";

const AUTOSAVE_DELAY = 800;

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";
/** Navigation that could not run because the current note failed to save. */
type PendingTarget = { path: string | null; tabs: Tab[]; activeId: string };

function countWords(text: string) {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

function App() {
  const toast = useToastManager();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [tabs, setTabs] = useState<Tab[]>(() => prefs.tabs);
  const [activeId, setActiveId] = useState(prefs.activeTab);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [sidebarOrder, setSidebarOrder] = useState<SidebarOrder>({});
  const [trash, setTrash] = useState<TrashedNote[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingTarget | null>(null);
  const [closeBlocked, setCloseBlocked] = useState(false);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsPage, setSettingsPage] = useState<SettingsPage | null>(null);
  const [showSplash, setShowSplash] = useState(() => !isTauri());
  const [availableUpdate, setAvailableUpdate] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createFolder, setCreateFolder] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderParent, setFolderParent] = useState("");
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<NoteSummary | null>(null);
  const [deleting, setDeleting] = useState<NoteSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const draftRef = useRef(draft);
  const savedRef = useRef(saved);
  const currentRef = useRef(current);
  const tabsRef = useRef(tabs);
  const activeIdRef = useRef(activeId);
  const saveChain = useRef<Promise<boolean>>(Promise.resolve(true));

  const dirty = draft !== saved;
  const words = countWords(draft);
  const currentNote = notes.find((note) => note.path === current) ?? null;
  const currentFolder = current ? folderOf(current) : "";
  const folderOptions = [...new Set([...folders, ...notes.map((note) => folderOf(note.path)).filter(Boolean)])].sort(
    (left, right) => left.localeCompare(right),
  );

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowSplash(false);
      if (isTauri()) {
        void invoke("dismiss_splash").catch(() => undefined);
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    let cancelled = false;
    void findUpdate()
      .then((update) => {
        if (cancelled) {
          return;
        }
        setAvailableUpdate(update?.version ?? null);
        if (!update) {
          return;
        }
        toastManager.add({
          title: "Mise à jour disponible",
          description: `La version ${update.version} peut être installée depuis Réglages.`,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
    const lastNote = active ? tabPath(active) : null;
    setPrefs((previous) => {
      if (previous.tabs === tabs && previous.activeTab === activeId && previous.lastNote === lastNote) {
        return previous;
      }
      return { ...previous, tabs, activeTab: activeId, lastNote };
    });
  }, [tabs, activeId]);

  const updatePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((previous) => ({ ...previous, ...patch }));
  }, []);

  const applyNote = useCallback((path: string | null, text: string) => {
    currentRef.current = path;
    draftRef.current = text;
    savedRef.current = text;
    setCurrent(path);
    setDraft(text);
    setSaved(text);
    setStatus("idle");
    setLastSavedAt(null);
  }, []);

  const changeDraft = useCallback((text: string) => {
    draftRef.current = text;
    setDraft(text);
  }, []);

  const refreshNotes = useCallback(async () => {
    const items = await invoke<NoteSummary[]>("list_notes");
    setNotes(items);
    invoke<SidebarOrder>("read_sidebar_order")
      .then(setSidebarOrder)
      .catch((err: unknown) => reportError("Impossible de lire l'ordre des notes", err));
    invoke<TrashedNote[]>("list_trash")
      .then(setTrash)
      .catch(() => setTrash([]));
    // list_folders only exists once the Rust side has been rebuilt; degrade gracefully.
    invoke<string[]>("list_folders")
      .then(setFolders)
      .catch(() => setFolders([]));
    invoke<MediaFile[]>("list_media")
      .then(setMedia)
      .catch(() => setMedia([]));
    return items;
  }, []);

  /** Write the current draft to disk if it changed. Calls are queued so writes never overlap. */
  const flush = useCallback(() => {
    const run = async () => {
      const path = currentRef.current;
      const content = draftRef.current;
      if (!path || content === savedRef.current) {
        return true;
      }
      setStatus("saving");
      try {
        await invoke("update_note", { path, markdown: content });
        if (currentRef.current === path) {
          savedRef.current = content;
          setSaved(content);
        }
        setStatus(draftRef.current === content ? "saved" : "pending");
        setLastSavedAt(Date.now());
        void refreshNotes().catch(() => undefined);
        return true;
      } catch (err: unknown) {
        setStatus("error");
        reportError("Impossible d'enregistrer la note", err);
        return false;
      }
    };
    const next = saveChain.current.then(run, run);
    saveChain.current = next;
    return next;
  }, [refreshNotes]);

  const openNote = useCallback(
    async (path: string) => {
      setLoadError(null);
      try {
        const text = await invoke<string>("read_note", { path });
        applyNote(path, text);
        setPrefs((previous) => ({
          ...previous,
          lastNote: path,
          recent: [path, ...previous.recent.filter((item) => item !== path)].slice(0, 12),
        }));
      } catch (err: unknown) {
        applyNote(path, "");
        setLoadError(String(err));
        reportError("Impossible d'ouvrir la note", err);
        setPrefs((previous) => (previous.lastNote === path ? { ...previous, lastNote: null } : previous));
      }
    },
    [applyNote],
  );

  const commitTabs = useCallback((next: Tab[]) => {
    tabsRef.current = next;
    setTabs(next);
  }, []);

  const commitActive = useCallback((id: string) => {
    activeIdRef.current = id;
    setActiveId(id);
  }, []);

  /** Show a location in the editor. Returns false when the current note could not be saved. */
  const reveal = useCallback(
    async (path: string | null) => {
      if (path === currentRef.current) {
        return true;
      }
      const ok = await flush();
      if (!ok) {
        return false;
      }
      if (path === null) {
        applyNote(null, "");
        setLoadError(null);
        return true;
      }
      setOpening(true);
      try {
        await openNote(path);
      } finally {
        setOpening(false);
      }
      return true;
    },
    [applyNote, flush, openNote],
  );

  const navChain = useRef<Promise<void>>(Promise.resolve());
  const commitNav = useCallback(
    async (next: { tabs: Tab[]; activeId: string }) => {
      const run = async () => {
        setShowTrash(false);
        setShowMedia(false);
        setSettingsPage(null);
        const active = next.tabs.find((tab) => tab.id === next.activeId) ?? next.tabs[0];
        const path = tabPath(active);
        const ok = await reveal(path);
        if (!ok) {
          setPending({ path, tabs: next.tabs, activeId: next.activeId });
          return;
        }
        commitTabs(next.tabs);
        commitActive(next.activeId);
      };
      const queued = navChain.current.then(run, run);
      navChain.current = queued;
      return queued;
    },
    [commitActive, commitTabs, reveal],
  );

  const goTo = useCallback(
    async (path: string | null, mode: OpenMode = "push") => {
      await commitNav(applyOpen(tabsRef.current, activeIdRef.current, path, mode));
    },
    [commitNav],
  );

  const openNewTab = useCallback(async () => {
    const next = createTab(tabsRef.current);
    if (!next) {
      toastRef.current.add({
        title: "Trop d'onglets ouverts",
        description: "Ferme un onglet pour en ouvrir un nouveau.",
      });
      return;
    }
    await commitNav(next);
  }, [commitNav]);

  const closeTab = useCallback(
    async (id: string) => {
      await commitNav(withoutTab(tabsRef.current, activeIdRef.current, id));
    },
    [commitNav],
  );

  const selectTab = useCallback(
    async (id: string) => {
      if (id === activeIdRef.current || !tabsRef.current.some((tab) => tab.id === id)) {
        return;
      }
      await commitNav({ tabs: tabsRef.current, activeId: id });
    },
    [commitNav],
  );

  const travel = useCallback(
    async (direction: "back" | "forward") => {
      const currentTab = tabsRef.current.find((tab) => tab.id === activeIdRef.current);
      if (!currentTab) {
        return;
      }
      const moved = moveTab(currentTab, direction);
      if (moved === currentTab) {
        return;
      }
      await commitNav({
        tabs: tabsRef.current.map((tab) => (tab.id === currentTab.id ? moved : tab)),
        activeId: currentTab.id,
      });
    },
    [commitNav],
  );

  const switchWorkspace = useCallback(
    async (path: string) => {
      if (!path || path === prefs.activeWorkspace) {
        return;
      }
      const saved = await flush();
      if (!saved) {
        return;
      }
      try {
        await invoke("set_workspace", { path });
        resetNotesRoot();
      } catch (err: unknown) {
        reportError("Impossible de changer d'environnement", err);
        return;
      }
      const session = blankSession(null);
      setTabs(session.tabs);
      setActiveId(session.activeId);
      applyNote(null, "");
      setShowTrash(false);
      setSettingsPage(null);
      setListError(null);
      setPrefs((previous) => ({
        ...previous,
        activeWorkspace: path,
        lastNote: null,
        recent: [],
        tabs: session.tabs,
        activeTab: session.activeId,
      }));
      try {
        await refreshNotes();
      } catch (err: unknown) {
        setListError(String(err));
        reportError("Impossible de lire le wiki", err);
      }
    },
    [applyNote, flush, prefs.activeWorkspace, refreshNotes],
  );

  const createWorkspace = useCallback(
    async (name: string) => {
      setWorkspaceBusy(true);
      try {
        const created = await invoke<Workspace>("create_workspace", { name });
        setWorkspaces((previous) => {
          const rest = previous.filter((item) => item.path && item.path !== created.path);
          return [...rest, created];
        });
        setWorkspaceDialogOpen(false);
        await switchWorkspace(created.path);
      } catch (err: unknown) {
        reportError("Impossible de créer l'environnement", err);
      } finally {
        setWorkspaceBusy(false);
      }
    },
    [switchWorkspace],
  );

  const saveWorkspace = useCallback(async (draft: WorkspaceDraft) => {
    if (!editingWorkspace) {
      return;
    }
    setWorkspaceBusy(true);
    try {
      const updated = await invoke<Workspace>("update_workspace", {
        path: editingWorkspace.path,
        name: draft.name,
        icon: draft.icon,
        image: draft.image,
        imageExt: draft.imageExt,
        clearImage: draft.clearImage,
      });
      setWorkspaces((previous) => previous.map((item) => (item.path === updated.path ? updated : item)));
      setEditingWorkspace(null);
    } catch (err: unknown) {
      reportError("Impossible d'enregistrer l'environnement", err);
    } finally {
      setWorkspaceBusy(false);
    }
  }, [editingWorkspace]);

  const cycleTab = useCallback(
    async (delta: number) => {
      const list = tabsRef.current;
      const index = list.findIndex((tab) => tab.id === activeIdRef.current);
      if (index < 0 || list.length < 2) {
        return;
      }
      const next = list[(index + delta + list.length) % list.length];
      await commitNav({ tabs: list, activeId: next.id });
    },
    [commitNav],
  );

  const finishOnboarding = useCallback((result: OnboardingResult) => {
    const session = blankSession(null);
    const next: Prefs = {
      ...defaultPrefs,
      ready: true,
      tabs: session.tabs,
      activeTab: session.activeId,
      lastNote: null,
      recent: [],
      accounts: [result.account],
      activeAccountId: result.account.id,
      activeWorkspace: result.workspace.path || null,
    };
    savePrefs(next);
    setTabs(session.tabs);
    setActiveId(session.activeId);
    setNotes([]);
    setFolders([]);
    setTrash([]);
    setSidebarOrder({});
    setCurrent(null);
    setDraft("");
    setSaved("");
    setShowTrash(false);
    setShowMedia(false);
    setSettingsPage(null);
    setWorkspaces([result.workspace]);
    setPrefs(next);
  }, []);

  // Initial load: open the saved workspace, then restore tabs that still exist.
  useEffect(() => {
    if (!prefs.ready) {
      return;
    }
    let cancelled = false;
    const boot = async () => {
      let listed: Workspace[] = [];
      try {
        listed = await invoke<Workspace[]>("list_workspaces");
      } catch {
        listed = [];
      }
      if (cancelled) {
        return;
      }
      if (listed.length === 0) {
        listed = [{ name: "Notes", path: "", icon: "logo", image: "" }];
      }
      setWorkspaces(listed);
      const saved = loadPrefs().activeWorkspace;
      const active = listed.find((item) => item.path !== "" && item.path === saved) ?? listed.find((item) => item.path);
      if (active?.path) {
        try {
          await invoke("set_workspace", { path: active.path });
          resetNotesRoot();
          setPrefs((previous) =>
            previous.activeWorkspace === active.path ? previous : { ...previous, activeWorkspace: active.path },
          );
        } catch {
          // The running app was built before workspace commands existed.
        }
      }
      const items = await refreshNotes();
      if (cancelled) {
        return;
      }
      const known = new Set(items.map((note) => note.path));
      const pruned = pruneMissing(tabsRef.current, known);
      const open = pruned.find((tab) => tab.id === activeIdRef.current) ?? pruned[0];
      await commitNav({ tabs: pruned, activeId: open.id });
    };
    boot()
      .catch((err: unknown) => {
        if (!cancelled) {
          setListError(String(err));
          reportError("Impossible de lire le wiki", err);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.ready]);

  // Autosave after a pause in typing.
  useEffect(() => {
    if (!current || draft === saved) {
      return;
    }
    setStatus((previous) => (previous === "saving" ? previous : "pending"));
    const timer = window.setTimeout(() => void flush(), AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [current, draft, saved, flush]);

  // Flush pending changes before the window closes; keep it open if the write fails.
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    try {
      getCurrentWindow()
        .onCloseRequested(async (event) => {
          if (draftRef.current === savedRef.current) {
            return;
          }
          const ok = await flush();
          if (!ok) {
            event.preventDefault();
            setCloseBlocked(true);
          }
        })
        .then((fn) => {
          if (disposed) {
            fn();
          } else {
            unlisten = fn;
          }
        })
        .catch(() => undefined);
    } catch {
      // Not running inside Tauri (plain browser preview).
    }
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [flush]);

  function beginCreate(folder?: string) {
    setCreateFolder(folder ?? currentFolder);
    setDialogOpen(true);
  }

  async function createNote() {
    const nextTitle = title.trim();
    if (!nextTitle || creating) {
      return;
    }
    setCreating(true);
    try {
      if (!(await flush())) {
        return;
      }
      const path = await invoke<string>("create_note", { folder: createFolder, title: nextTitle });
      setDialogOpen(false);
      setTitle("");
      await refreshNotes();
      await goTo(path);
    } catch (err: unknown) {
      reportError("Impossible de créer la note", err);
    } finally {
      setCreating(false);
    }
  }

  function beginFolder(parent = "") {
    setFolderParent(parent);
    setFolderDialogOpen(true);
  }

  async function createFolderNamed(name: string) {
    setBusy(true);
    try {
      const created = await invoke<string>("create_folder", { parent: folderParent, name });
      setFolderDialogOpen(false);
      await refreshNotes();
      toast.add({
        title: `Dossier « ${created.split("/").pop() ?? created} » créé`,
        description: folderParent ? `Dans « ${folderParent} ».` : "À la racine du wiki.",
      });
    } catch (err: unknown) {
      reportError("Impossible de créer le dossier", err);
    } finally {
      setBusy(false);
    }
  }

  async function renameNote(note: NoteSummary, nextTitle: string) {
    setBusy(true);
    try {
      if (note.path === currentRef.current && !(await flush())) {
        return;
      }
      const path = await invoke<string>("rename_note", { path: note.path, title: nextTitle });
      const nextOrder = renameInOrder(orderOfTree(buildNoteTree(notes, folders, sidebarOrder)), note.path, path);
      await invoke("write_sidebar_order", { order: nextOrder });
      setSidebarOrder(nextOrder);
      setRenaming(null);
      commitTabs(replacePath(tabsRef.current, note.path, path));
      setPrefs((previous) => ({
        ...previous,
        recent: previous.recent.map((item) => (item === note.path ? path : item)),
      }));
      await refreshNotes();
      if (note.path === currentRef.current) {
        await openNote(path);
      }
    } catch (err: unknown) {
      reportError("Impossible de renommer la note", err);
    } finally {
      setBusy(false);
    }
  }

  async function placeNoteAt(note: NoteSummary, spot: DropSpot) {
    const parent = spot.kind === "into" ? spot.folder : spot.parent;
    const tree = buildNoteTree(notes, folders, sidebarOrder);
    setBusy(true);
    try {
      let path = note.path;
      if (folderOf(note.path) !== parent) {
        if (note.path === currentRef.current && !(await flush())) {
          return;
        }
        path = await invoke<string>("move_note", { path: note.path, folder: parent });
        commitTabs(replacePath(tabsRef.current, note.path, path));
        setPrefs((previous) => ({
          ...previous,
          recent: previous.recent.map((item) => (item === note.path ? path : item)),
        }));
      }
      const nextOrder = placeNote(tree, note.path, path, spot);
      if (!sameOrder(orderOfTree(tree), nextOrder)) {
        await invoke("write_sidebar_order", { order: nextOrder });
        setSidebarOrder(nextOrder);
      }
      if (path !== note.path) {
        await refreshNotes();
        if (note.path === currentRef.current) {
          await openNote(path);
        }
      }
    } catch (err: unknown) {
      reportError("Impossible de déplacer la note", err);
    } finally {
      setBusy(false);
    }
  }

  async function placeFolderAt(folder: string, spot: DropSpot) {
    const parent = spot.kind === "into" ? spot.folder : spot.parent;
    if (parent === folder || parent.startsWith(`${folder}/`)) {
      return;
    }
    const tree = buildNoteTree(notes, folders, sidebarOrder);
    setBusy(true);
    try {
      let path = folder;
      if (folderOf(folder) !== parent) {
        const inside =
          currentRef.current === folder || (currentRef.current?.startsWith(`${folder}/`) ?? false);
        if (inside && !(await flush())) {
          return;
        }
        path = await invoke<string>("move_folder", { path: folder, folder: parent });
        commitTabs(replacePrefix(tabsRef.current, folder, path));
        setPrefs((previous) => ({
          ...previous,
          recent: previous.recent.map((item) =>
            item === folder || item.startsWith(`${folder}/`) ? `${path}${item.slice(folder.length)}` : item,
          ),
        }));
      }
      const nextOrder = placeFolder(tree, folder, path, spot);
      if (!sameOrder(orderOfTree(tree), nextOrder)) {
        await invoke("write_sidebar_order", { order: nextOrder });
        setSidebarOrder(nextOrder);
      }
      if (path !== folder) {
        await refreshNotes();
        const open = currentRef.current;
        if (open === folder || open?.startsWith(`${folder}/`)) {
          await openNote(`${path}${open.slice(folder.length)}`);
        }
      }
    } catch (err: unknown) {
      reportError("Impossible de déplacer le dossier", err);
    } finally {
      setBusy(false);
    }
  }

  async function deleteFolder(folder: string) {
    setBusy(true);
    try {
      const inside = currentRef.current === folder || (currentRef.current?.startsWith(`${folder}/`) ?? false);
      if (inside && !(await flush())) {
        return;
      }
      await invoke("delete_folder", { path: folder });
      setDeletingFolder(null);
      const nextTabs = forgetUnder(tabsRef.current, folder);
      const active = nextTabs.find((tab) => tab.id === activeIdRef.current) ?? nextTabs[0];
      commitTabs(nextTabs);
      setPrefs((previous) => ({
        ...previous,
        recent: previous.recent.filter((item) => item !== folder && !item.startsWith(`${folder}/`)),
      }));
      if (inside) {
        const nextPath = tabPath(active);
        if (nextPath && nextPath !== folder && !nextPath.startsWith(`${folder}/`)) {
          await openNote(nextPath);
        } else {
          applyNote(null, "");
          setLoadError(null);
        }
      }
      await refreshNotes();
      toast.add({
        title: `Dossier « ${folder.split("/").pop() ?? folder} » supprimé`,
        description: "Les notes qu'il contenait sont dans la corbeille.",
      });
    } catch (err: unknown) {
      reportError("Impossible de supprimer le dossier", err);
    } finally {
      setBusy(false);
    }
  }

  async function deleteNote(note: NoteSummary) {
    setBusy(true);
    try {
      const isCurrent = note.path === currentRef.current;
      if (isCurrent) {
        // Nothing to keep: drop the unsaved draft so it is not written after deletion.
        applyNote(note.path, savedRef.current);
      }
      await invoke("delete_note", { path: note.path });
      setDeleting(null);
      const nextTabs = forgetPath(tabsRef.current, note.path);
      const active = nextTabs.find((tab) => tab.id === activeIdRef.current) ?? nextTabs[0];
      commitTabs(nextTabs);
      setPrefs((previous) => ({
        ...previous,
        recent: previous.recent.filter((item) => item !== note.path),
      }));
      if (isCurrent) {
        const nextPath = tabPath(active);
        if (nextPath) {
          await openNote(nextPath);
        } else {
          applyNote(null, "");
          setLoadError(null);
        }
      }
      await refreshNotes();
      toast.add({ title: `« ${note.title} » supprimée`, description: "Déplacée dans la corbeille." });
    } catch (err: unknown) {
      reportError("Impossible de supprimer la note", err);
    } finally {
      setBusy(false);
    }
  }

  async function restoreTrashed(item: TrashedNote) {
    setBusy(true);
    try {
      const path = await invoke<string>("restore_note", { name: item.name });
      await refreshNotes();
      await goTo(path);
      toast.add({ title: `« ${item.title} » restaurée` });
    } catch (err: unknown) {
      reportError("Impossible de restaurer la note", err);
    } finally {
      setBusy(false);
    }
  }

  async function purgeTrashed(item: TrashedNote) {
    setBusy(true);
    try {
      await invoke("purge_note", { name: item.name });
      await refreshNotes();
      toast.add({ title: `« ${item.title} » supprimée définitivement` });
    } catch (err: unknown) {
      reportError("Impossible de supprimer la note", err);
    } finally {
      setBusy(false);
    }
  }

  async function reloadChangedNote(paths: string[]) {
    const open = currentRef.current;
    if (open && paths.includes(open)) {
      await openNote(open);
    }
  }

  async function renameMedia(file: MediaFile, name: string) {
    setBusy(true);
    try {
      if (!(await flush())) {
        return false;
      }
      const changed = await invoke<MediaChange>("rename_media", { path: file.path, name });
      await refreshNotes();
      await reloadChangedNote(changed.notes);
      toast.add({
        title: "Fichier renommé",
        description: `Il s'appelle maintenant « ${changed.path.split("/").pop() ?? changed.path} ».`,
      });
      return true;
    } catch (err: unknown) {
      reportError("Impossible de renommer le fichier", err);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function deleteMedia(file: MediaFile) {
    setBusy(true);
    try {
      if (!(await flush())) {
        return false;
      }
      const changed = await invoke<string[]>("delete_media", { path: file.path });
      await refreshNotes();
      await reloadChangedNote(changed);
      toast.add({
        title: `« ${file.name} » supprimé`,
        description: "Les notes qui l'affichaient ont été mises à jour.",
      });
      return true;
    } catch (err: unknown) {
      reportError("Impossible de supprimer le fichier", err);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function copyPath(path = current) {
    if (!path) {
      return;
    }
    await navigator.clipboard.writeText(path);
    toast.add({ title: "Chemin copié" });
  }

  // Global shortcuts. Capture phase so they win over the editor.
  const shortcutState = useRef({
    flush,
    hasNote: false,
    folder: "",
    back: () => {},
    forward: () => {},
    newTab: () => {},
    closeTab: () => {},
    cycle: (_delta: number) => {},
    tabAt: (_index: number) => {},
  });
  shortcutState.current = {
    flush,
    hasNote: current !== null && !loadError,
    folder: currentFolder,
    back: () => void travel("back"),
    forward: () => void travel("forward"),
    newTab: () => void openNewTab(),
    closeTab: () => void closeTab(activeIdRef.current),
    cycle: (delta) => void cycleTab(delta),
    tabAt: (index) => {
      const tab = tabsRef.current[index];
      if (tab) {
        void selectTab(tab.id);
      }
    },
  };
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const state = shortcutState.current;
      if (!isMac && event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          state.back();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          state.forward();
        }
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        state.cycle(event.shiftKey ? -1 : 1);
        return;
      }
      const key = event.key.toLowerCase();
      let handled = true;
      if (key === "k") {
        setPaletteOpen((open) => !open);
      } else if (key === "s") {
        void state.flush();
      } else if (key === "n" && !event.shiftKey) {
        setCreateFolder(state.folder);
        setDialogOpen(true);
      } else if (key === "t" && !event.shiftKey) {
        state.newTab();
      } else if (key === "w" && !event.shiftKey) {
        state.closeTab();
      } else if (event.key === "[" && !event.shiftKey) {
        state.back();
      } else if (event.key === "]" && !event.shiftKey) {
        state.forward();
      } else if (/^[1-9]$/.test(event.key) && !event.shiftKey) {
        state.tabAt(Number(event.key) - 1);
      } else {
        handled = false;
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  function renderContent() {
    if (loading || opening) {
      return (
        <div className="flex h-full flex-1 items-center justify-center">
          <Spinner className="size-5 text-muted-foreground" aria-label="Chargement" />
        </div>
      );
    }
    if (settingsPage) {
      return (
        <SettingsView
          page={settingsPage}
          onPageChange={setSettingsPage}
          accounts={prefs.accounts}
          activeAccountId={prefs.activeAccountId}
          onSelectAccount={(id) => updatePrefs({ activeAccountId: id })}
          onUpdateAccount={(account) => {
            setPrefs((previous) => ({
              ...previous,
              accounts: previous.accounts.map((item) => (item.id === account.id ? account : item)),
            }));
          }}
          fontSize={prefs.fontSize}
          onFontSizeChange={(value) => updatePrefs({ fontSize: value })}
          wordGoal={prefs.wordGoal}
          onWordGoalChange={(value) => updatePrefs({ wordGoal: value })}
          words={words}
        />
      );
    }
    if (showMedia) {
      return (
        <MediaLibrary
          files={media}
          busy={busy}
          onRename={renameMedia}
          onDelete={deleteMedia}
          onCopyPath={(file) => void copyPath(file.path)}
        />
      );
    }
    if (showTrash) {
      return (
        <TrashView
          items={trash}
          busy={busy}
          onRestore={(item) => void restoreTrashed(item)}
          onPurge={(item) => void purgeTrashed(item)}
        />
      );
    }
    if (loadError) {
      return (
        <div className="mx-auto w-full max-w-3xl px-12 py-16">
          <Button variant="outline" onClick={() => void goTo(null)}>
            Retour à la bibliothèque
          </Button>
        </div>
      );
    }
    if (!current || listError) {
      return (
        <Library
          notes={notes}
          recent={prefs.recent}
          onOpenNote={(path, newTab) => void goTo(path, newTab ? "tab" : "push")}
          onNewNote={() => beginCreate("")}
          onNewFolder={() => beginFolder()}
          onSearch={() => setPaletteOpen(true)}
        />
      );
    }
    return (
      <VisualEditor
        key={current}
        markdown={draft}
        path={current}
        fontSize={prefs.fontSize}
        onChange={changeDraft}
        onOpenNote={(path, newTab) => void goTo(path, newTab ? "tab" : "push")}
      />
    );
  }

  function renderStatus() {
    if (status === "error") {
      return (
        <button
          type="button"
          onClick={() => void flush()}
          className="flex items-center gap-1.5 text-destructive hover:underline"
        >
          <CircleAlert className="size-3.5" />
          Échec de l'enregistrement · Réessayer
        </button>
      );
    }
    if (status === "saving") {
      return (
        <span className="flex items-center gap-1.5">
          <Spinner className="size-3" />
          Enregistrement…
        </span>
      );
    }
    if (dirty) {
      return (
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-brand" aria-hidden />
          Modifications non enregistrées
        </span>
      );
    }
    const savedAt = lastSavedAt ?? currentNote?.modified ?? null;
    const time = savedAt
      ? new Date(savedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : null;
    return (
      <span className="flex items-center gap-1.5">
        <Check className="size-3.5" />
        {time ? `Enregistré à ${time}` : "Enregistré"}
      </span>
    );
  }

  const hasNote = current !== null && !loadError && !showTrash && !showMedia && settingsPage === null;
  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const canBack = (activeTab?.index ?? 0) > 0;
  const canForward = activeTab ? activeTab.index < activeTab.history.length - 1 : false;
  const titleTabs = tabs.map((tab) => {
    const path = tabPath(tab);
    const title = path
      ? (notes.find((note) => note.path === path)?.title ?? path.split("/").pop() ?? path)
      : "Bibliothèque";
    return {
      id: tab.id,
      title,
      active: tab.id === activeId,
      dirty: tab.id === activeId && dirty,
    };
  });

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    getCurrentWindow()
      .setTitle(currentNote?.title ?? "Scribbly")
      .catch(() => undefined);
  }, [currentNote]);

  if (showSplash) {
    return <SplashScreen />;
  }

  if (!prefs.ready) {
    return <Onboarding onComplete={finishOnboarding} />;
  }

  return (
    <SidebarProvider className="h-svh flex-col">
      <TitleBar
        tabs={titleTabs}
        canBack={canBack}
        canForward={canForward}
        libraryActive={!showMedia && !showTrash && settingsPage === null && current === null}
        mediaActive={showMedia}
        onBack={() => void travel("back")}
        onForward={() => void travel("forward")}
        onLibrary={() => void goTo(null)}
        onMedia={() => {
          setSettingsPage(null);
          setShowTrash(false);
          setShowMedia(true);
        }}
        onSearch={() => setPaletteOpen(true)}
        onSelect={(id) => void selectTab(id)}
        onClose={(id) => void closeTab(id)}
        onNewTab={() => void openNewTab()}
      />
      <div className="flex min-h-0 w-full flex-1">
      <AppSidebar
        notes={notes}
        folders={folders}
        order={sidebarOrder}
        loading={loading}
        current={showTrash || showMedia || settingsPage ? null : current}
        onHome={() => void goTo(null)}
        onOpenNote={(path, newTab) => void goTo(path, newTab ? "tab" : "push")}
        onNewNote={() => beginCreate()}
        onNewInFolder={(folder) => beginCreate(folder)}
        onNewFolder={beginFolder}
        onCopyPath={(path) => void copyPath(path)}
        onRename={setRenaming}
        onDelete={setDeleting}
        onPlace={(note, spot) => void placeNoteAt(note, spot)}
        onPlaceFolder={(folder, spot) => void placeFolderAt(folder, spot)}
        onDeleteFolder={setDeletingFolder}
        onSearch={() => setPaletteOpen(true)}
        mediaOpen={showMedia}
        onOpenMedia={() => {
          setSettingsPage(null);
          setShowTrash(false);
          setShowMedia(true);
        }}
        trashCount={trash.length}
        trashOpen={showTrash}
        onOpenTrash={() => {
          setSettingsPage(null);
          setShowMedia(false);
          setShowTrash(true);
        }}
        settingsPage={settingsPage}
        onSettingsPageChange={setSettingsPage}
        workspaces={workspaces}
        activeWorkspace={prefs.activeWorkspace ?? ""}
        onWorkspaceChange={(path) => void switchWorkspace(path)}
        onCreateWorkspace={() => setWorkspaceDialogOpen(true)}
        onCustomizeWorkspace={setEditingWorkspace}
        accounts={prefs.accounts}
        activeAccountId={prefs.activeAccountId}
        onSelectAccount={(id) => updatePrefs({ activeAccountId: id })}
        onCreateAccount={(draft) => {
          const account = { id: crypto.randomUUID(), ...draft };
          setPrefs((previous) => ({
            ...previous,
            accounts: [...previous.accounts, account],
            activeAccountId: account.id,
          }));
        }}
        onUpdateAccount={(account) => {
          setPrefs((previous) => ({
            ...previous,
            accounts: previous.accounts.map((item) => (item.id === account.id ? account : item)),
          }));
        }}
        onLogout={() => updatePrefs({ activeAccountId: null })}
        onOpenSettings={() => {
          setShowTrash(false);
          setShowMedia(false);
          setSettingsPage("account");
        }}
        updateVersion={availableUpdate}
        onOpenUpdate={() => {
          setShowTrash(false);
          setShowMedia(false);
          setSettingsPage("updates");
        }}
      />
      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border/80 bg-background px-3">
          <SidebarTrigger />
          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList className="flex-nowrap text-sm">
              {settingsPage ? (
                <>
                  <BreadcrumbItem className="hidden sm:inline-flex">
                    <BreadcrumbPage className="text-muted-foreground">Réglages</BreadcrumbPage>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-medium text-foreground">
                      {settingsPageLabel(settingsPage)}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : showMedia ? (
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-foreground">Médiathèque</BreadcrumbPage>
                </BreadcrumbItem>
              ) : showTrash ? (
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-foreground">Corbeille</BreadcrumbPage>
                </BreadcrumbItem>
              ) : current ? (
                <>
                  <BreadcrumbItem className="hidden sm:inline-flex">
                    <BreadcrumbLink
                      render={<button type="button" onClick={() => void goTo(null)} />}
                    >
                      Bibliothèque
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:block" />
                  {currentFolder ? (
                    <>
                      <BreadcrumbItem className="hidden md:inline-flex">{currentFolder}</BreadcrumbItem>
                      <BreadcrumbSeparator className="hidden md:block" />
                    </>
                  ) : null}
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="truncate font-medium text-foreground">
                      {currentNote?.title ?? current}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-foreground">
                    {listError ? "Wiki" : "Bibliothèque"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </BreadcrumbList>
          </Breadcrumb>
          {hasNote ? (
            <div className="ml-auto flex shrink-0 items-center gap-3">
              <div aria-live="polite" className="text-xs text-muted-foreground">
                {renderStatus()}
              </div>
              <Menu>
                <MenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Plus d'actions" />}>
                  <MoreHorizontal />
                </MenuTrigger>
                <MenuContent align="end" className="w-56">
                  <MenuItem disabled={!dirty} onClick={() => void flush()}>
                    <Save />
                    Enregistrer maintenant
                    <MenuShortcut>{modKey}S</MenuShortcut>
                  </MenuItem>
                  <MenuItem onClick={() => setSourceOpen(true)}>
                    <Code />
                    Voir le code source
                  </MenuItem>
                  <MenuItem onClick={() => beginCreate()}>
                    <FilePlus2 />
                    Nouvelle note
                    <MenuShortcut>{modKey}N</MenuShortcut>
                  </MenuItem>
                  <MenuItem disabled={!currentNote} onClick={() => currentNote && setRenaming(currentNote)}>
                    <Pencil />
                    Renommer…
                  </MenuItem>
                  <MenuItem onClick={() => void copyPath()}>
                    <Copy />
                    Copier le chemin
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    onClick={() => {
                      setShowTrash(false);
                      setShowMedia(false);
                      setSettingsPage("writing");
                    }}
                  >
                    <SlidersHorizontal />
                    Réglages d'écriture…
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    variant="destructive"
                    disabled={!currentNote}
                    onClick={() => currentNote && setDeleting(currentNote)}
                  >
                    <Trash2 />
                    Supprimer…
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
          ) : null}
        </header>
        <div className="flex min-h-0 flex-1">{renderContent()}</div>
        {hasNote ? (
          <footer className="flex h-8 shrink-0 items-center gap-4 border-t px-4 text-xs text-muted-foreground">
            <span className="hidden truncate font-mono md:inline">{current}</span>
            <span className="ml-auto tabular-nums">
              {words} / {prefs.wordGoal} mots
            </span>
            <span className="tabular-nums">{draft.length} caractères</span>
          </footer>
        ) : null}
      </SidebarInset>
      </div>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        notes={notes}
        hasNote={hasNote}
        onOpenNote={(path) => void goTo(path)}
        onHome={() => void goTo(null)}
        onOpenMedia={() => {
          setSettingsPage(null);
          setShowTrash(false);
          setShowMedia(true);
        }}
        onOpenTrash={() => {
          setSettingsPage(null);
          setShowMedia(false);
          setShowTrash(true);
        }}
        onNewTab={() => void openNewTab()}
        onBack={() => void travel("back")}
        onForward={() => void travel("forward")}
        canBack={canBack}
        canForward={canForward}
        onNewNote={() => beginCreate()}
        onNewFolder={() => beginFolder()}
        onSave={() => void flush()}
        canSave={dirty}
      />
      <CreateNoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        folders={folderOptions}
        folder={createFolder}
        onFolderChange={setCreateFolder}
        title={title}
        onTitleChange={setTitle}
        creating={creating}
        onCreate={() => void createNote()}
      />
      <TextPromptDialog
        open={workspaceDialogOpen}
        onOpenChange={setWorkspaceDialogOpen}
        title="Nouvel environnement"
        description="Un dossier à part, avec ses propres notes."
        label="Nom"
        submitLabel="Créer"
        busy={workspaceBusy}
        onSubmit={(name) => void createWorkspace(name)}
      />
      <WorkspaceDialog
        workspace={editingWorkspace}
        busy={workspaceBusy}
        onOpenChange={(open) => {
          if (!open) {
            setEditingWorkspace(null);
          }
        }}
        onSave={(draft) => void saveWorkspace(draft)}
      />
      <TextPromptDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        title="Nouveau dossier"
        description={
          folderParent ? `Le dossier est créé dans « ${folderParent} ».` : "Le dossier est créé à la racine du wiki."
        }
        label="Nom"
        hint="Pas de « / », ni de nom commençant par un point."
        submitLabel="Créer"
        busy={busy}
        onSubmit={(name) => void createFolderNamed(name)}
      />
      <TextPromptDialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenaming(null);
          }
        }}
        title="Renommer la note"
        description="Le titre H1 et le nom du fichier sont mis à jour."
        label="Titre"
        initialValue={renaming?.title ?? ""}
        submitLabel="Renommer"
        busy={busy}
        onSubmit={(next) => renaming && void renameNote(renaming, next)}
      />
      <DeleteNoteDialog
        noteTitle={deleting?.title ?? null}
        busy={busy}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
        onConfirm={() => deleting && void deleteNote(deleting)}
      />
      <AlertDialog
        open={deletingFolder !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingFolder(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer « {deletingFolder?.split("/").pop() ?? ""} » ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Le dossier est retiré. Les notes qu'il contient vont dans la corbeille.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Annuler</AlertDialogClose>
            <Button variant="destructive" disabled={busy} onClick={() => deletingFolder && void deleteFolder(deletingFolder)}>
              Supprimer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={sourceOpen} onOpenChange={setSourceOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Code source</DialogTitle>
            <DialogDescription className="truncate font-mono">{current}</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[min(60vh,32rem)] overflow-auto rounded-lg bg-muted p-4 font-mono text-xs leading-6 whitespace-pre-wrap">
            {draft}
          </pre>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enregistrement impossible</AlertDialogTitle>
            <AlertDialogDescription>
              Les dernières modifications de cette note n'ont pas pu être écrites sur le disque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Rester sur la note</AlertDialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                const target = pending;
                setPending(null);
                if (!target) {
                  return;
                }
                applyNote(currentRef.current, savedRef.current);
                commitTabs(target.tabs);
                commitActive(target.activeId);
                if (target.path === null) {
                  applyNote(null, "");
                  setLoadError(null);
                } else {
                  void openNote(target.path);
                }
              }}
            >
              Abandonner les modifications
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={closeBlocked} onOpenChange={setCloseBlocked}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fermer sans enregistrer ?</AlertDialogTitle>
            <AlertDialogDescription>
              La note n'a pas pu être enregistrée. Si vous fermez maintenant, les dernières
              modifications seront perdues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Rester</AlertDialogClose>
            <Button variant="destructive" onClick={() => void getCurrentWindow().destroy()}>
              Fermer quand même
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}

export default App;
