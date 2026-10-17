import { useEffect, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Field, FieldControl, FieldDescription, FieldLabel } from "@/components/ui/Field";
import { Form } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";

type TextPromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  hint?: string;
  initialValue?: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: (value: string) => void;
};

/** Small dialog asking for one line of text (rename a note, name a folder). */
export function TextPromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  hint,
  initialValue = "",
  submitLabel,
  busy,
  onSubmit,
}: TextPromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (open) {
      setValue(initialValue);
    }
  }, [open, initialValue]);
  const trimmed = value.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed && !busy) {
              onSubmit(trimmed);
            }
          }}
        >
          <Field>
            <FieldLabel>{label}</FieldLabel>
            <FieldControl
              value={value}
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setValue(event.target.value)}
            />
            {hint ? <FieldDescription>{hint}</FieldDescription> : null}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!trimmed || trimmed === initialValue.trim() || busy}>
              {busy ? <Spinner data-icon="inline-start" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteNoteDialog({
  noteTitle,
  busy,
  onOpenChange,
  onConfirm,
}: {
  noteTitle: string | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={noteTitle !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {noteTitle} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            La note est déplacée dans la corbeille. Vous pourrez la restaurer ou la supprimer
            définitivement.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" />}>Annuler</AlertDialogClose>
          <Button variant="destructive" disabled={busy} onClick={onConfirm}>
            {busy ? <Spinner data-icon="inline-start" /> : null}
            Supprimer
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

