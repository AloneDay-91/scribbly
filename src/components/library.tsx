import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  FilePlus2,
  FileText,
  FolderPlus,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/Empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/Item";
import { Kbd, KbdGroup } from "@/components/ui/Kbd";
import { ScrollArea } from "@/components/ui/ScrollArea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { folderOf, type NoteSummary } from "@/lib/notes";
import { modKey } from "@/lib/platform";

const RECENT_COUNT = 8;

type LibraryProps = {
  notes: NoteSummary[];
  recent: string[];
  onOpenNote: (path: string, newTab?: boolean) => void;
  onNewNote: () => void;
  onNewFolder: () => void;
  onSearch: () => void;
};

type SortColumn = "title" | "folder" | "modified";

const relativeTime = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

const shortcuts = [
  { label: "Rechercher", keys: [modKey, "K"] },
  { label: "Nouvelle note", keys: [modKey, "N"] },
  { label: "Enregistrer maintenant", keys: [modKey, "S"] },
  { label: "Barre latérale", keys: [modKey, "B"] },
] as const;

function formatModified(ms?: number) {
  if (!ms) {
    return "—";
  }
  const diff = (ms - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
  ];
  let value = diff;
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) {
      return relativeTime.format(Math.round(value), unit);
    }
    value /= size;
  }
  return relativeTime.format(Math.round(value), "year");
}

function folderLabel(path: string) {
  return folderOf(path) || "Racine";
}

function compareNotes(
  left: NoteSummary,
  right: NoteSummary,
  column: SortColumn,
) {
  switch (column) {
    case "title":
      return left.title.localeCompare(right.title, "fr");
    case "folder":
      return folderLabel(left.path).localeCompare(
        folderLabel(right.path),
        "fr",
      );
    case "modified":
      return (left.modified ?? 0) - (right.modified ?? 0);
    default: {
      const exhaustive: never = column;
      return exhaustive;
    }
  }
}

function sortMark(active: boolean, descending: boolean) {
  if (!active) {
    return null;
  }
  if (descending) {
    return <ArrowDown className="size-3" />;
  }
  return <ArrowUp className="size-3" />;
}

function openNoteFromPointer(
  event: {
    metaKey: boolean;
    ctrlKey: boolean;
    button: number;
    preventDefault: () => void;
  },
  path: string,
  onOpenNote: LibraryProps["onOpenNote"],
) {
  if (event.button === 1) {
    event.preventDefault();
    onOpenNote(path, true);
    return;
  }
  onOpenNote(path, event.metaKey || event.ctrlKey);
}

export function Library({
  notes,
  recent,
  onOpenNote,
  onNewNote,
  onNewFolder,
  onSearch,
}: LibraryProps) {
  const [sort, setSort] = useState<SortColumn>("modified");
  const [descending, setDescending] = useState(true);

  const recentNotes = useMemo(() => {
    const byPath = new Map(notes.map((note) => [note.path, note]));
    const opened = recent.flatMap((path) => {
      const note = byPath.get(path);
      return note ? [note] : [];
    });
    if (opened.length >= RECENT_COUNT) {
      return opened.slice(0, RECENT_COUNT);
    }
    const seen = new Set(opened.map((note) => note.path));
    const rest = [...notes]
      .filter((note) => !seen.has(note.path))
      .sort((left, right) => (right.modified ?? 0) - (left.modified ?? 0));
    return [...opened, ...rest].slice(0, RECENT_COUNT);
  }, [notes, recent]);

  const visibleNotes = useMemo(() => {
    const sorted = [...recentNotes].sort((left, right) =>
      compareNotes(left, right, sort),
    );
    return descending ? sorted.reverse() : sorted;
  }, [recentNotes, sort, descending]);

  function toggleSort(column: SortColumn) {
    if (sort === column) {
      setDescending((value) => !value);
      return;
    }
    setSort(column);
    setDescending(column === "modified");
  }

  const actions = [
    {
      label: "Nouvelle note",
      hint: `${modKey}N`,
      icon: FilePlus2,
      onClick: onNewNote,
    },
    {
      label: "Rechercher",
      hint: `${modKey}K`,
      icon: Search,
      onClick: onSearch,
    },
    {
      label: "Nouveau dossier",
      hint: null,
      icon: FolderPlus,
      onClick: onNewFolder,
    },
  ];

  return (
    <ScrollArea className="h-full w-full">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12 md:px-12">
        <header className="flex flex-col gap-1">
          <h1 className="text-lg font-medium tracking-tight text-foreground">
            Bibliothèque
          </h1>
          <p className="text-sm text-muted-foreground">
            {notes.length
              ? `${notes.length} ${notes.length > 1 ? "notes" : "note"} dans ce wiki.`
              : "Le wiki est vide pour l'instant."}
          </p>
        </header>

        <section
          aria-labelledby="quick-actions"
          className="flex flex-col gap-3"
        >
          <h2
            id="quick-actions"
            className="text-sm font-medium text-foreground"
          >
            Actions rapides
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {actions.map((action) => (
              <Item
                key={action.label}
                variant="outline"
                render={<button type="button" onClick={action.onClick} />}
              >
                <ItemMedia
                  variant="icon"
                  className="bg-primary/15 text-primary"
                >
                  <action.icon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{action.label}</ItemTitle>
                </ItemContent>
                {action.hint ? (
                  <ItemActions>
                    <Kbd size="sm">{action.hint}</Kbd>
                  </ItemActions>
                ) : null}
              </Item>
            ))}
          </div>
        </section>

        {notes.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>Aucune note</EmptyTitle>
              <EmptyDescription>
                Créez votre première note pour commencer.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <section
            aria-labelledby="recent-notes"
            className="flex flex-col gap-3"
          >
            <h2
              id="recent-notes"
              className="text-sm font-medium text-foreground"
            >
              Récentes
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    column="title"
                    sort={sort}
                    descending={descending}
                    onSort={toggleSort}
                  >
                    Titre
                  </SortableHead>
                  <SortableHead
                    column="folder"
                    sort={sort}
                    descending={descending}
                    onSort={toggleSort}
                  >
                    Dossier
                  </SortableHead>
                  <SortableHead
                    column="modified"
                    sort={sort}
                    descending={descending}
                    onSort={toggleSort}
                    className="w-40"
                  >
                    Modifiée
                  </SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleNotes.map((note) => (
                  <TableRow
                    key={note.path}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={(event) =>
                      openNoteFromPointer(event, note.path, onOpenNote)
                    }
                    onAuxClick={(event) =>
                      openNoteFromPointer(event, note.path, onOpenNote)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        onOpenNote(note.path, event.metaKey || event.ctrlKey);
                      }
                    }}
                  >
                    <TableCell>
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium text-foreground">
                          {note.title}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{folderLabel(note.path)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatModified(note.modified)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        <section aria-labelledby="shortcuts" className="flex flex-col gap-3">
          <h2 id="shortcuts" className="text-sm font-medium text-foreground">
            Raccourcis
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {shortcuts.map((shortcut) => (
              <Item key={shortcut.label} variant="default" size="default">
                <ItemContent>
                  <ItemTitle>{shortcut.label}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <KbdGroup size="sm">
                    {shortcut.keys.map((key) => (
                      <Kbd key={key}>{key.replace("+", "")}</Kbd>
                    ))}
                  </KbdGroup>
                </ItemActions>
              </Item>
            ))}
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

function SortableHead({
  column,
  sort,
  descending,
  onSort,
  className,
  children,
}: {
  column: SortColumn;
  sort: SortColumn;
  descending: boolean;
  onSort: (column: SortColumn) => void;
  className?: string;
  children: string;
}) {
  const active = sort === column;
  const label = active
    ? descending
      ? "décroissant"
      : "croissant"
    : "non trié";
  return (
    <TableHead
      className={className}
      aria-sort={active ? (descending ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 text-left"
        aria-label={`${children}, ${label}`}
        onClick={() => onSort(column)}
      >
        {children}
        {sortMark(active, descending)}
      </button>
    </TableHead>
  );
}
