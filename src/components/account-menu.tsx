import { useEffect, useRef, useState } from "react";
import { LogOut, Pencil, RefreshCw, SlidersHorizontal, User, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
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
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/Sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import type { Account } from "@/lib/prefs";

const MAX_IMAGE = 512 * 1024;

type AccountDraft = Pick<Account, "name" | "avatar">;

const emptyDraft: AccountDraft = { name: "", avatar: "" };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function AccountAvatar({ account, className }: { account: AccountDraft; className?: string }) {
  const letters = initials(account.name);
  return (
    <Avatar className={className ?? "size-6"}>
      {account.avatar ? <AvatarImage src={account.avatar} alt="" /> : null}
      <AvatarFallback>
        {letters ? letters : <User className="size-3.5" />}
      </AvatarFallback>
    </Avatar>
  );
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Lecture impossible"));
    reader.readAsDataURL(file);
  });
}

function AccountDialog({
  open,
  mode,
  account,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  mode: "create" | "edit";
  account: AccountDraft;
  onOpenChange: (open: boolean) => void;
  onSave: (account: AccountDraft) => void;
}) {
  const [name, setName] = useState(account.name);
  const [avatar, setAvatar] = useState(account.avatar);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(account.name);
    setAvatar(account.avatar);
    setError(null);
  }, [open, account]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Ajouter un compte" : "Compte"}</DialogTitle>
          <DialogDescription>
            Le nom et l'image apparaissent en bas de la barre latérale.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Nom</FieldLabel>
          <FieldControl
            value={name}
            autoFocus
            placeholder="Ton nom"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <div className="flex items-center gap-3">
          <AccountAvatar account={{ name, avatar }} />
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              if (!file) {
                return;
              }
              if (file.size > MAX_IMAGE) {
                setError("L'image doit faire moins de 512 Ko.");
                return;
              }
              void readImage(file).then((data) => {
                setError(null);
                setAvatar(data);
              });
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            Choisir une image
          </Button>
          {avatar ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setAvatar("")}>
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
            disabled={!name.trim() || Boolean(error)}
            onClick={() => {
              onSave({ name: name.trim(), avatar });
              onOpenChange(false);
            }}
          >
            {mode === "create" ? "Ajouter" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AccountMenu({
  accounts,
  activeAccountId,
  onSelect,
  onCreate,
  onUpdate,
  onLogout,
  onOpenSettings,
  updateVersion,
  onOpenUpdate,
}: {
  accounts: Account[];
  activeAccountId: string | null;
  onSelect: (id: string) => void;
  onCreate: (account: AccountDraft) => void;
  onUpdate: (account: Account) => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  updateVersion: string | null;
  onOpenUpdate: () => void;
}) {
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const active = accounts.find((account) => account.id === activeAccountId) ?? null;
  const label = active?.name ?? "Compte";
  const others = accounts.filter((account) => account.id !== active?.id);

  const updateLabel = updateVersion ? `Mettre à jour vers ${updateVersion}` : "";

  return (
    <>
      <div className="flex items-center gap-1">
      <SidebarMenu className="w-auto min-w-0 flex-1">
        <SidebarMenuItem>
          <Menu>
            <MenuTrigger render={<SidebarMenuButton tooltip={label} aria-label={label} />}>
              <AccountAvatar account={active ?? emptyDraft} />
              <span className="truncate">{label}</span>
            </MenuTrigger>
            <MenuContent side="top" align="start" className="min-w-52">
              {others.map((account) => (
                <MenuItem key={account.id} onClick={() => onSelect(account.id)}>
                  <AccountAvatar account={account} className="size-4" />
                  {account.name}
                </MenuItem>
              ))}
              {others.length > 0 ? <MenuSeparator /> : null}
              {active ? (
                <MenuItem onClick={() => setMode("edit")}>
                  <Pencil />
                  Modifier le compte
                </MenuItem>
              ) : null}
              <MenuItem onClick={onOpenSettings}>
                <SlidersHorizontal />
                Réglages
              </MenuItem>
              <MenuItem onClick={() => setMode("create")}>
                <UserPlus />
                Ajouter un compte
              </MenuItem>
              {active ? (
                <>
                  <MenuSeparator />
                  <MenuItem variant="destructive" onClick={onLogout}>
                    <LogOut />
                    Déconnexion
                  </MenuItem>
                </>
              ) : null}
            </MenuContent>
          </Menu>
        </SidebarMenuItem>
      </SidebarMenu>
      {updateVersion ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon"
                aria-label={updateLabel}
                onClick={onOpenUpdate}
              />
            }
          >
            <RefreshCw />
          </TooltipTrigger>
          <TooltipContent side="top">{updateLabel}</TooltipContent>
        </Tooltip>
      ) : null}
      </div>
      <AccountDialog
        open={mode !== null}
        mode={mode ?? "create"}
        account={mode === "edit" && active ? active : emptyDraft}
        onOpenChange={(open) => {
          if (!open) {
            setMode(null);
          }
        }}
        onSave={(draft) => {
          if (mode === "edit" && active) {
            onUpdate({ ...active, ...draft });
            return;
          }
          onCreate(draft);
        }}
      />
    </>
  );
}
