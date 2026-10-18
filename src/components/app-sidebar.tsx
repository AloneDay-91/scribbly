import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ChevronRight,
  Copy,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Images,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/ContextMenu";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import { Kbd } from "@/components/ui/Kbd";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuShortcut,
  MenuTrigger,
} from "@/components/ui/Menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarRail,
} from "@/components/ui/Sidebar";
import { AccountMenu } from "@/components/account-menu";
import { SettingsNav, type SettingsPage } from "@/components/settings-view";
import { WorkspaceSelect } from "@/components/workspace-select";
import type { Account } from "@/lib/prefs";
import type { Workspace } from "@/lib/workspaces";
import {
  buildNoteTree,
  folderKey,
  folderOf,
  noteKey,
  type DropSpot,
  type NoteFolder,
  type NoteSummary,
  type SidebarOrder,
} from "@/lib/notes";
import { modKey } from "@/lib/platform";
import { cn } from "@/lib/utils";

export type NoteActions = {
  onOpenNote: (path: string, newTab?: boolean) => void;
  onNewInFolder: (folder: string) => void;
  onNewFolder: (parent?: string) => void;
  onCopyPath: (path: string) => void;
  onRename: (note: NoteSummary) => void;
  onDelete: (note: NoteSummary) => void;
  onPlace: (note: NoteSummary, spot: DropSpot) => void;
  onPlaceFolder: (folder: string, spot: DropSpot) => void;
  onDeleteFolder: (folder: string) => void;
};

type NoteGrab = {
  kind: "note" | "folder";
  path: string;
  title: string;
  x: number;
  y: number;
  spot: DropSpot | null;
};

function dropAt(x: number, y: number): DropSpot | null {
  const hit = document.elementFromPoint(x, y);
  if (!(hit instanceof Element)) {
    return null;
  }
  const row = hit.closest<HTMLElement>("[data-drop-id]");
  if (row) {
    const id = row.dataset.dropId ?? "";
    const parent = row.dataset.dropParent ?? "";
    const box = row.getBoundingClientRect();
    const ratio = box.height === 0 ? 0.5 : (y - box.top) / box.height;
    if (id.startsWith("folder:") && ratio > 0.3 && ratio < 0.7) {
      return { kind: "into", folder: id.slice("folder:".length) };
    }
    if (ratio < 0.5) {
      return { kind: "before", parent, id };
    }
    return { kind: "after", parent, id };
  }
  const zone = hit.closest<HTMLElement>("[data-drop-folder]");
  if (!zone) {
    return null;
  }
  return { kind: "into", folder: zone.dataset.dropFolder ?? "" };
}

function dropLine(spot: DropSpot | null, parent: string, id: string) {
  if (spot?.kind === "before" && spot.parent === parent && spot.id === id) {
    return "before";
  }
  if (spot?.kind === "after" && spot.parent === parent && spot.id === id) {
    return "after";
  }
  return undefined;
}

type AppSidebarProps = NoteActions & {
  notes: NoteSummary[];
  folders: string[];
  order: SidebarOrder;
  loading: boolean;
  current: string | null;
  onHome: () => void;
  onNewNote: () => void;
  onSearch: () => void;
  mediaOpen: boolean;
  onOpenMedia: () => void;
  trashCount: number;
  trashOpen: boolean;
  onOpenTrash: () => void;
  settingsPage: SettingsPage | null;
  onSettingsPageChange: (page: SettingsPage) => void;
  workspaces: Workspace[];
  activeWorkspace: string;
  onWorkspaceChange: (path: string) => void;
  onCreateWorkspace: () => void;
  onCustomizeWorkspace: (workspace: Workspace) => void;
  onDeleteWorkspace: (workspace: Workspace) => void;
  accounts: Account[];
  activeAccountId: string | null;
  onSelectAccount: (id: string) => void;
  onCreateAccount: (account: Pick<Account, "name" | "avatar">) => void;
  onUpdateAccount: (account: Account) => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  updateVersion: string | null;
  onOpenUpdate: () => void;
};

export function AppSidebar({
  notes,
  folders,
  order,
  loading,
  current,
  onHome,
  onNewNote,
  onSearch,
  mediaOpen,
  onOpenMedia,
  trashCount,
  trashOpen,
  onOpenTrash,
  settingsPage,
  onSettingsPageChange,
  workspaces,
  activeWorkspace,
  onWorkspaceChange,
  onCreateWorkspace,
  onCustomizeWorkspace,
  onDeleteWorkspace,
  accounts,
  activeAccountId,
  onSelectAccount,
  onCreateAccount,
  onUpdateAccount,
  onLogout,
  onOpenSettings,
  updateVersion,
  onOpenUpdate,
  ...actions
}: AppSidebarProps) {
  const tree = useMemo(
    () => buildNoteTree(notes, folders, order),
    [notes, folders, order],
  );
  const [grab, setGrab] = useState<NoteGrab | null>(null);
  const skipClick = useRef<string | null>(null);
  const stopDrag = useRef<(() => void) | null>(null);

  useEffect(() => () => stopDrag.current?.(), []);

  function startNoteDrag(note: NoteSummary, event: ReactPointerEvent) {
    if (event.button !== 0) {
      return;
    }
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let done = false;
    const finish = (spot: DropSpot | null) => {
      if (done) {
        return;
      }
      done = true;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      document.body.classList.remove("is-note-dragging");
      stopDrag.current = null;
      setGrab(null);
      if (moved) {
        skipClick.current = note.path;
      }
      if (
        !moved ||
        !spot ||
        (spot.kind !== "into" && spot.id === noteKey(note.path))
      ) {
        return;
      }
      actions.onPlace(note, spot);
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== event.pointerId) {
        return;
      }
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && dx * dx + dy * dy < 16) {
        return;
      }
      moved = true;
      document.body.classList.add("is-note-dragging");
      setGrab({
        kind: "note",
        path: note.path,
        title: note.title,
        x: ev.clientX,
        y: ev.clientY,
        spot: dropAt(ev.clientX, ev.clientY),
      });
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== event.pointerId) {
        return;
      }
      finish(moved ? dropAt(ev.clientX, ev.clientY) : null);
    };
    stopDrag.current?.();
    stopDrag.current = () => finish(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  function startFolderDrag(folder: NoteFolder, event: ReactPointerEvent) {
    if (event.button !== 0) {
      return;
    }
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let done = false;
    const blocked = (spot: DropSpot) => {
      const parent = spot.kind === "into" ? spot.folder : spot.parent;
      return parent === folder.path || parent.startsWith(`${folder.path}/`);
    };
    const finish = (spot: DropSpot | null) => {
      if (done) {
        return;
      }
      done = true;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      document.body.classList.remove("is-note-dragging");
      stopDrag.current = null;
      setGrab(null);
      if (moved) {
        skipClick.current = folderKey(folder.path);
      }
      if (
        !moved ||
        !spot ||
        blocked(spot) ||
        (spot.kind !== "into" && spot.id === folderKey(folder.path))
      ) {
        return;
      }
      actions.onPlaceFolder(folder.path, spot);
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== event.pointerId) {
        return;
      }
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && dx * dx + dy * dy < 16) {
        return;
      }
      moved = true;
      document.body.classList.add("is-note-dragging");
      const spot = dropAt(ev.clientX, ev.clientY);
      const allowed =
        spot !== null &&
        !blocked(spot) &&
        (spot.kind === "into" || spot.id !== folderKey(folder.path));
      setGrab({
        kind: "folder",
        path: folder.path,
        title: folder.name,
        x: ev.clientX,
        y: ev.clientY,
        spot: allowed ? spot : null,
      });
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== event.pointerId) {
        return;
      }
      finish(moved ? dropAt(ev.clientX, ev.clientY) : null);
    };
    stopDrag.current?.();
    stopDrag.current = () => finish(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  return (
    <Sidebar>
      <SidebarHeader className="h-11 shrink-0 justify-center border-b border-border px-2 py-0">
        {settingsPage ? (
          <span className="px-2 text-sm font-medium">Réglages</span>
        ) : (
          <WorkspaceSelect
            workspaces={workspaces}
            activeWorkspace={activeWorkspace}
            onWorkspaceChange={onWorkspaceChange}
            onCreateWorkspace={onCreateWorkspace}
            onCustomizeWorkspace={onCustomizeWorkspace}
            onDeleteWorkspace={onDeleteWorkspace}
          />
        )}
      </SidebarHeader>
      <SidebarContent>
        {settingsPage ? (
          <SidebarGroup>
            <SettingsNav
              page={settingsPage}
              onPageChange={onSettingsPageChange}
            />
          </SidebarGroup>
        ) : (
          <>
            <div className="sticky top-0 z-10 -mb-2 bg-background pb-2">
              <SidebarGroup>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Rechercher"
                      aria-label="Rechercher (palette de commandes)"
                      aria-keyshortcuts="Meta+K Control+K"
                      onClick={onSearch}
                    >
                      <Search />
                      <span className="flex-1 truncate text-left">
                        Rechercher…
                      </span>
                      <Kbd
                        size="sm"
                        className="group-data-[collapsible=icon]/sidebar:hidden"
                      >
                        {modKey}K
                      </Kbd>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={mediaOpen}
                      aria-current={mediaOpen ? "page" : undefined}
                      tooltip="Médiathèque"
                      onClick={onOpenMedia}
                    >
                      <Images />
                      <span>Médiathèque</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            </div>
            <SidebarGroup data-drop-folder="">
              <SidebarGroupLabel>Notes</SidebarGroupLabel>
              <Menu>
                <MenuTrigger
                  render={
                    <SidebarGroupAction aria-label="Créer…" title="Créer…" />
                  }
                >
                  <Plus />
                </MenuTrigger>
                <MenuContent align="start" side="right" className="w-52">
                  <MenuItem onClick={onNewNote}>
                    <FilePlus2 />
                    Nouvelle note
                    <MenuShortcut>{modKey}N</MenuShortcut>
                  </MenuItem>
                  <MenuItem onClick={() => actions.onNewFolder()}>
                    <FolderPlus />
                    Nouveau dossier
                  </MenuItem>
                </MenuContent>
              </Menu>
              <SidebarGroupContent>
                <SidebarMenu>
                  {loading ? (
                    Array.from({ length: 5 }, (_, index) => (
                      <SidebarMenuItem key={index}>
                        <SidebarMenuSkeleton showIcon />
                      </SidebarMenuItem>
                    ))
                  ) : notes.length === 0 && folders.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-muted-foreground">
                      Aucune note pour l'instant.
                    </p>
                  ) : (
                    <FolderEntries
                      folder={tree}
                      current={current}
                      actions={actions}
                      spot={grab?.spot ?? null}
                      onGrab={startNoteDrag}
                      onGrabFolder={startFolderDrag}
                      skipClick={skipClick}
                    />
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {settingsPage ? (
              <SidebarMenuButton tooltip="Retour à l'accueil" onClick={onHome}>
                <ArrowLeft />
                <span>Retour à l'accueil</span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                isActive={trashOpen}
                aria-current={trashOpen ? "page" : undefined}
                tooltip="Corbeille"
                onClick={onOpenTrash}
              >
                <Trash2 />
                <span>Corbeille</span>
              </SidebarMenuButton>
            )}
            {!settingsPage && trashCount > 0 ? (
              <SidebarMenuBadge>{trashCount}</SidebarMenuBadge>
            ) : null}
          </SidebarMenuItem>
        </SidebarMenu>
        <AccountMenu
          accounts={accounts}
          activeAccountId={activeAccountId}
          onSelect={onSelectAccount}
          onCreate={onCreateAccount}
          onUpdate={onUpdateAccount}
          onLogout={onLogout}
          onOpenSettings={onOpenSettings}
          updateVersion={updateVersion}
          onOpenUpdate={onOpenUpdate}
        />
      </SidebarFooter>
      <SidebarRail />
      {grab
        ? createPortal(
            <div
              className="pointer-events-none fixed z-50 flex max-w-56 items-center gap-2 rounded-full bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10"
              style={{ left: grab.x + 12, top: grab.y + 12 }}
            >
              {grab.kind === "folder" ? (
                <Folder className="size-4 shrink-0" />
              ) : (
                <FileText className="size-4 shrink-0" />
              )}
              <span className="truncate">{grab.title}</span>
            </div>,
            document.body,
          )
        : null}
    </Sidebar>
  );
}

type EntriesProps = {
  folder: NoteFolder;
  current: string | null;
  actions: NoteActions;
  spot: DropSpot | null;
  onGrab: (note: NoteSummary, event: ReactPointerEvent) => void;
  onGrabFolder: (folder: NoteFolder, event: ReactPointerEvent) => void;
  skipClick: RefObject<string | null>;
};

function FolderEntries({
  folder,
  current,
  actions,
  spot,
  onGrab,
  onGrabFolder,
  skipClick,
}: EntriesProps) {
  return (
    <>
      {folder.items.map((item) => {
        switch (item.kind) {
          case "folder":
            return (
              <FolderItem
                key={item.folder.path}
                folder={item.folder}
                parent={folder.path}
                current={current}
                actions={actions}
                spot={spot}
                onGrab={onGrab}
                onGrabFolder={onGrabFolder}
                skipClick={skipClick}
              />
            );
          case "note":
            return (
              <NoteItem
                key={item.note.path}
                note={item.note}
                parent={folder.path}
                active={item.note.path === current}
                actions={actions}
                spot={spot}
                onGrab={onGrab}
                skipClick={skipClick}
              />
            );
          default: {
            const exhaustive: never = item;
            return exhaustive;
          }
        }
      })}
    </>
  );
}

function FolderItem({
  folder,
  parent,
  current,
  actions,
  spot,
  onGrab,
  onGrabFolder,
  skipClick,
}: EntriesProps & { parent: string }) {
  const containsCurrent =
    current !== null && current.startsWith(`${folder.path}/`);
  const [open, setOpen] = useState(containsCurrent);
  const into = spot?.kind === "into" && spot.folder === folder.path;
  const id = folderKey(folder.path);

  useEffect(() => {
    if (containsCurrent) {
      setOpen(true);
    }
  }, [containsCurrent]);

  return (
    <SidebarMenuItem data-drop-folder={folder.path}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <ContextMenu>
          <ContextMenuTrigger
            render={
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton
                    data-drop-id={id}
                    data-drop-parent={parent}
                    data-drop-line={dropLine(spot, parent, id)}
                    className={cn(
                      "cursor-grab data-[panel-open]:[&>svg:first-child]:rotate-90",
                      into && "bg-muted",
                    )}
                    onPointerDown={(event) => onGrabFolder(folder, event)}
                    onClick={(event) => {
                      if (skipClick.current === id) {
                        skipClick.current = null;
                        event.preventDefault();
                        event.stopPropagation();
                      }
                    }}
                  />
                }
              />
            }
          >
            <ChevronRight className="transition-transform" />
            <Folder className="in-data-[panel-open]:hidden" />
            <FolderOpen className="hidden in-data-[panel-open]:block" />
            <span className="truncate">{folder.name}</span>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => actions.onNewInFolder(folder.path)}>
              <FilePlus2 />
              Nouvelle note ici
            </ContextMenuItem>
            <ContextMenuItem onClick={() => actions.onNewFolder(folder.path)}>
              <FolderPlus />
              Nouveau dossier ici
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => actions.onCopyPath(folder.path)}>
              <Copy />
              Copier le chemin
            </ContextMenuItem>
            <ContextMenuItem
              className="text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
              onClick={() => actions.onDeleteFolder(folder.path)}
            >
              <Trash2 />
              Supprimer…
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <CollapsiblePanel>
          <SidebarMenuSub>
            {folder.items.length === 0 ? (
              <p
                className="px-2 py-1.5 text-xs text-muted-foreground"
                data-drop-folder={folder.path}
              >
                Dossier vide
              </p>
            ) : (
              <FolderEntries
                folder={folder}
                current={current}
                actions={actions}
                spot={spot}
                onGrab={onGrab}
                onGrabFolder={onGrabFolder}
                skipClick={skipClick}
              />
            )}
          </SidebarMenuSub>
        </CollapsiblePanel>
      </Collapsible>
    </SidebarMenuItem>
  );
}

function NoteItem({
  note,
  parent,
  active,
  actions,
  spot,
  onGrab,
  skipClick,
}: {
  note: NoteSummary;
  parent: string;
  active: boolean;
  actions: NoteActions;
  spot: DropSpot | null;
  onGrab: (note: NoteSummary, event: ReactPointerEvent) => void;
  skipClick: RefObject<string | null>;
}) {
  const id = noteKey(note.path);
  return (
    <SidebarMenuItem
      data-drop-id={id}
      data-drop-parent={parent}
      data-drop-line={dropLine(spot, parent, id)}
    >
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <SidebarMenuButton
              isActive={active}
              aria-current={active ? "page" : undefined}
              data-drop-id={id}
              data-drop-parent={parent}
              className="cursor-grab"
              onPointerDown={(event) => onGrab(note, event)}
              onClick={(event) => {
                if (skipClick.current === note.path) {
                  skipClick.current = null;
                  event.preventDefault();
                  return;
                }
                actions.onOpenNote(note.path, event.metaKey || event.ctrlKey);
              }}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  actions.onOpenNote(note.path, true);
                }
              }}
            />
          }
        >
          <FileText />
          <span className="truncate">{note.title}</span>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => actions.onOpenNote(note.path)}>
            <FileText />
            Ouvrir
          </ContextMenuItem>
          <ContextMenuItem onClick={() => actions.onOpenNote(note.path, true)}>
            <Plus />
            Ouvrir dans un onglet
          </ContextMenuItem>
          <ContextMenuItem onClick={() => actions.onRename(note)}>
            <Pencil />
            Renommer…
          </ContextMenuItem>
          <ContextMenuItem onClick={() => actions.onCopyPath(note.path)}>
            <Copy />
            Copier le chemin
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => actions.onNewInFolder(folderOf(note.path))}
          >
            <FilePlus2 />
            Nouvelle note ici
          </ContextMenuItem>
          <ContextMenuItem onClick={() => actions.onNewFolder(parent)}>
            <FolderPlus />
            Nouveau dossier ici
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
            onClick={() => actions.onDelete(note)}
          >
            <Trash2 />
            Supprimer…
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </SidebarMenuItem>
  );
}
