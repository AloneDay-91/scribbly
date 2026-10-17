import { useState } from "react";
import { Trash2, Undo2 } from "lucide-react";
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
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/Item";
import { Card, CardContent } from "@/components/ui/Card";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Spinner } from "@/components/ui/Spinner";
import type { TrashedNote } from "@/lib/notes";

type TrashViewProps = {
  items: TrashedNote[];
  busy: boolean;
  onRestore: (item: TrashedNote) => void;
  onPurge: (item: TrashedNote) => void;
};

export function TrashView({ items, busy, onRestore, onPurge }: TrashViewProps) {
  const [purging, setPurging] = useState<TrashedNote | null>(null);

  return (
    <ScrollArea className="h-full w-full">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12 md:px-12">
        <header className="flex flex-col gap-1">
          <h1 className="text-lg font-medium tracking-tight text-foreground">Corbeille</h1>
          <p className="text-sm text-muted-foreground">
            Les notes supprimées restent ici jusqu'à leur restauration ou leur suppression définitive.
          </p>
        </header>
        {items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trash2 />
              </EmptyMedia>
              <EmptyTitle>La corbeille est vide</EmptyTitle>
              <EmptyDescription>Les notes supprimées apparaîtront ici.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Card size="sm">
            <CardContent>
              <ItemGroup>
                {items.map((item, index) => (
                  <div key={item.name}>
                    {index > 0 ? <ItemSeparator /> : null}
                    <Item size="sm">
                      <ItemMedia>
                        <Trash2 />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle className="truncate">{item.title}</ItemTitle>
                        <ItemDescription className="truncate">
                          {item.origin ? item.origin : item.name}
                          {" · "}
                          {new Date(item.deleted).toLocaleString("fr-FR")}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => onRestore(item)}
                        >
                          <Undo2 data-icon="inline-start" />
                          Restaurer
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() => setPurging(item)}
                        >
                          Supprimer
                        </Button>
                      </ItemActions>
                    </Item>
                  </div>
                ))}
              </ItemGroup>
            </CardContent>
          </Card>
        )}
      </div>
      <AlertDialog open={purging !== null} onOpenChange={(open) => !open && setPurging(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement « {purging?.title} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le fichier est effacé du disque. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Annuler</AlertDialogClose>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (purging) {
                  onPurge(purging);
                }
                setPurging(null);
              }}
            >
              {busy ? <Spinner data-icon="inline-start" /> : null}
              Supprimer définitivement
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}
