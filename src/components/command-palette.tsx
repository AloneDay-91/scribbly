import { ChevronLeft, ChevronRight, FileText, FolderPlus, House, Images, Moon, Plus, Save, SquarePen, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import {
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/Command";
import { Kbd } from "@/components/ui/Kbd";
import { folderOf, type NoteSummary } from "@/lib/notes";
import { modKey } from "@/lib/platform";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: NoteSummary[];
  hasNote: boolean;
  onOpenNote: (path: string) => void;
  onHome: () => void;
  onOpenMedia: () => void;
  onOpenTrash: () => void;
  onNewTab: () => void;
  onBack: () => void;
  onForward: () => void;
  canBack: boolean;
  canForward: boolean;
  onNewNote: () => void;
  onNewFolder: () => void;
  onSave: () => void;
  canSave: boolean;
};

export function CommandPalette({
  open,
  onOpenChange,
  notes,
  hasNote,
  onOpenNote,
  onHome,
  onOpenMedia,
  onOpenTrash,
  onNewTab,
  onBack,
  onForward,
  canBack,
  canForward,
  onNewNote,
  onNewFolder,
  onSave,
  canSave,
}: CommandPaletteProps) {
  const { resolvedTheme, setTheme } = useTheme();

  function run(action: () => void) {
    onOpenChange(false);
    action();
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Rechercher"
      description="Rechercher une note ou une action"
    >
      <CommandInput placeholder="Rechercher une note ou une action…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        <CommandGroup heading="Notes">
          {notes.map((note) => (
            <CommandItem
              key={note.path}
              value={`${note.title} ${note.path}`}
              onSelect={() => run(() => onOpenNote(note.path))}
            >
              <FileText />
              <span className="truncate">{note.title}</span>
              {folderOf(note.path) ? (
                <span className="ml-auto truncate text-xs text-muted-foreground">
                  {folderOf(note.path)}
                </span>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(onNewTab)}>
            <Plus />
            Nouvel onglet
            <CommandShortcut>{modKey}T</CommandShortcut>
          </CommandItem>
          <CommandItem disabled={!canBack} onSelect={() => run(onBack)}>
            <ChevronLeft />
            Retour
            <CommandShortcut>{modKey}[</CommandShortcut>
          </CommandItem>
          <CommandItem disabled={!canForward} onSelect={() => run(onForward)}>
            <ChevronRight />
            Avancer
            <CommandShortcut>{modKey}]</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(onHome)}>
            <House />
            Bibliothèque
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenMedia)}>
            <Images />
            Médiathèque
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenTrash)}>
            <Trash2 />
            Corbeille
          </CommandItem>
          <CommandItem onSelect={() => run(onNewNote)}>
            <SquarePen />
            Nouvelle note
            <CommandShortcut>{modKey}N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(onNewFolder)}>
            <FolderPlus />
            Nouveau dossier
          </CommandItem>
          {hasNote ? (
            <CommandItem disabled={!canSave} onSelect={() => run(onSave)}>
              <Save />
              Enregistrer maintenant
              <CommandShortcut>{modKey}S</CommandShortcut>
            </CommandItem>
          ) : null}
          <CommandItem
            onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            {resolvedTheme === "dark" ? "Thème clair" : "Thème sombre"}
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <CommandFooter>
        <span className="inline-flex items-center gap-1">
          <Kbd size="sm">↑</Kbd>
          <Kbd size="sm">↓</Kbd>
          Naviguer
        </span>
        <span className="ms-auto inline-flex items-center gap-1">
          <Kbd size="sm">esc</Kbd>
          Fermer
        </span>
      </CommandFooter>
    </CommandDialog>
  );
}
