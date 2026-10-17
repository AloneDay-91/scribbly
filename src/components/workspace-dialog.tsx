import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Field, FieldControl, FieldLabel } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Toggle } from "@/components/ui/Toggle";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { WorkspaceMark } from "@/components/workspace-mark";
import { WORKSPACE_ICONS, workspaceIcon, type Workspace } from "@/lib/workspaces";

const MAX_IMAGE = 512 * 1024;

export type WorkspaceDraft = {
  name: string;
  icon: string;
  image: number[] | null;
  imageExt: string | null;
  clearImage: boolean;
};

type WorkspaceDialogProps = {
  workspace: Workspace | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: WorkspaceDraft) => void;
};

function extensionOf(file: File) {
  const match = /\.([a-z0-9]+)$/i.exec(file.name);
  return match?.[1]?.toLowerCase() ?? "";
}

export function WorkspaceDialog({ workspace, busy, onOpenChange, onSave }: WorkspaceDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("logo");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cleared, setCleared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!workspace) {
      return;
    }
    setName(workspace.name);
    setIcon(workspaceIcon(workspace.icon));
    setPreview(null);
    setFile(null);
    setCleared(false);
    setError(null);
  }, [workspace]);

  useEffect(() => {
    if (!file) {
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const image = cleared || file ? "" : (workspace?.image ?? "");

  return (
    <Dialog open={workspace !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Personnaliser l'environnement</DialogTitle>
          <DialogDescription>Le nom, l'icône ou l'image apparaissent dans la barre latérale.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Nom</FieldLabel>
          <FieldControl value={name} autoFocus onChange={(event) => setName(event.target.value)} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Icône</span>
          <ToggleGroup
            value={[icon]}
            onValueChange={(value) => {
              const next = value[0];
              if (next) {
                setIcon(next);
              }
            }}
            aria-label="Icône"
          >
            {WORKSPACE_ICONS.map((item) => (
              <Toggle key={item} value={item} aria-label={item} className="size-8 px-0">
                <WorkspaceMark icon={item} image="" className="size-4" />
              </Toggle>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex items-center gap-3">
          <WorkspaceMark icon={icon} image={image} preview={preview} />
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="sr-only"
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              event.target.value = "";
              if (!next) {
                return;
              }
              if (next.size > MAX_IMAGE) {
                setError("L'image doit faire moins de 512 Ko.");
                return;
              }
              setError(null);
              setCleared(false);
              setFile(next);
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            Choisir une image
          </Button>
          {preview || (workspace?.image && !cleared) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFile(null);
                setPreview(null);
                setCleared(true);
              }}
            >
              Retirer
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            disabled={!name.trim() || busy}
            onClick={() => {
              void (async () => {
                const bytes = file ? Array.from(new Uint8Array(await file.arrayBuffer())) : null;
                onSave({
                  name: name.trim(),
                  icon,
                  image: bytes,
                  imageExt: file ? extensionOf(file) : null,
                  clearImage: cleared && !file,
                });
              })();
            }}
          >
            {busy ? <Spinner data-icon="inline-start" /> : null}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
