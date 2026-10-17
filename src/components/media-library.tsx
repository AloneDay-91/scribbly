import { useEffect, useState, type ReactElement } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Copy, File, Images, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/ContextMenu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/Empty";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/Item";
import { TextPromptDialog } from "@/components/note-dialogs";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { isTauri } from "@/lib/platform";
import type { MediaFile } from "@/lib/images";

type MediaLibraryProps = {
  files: MediaFile[];
  busy: boolean;
  onRename: (file: MediaFile, name: string) => Promise<boolean>;
  onDelete: (file: MediaFile) => Promise<boolean>;
  onCopyPath: (file: MediaFile) => void;
};

export function MediaLibrary({ files, busy, onRename, onDelete, onCopyPath }: MediaLibraryProps) {
  const [root, setRoot] = useState("");
  const [preview, setPreview] = useState<MediaFile | null>(null);
  const [renaming, setRenaming] = useState<MediaFile | null>(null);
  const [deleting, setDeleting] = useState<MediaFile | null>(null);
  const images = files.filter((file) => file.image);
  const others = files.filter((file) => !file.image);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    let cancelled = false;
    invoke<string>("notes_directory")
      .then((directory) => {
        if (!cancelled) {
          setRoot(directory);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (preview && !files.some((file) => file.path === preview.path)) {
      setPreview(null);
    }
  }, [files, preview]);

  return (
    <ScrollArea className="h-full w-full">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12 md:px-12">
        <header className="flex flex-col gap-1">
          <h1 className="text-lg font-medium tracking-tight text-foreground">Médiathèque</h1>
          <p className="text-sm text-muted-foreground">
            {files.length
              ? `${files.length} ${files.length > 1 ? "fichiers" : "fichier"} dans assets.`
              : "Aucun fichier dans assets pour l'instant."}
          </p>
        </header>

        {files.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Images />
              </EmptyMedia>
              <EmptyTitle>Aucun média</EmptyTitle>
              <EmptyDescription>
                Les images ajoutées dans une note apparaissent ici.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {images.length > 0 ? (
              <section aria-labelledby="media-images" className="flex flex-col gap-3">
                <h2 id="media-images" className="text-sm font-medium text-foreground">
                  Images
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {images.map((file) => (
                    <MediaActions
                      key={file.path}
                      file={file}
                      onRename={setRenaming}
                      onDelete={setDeleting}
                      onCopyPath={onCopyPath}
                      trigger={
                        <button
                          type="button"
                          className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition-colors hover:bg-foreground/5"
                          onClick={() => setPreview(file)}
                        >
                          <MediaThumb file={file} root={root} />
                          <span className="flex flex-col gap-0.5 px-3 py-2">
                            <span className="truncate text-sm font-medium">{file.name}</span>
                            <span className="text-xs text-muted-foreground">{formatModified(file.modified)}</span>
                          </span>
                        </button>
                      }
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {others.length > 0 ? (
              <section aria-labelledby="media-files" className="flex flex-col gap-3">
                <h2 id="media-files" className="text-sm font-medium text-foreground">
                  Fichiers
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {others.map((file) => (
                    <MediaActions
                      key={file.path}
                      file={file}
                      onRename={setRenaming}
                      onDelete={setDeleting}
                      onCopyPath={onCopyPath}
                      trigger={
                        <Item variant="outline" size="sm" className="cursor-context-menu">
                          <ItemMedia variant="icon">
                            <File />
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle className="truncate">{file.name}</ItemTitle>
                            <ItemDescription>{formatModified(file.modified)}</ItemDescription>
                          </ItemContent>
                        </Item>
                      }
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.name}</DialogTitle>
            <DialogDescription>{preview ? formatModified(preview.modified) : ""}</DialogDescription>
          </DialogHeader>
          {preview ? <MediaThumb file={preview} root={root} large /> : null}
          {preview ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onCopyPath(preview)}>
                <Copy data-icon="inline-start" />
                Copier le chemin
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRenaming(preview)}>
                <Pencil data-icon="inline-start" />
                Renommer
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleting(preview)}>
                <Trash2 data-icon="inline-start" />
                Supprimer
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <TextPromptDialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenaming(null);
          }
        }}
        title="Renommer le fichier"
        description="Le nom est mis à jour dans les notes qui utilisent ce fichier."
        label="Nom"
        hint="L'extension est conservée si vous ne la précisez pas."
        initialValue={renaming?.name ?? ""}
        submitLabel="Renommer"
        busy={busy}
        onSubmit={(name) => {
          if (!renaming) {
            return;
          }
          const file = renaming;
          void onRename(file, name).then((ok) => {
            if (ok) {
              setRenaming(null);
            }
          });
        }}
      />
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {deleting?.name ?? ""} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le fichier est effacé. Les notes qui l'affichent perdent cette image.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Annuler</AlertDialogClose>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (!deleting) {
                  return;
                }
                const file = deleting;
                void onDelete(file).then((ok) => {
                  if (ok) {
                    setDeleting(null);
                  }
                });
              }}
            >
              Supprimer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}

function MediaActions({
  file,
  trigger,
  onRename,
  onDelete,
  onCopyPath,
}: {
  file: MediaFile;
  trigger: ReactElement;
  onRename: (file: MediaFile) => void;
  onDelete: (file: MediaFile) => void;
  onCopyPath: (file: MediaFile) => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={trigger} />
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onRename(file)}>
          <Pencil />
          Renommer…
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCopyPath(file)}>
          <Copy />
          Copier le chemin
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
          onClick={() => onDelete(file)}
        >
          <Trash2 />
          Supprimer…
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function mediaUrl(root: string, file: MediaFile) {
  if (!root || !isTauri()) {
    return "";
  }
  return convertFileSrc(`${root}/${file.path}`);
}

function MediaThumb({ file, root, large = false }: { file: MediaFile; root: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = mediaUrl(root, file);
  if (!src || failed) {
    return (
      <span
        className={
          large
            ? "flex h-64 items-center justify-center rounded-xl bg-muted text-muted-foreground"
            : "flex aspect-square items-center justify-center bg-muted text-muted-foreground"
        }
      >
        <Images className="size-5" />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={file.name}
      className={large ? "max-h-[70vh] w-full rounded-xl object-contain" : "aspect-square w-full object-cover"}
      onError={() => setFailed(true)}
    />
  );
}

function formatModified(ms: number) {
  if (!ms) {
    return "—";
  }
  return new Date(ms).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
