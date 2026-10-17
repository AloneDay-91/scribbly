import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Field, FieldControl, FieldDescription, FieldLabel } from "@/components/ui/Field";
import { Fieldset, FieldsetLegend } from "@/components/ui/Fieldset";
import { Form } from "@/components/ui/Form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";

type CreateNoteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: string[];
  folder: string;
  onFolderChange: (folder: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
  creating: boolean;
  onCreate: () => void;
};

export function CreateNoteDialog({
  open,
  onOpenChange,
  folders,
  folder,
  onFolderChange,
  title,
  onTitleChange,
  creating,
  onCreate,
}: CreateNoteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle note</DialogTitle>
          <DialogDescription>
            {folder ? `La note sera créée dans « ${folder} ».` : "La note sera créée à la racine du wiki."}
          </DialogDescription>
        </DialogHeader>
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            onCreate();
          }}
        >
          <Fieldset>
            <FieldsetLegend>Contenu</FieldsetLegend>
            <Field>
              <FieldLabel>Titre</FieldLabel>
              <FieldControl
                value={title}
                placeholder="Sans titre"
                autoFocus
                onChange={(event) => onTitleChange(event.target.value)}
              />
              <FieldDescription>Le titre devient la première ligne H1 du fichier.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Dossier</FieldLabel>
              <Select
                modal={false}
                value={folder || "root"}
                onValueChange={(value) => onFolderChange(value === "root" || value == null ? "" : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) => (value === "root" || value == null ? "Racine" : String(value))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Racine</SelectItem>
                  {folders.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!title.trim() || creating}>
              {creating ? <Spinner data-icon="inline-start" /> : null}
              Créer
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
