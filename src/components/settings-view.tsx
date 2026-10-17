import { useEffect, useRef, useState } from "react";
import { Download, Monitor, Moon, PenLine, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, FieldControl, FieldLabel } from "@/components/ui/Field";
import { Label } from "@/components/ui/Label";
import { Meter } from "@/components/ui/Meter";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/NumberField";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Separator } from "@/components/ui/Separator";
import { Slider } from "@/components/ui/Slider";
import { Spinner } from "@/components/ui/Spinner";
import type { Account } from "@/lib/prefs";
import { isTauri } from "@/lib/platform";
import { appVersion, findUpdate, installUpdate } from "@/lib/updates";
import { errorText } from "@/lib/errors";
import { cn } from "@/lib/utils";

const MAX_IMAGE = 512 * 1024;

export const SETTINGS_PAGES = [
  {
    id: "account",
    label: "Compte",
    description: "Le nom et l'image affichés en bas de la barre latérale.",
    icon: User,
  },
  {
    id: "appearance",
    label: "Apparence",
    description: "Le thème de l'application sur cet ordinateur.",
    icon: Sun,
  },
  {
    id: "writing",
    label: "Écriture",
    description: "La taille du texte et l'objectif de mots des notes.",
    icon: PenLine,
  },
  {
    id: "updates",
    label: "Mise à jour",
    description: "Les versions publiées sur GitHub pour macOS, Windows et Linux.",
    icon: Download,
  },
] as const;

export type SettingsPage = (typeof SETTINGS_PAGES)[number]["id"];

const themes = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
] as const;

type SettingsViewProps = {
  page: SettingsPage;
  onPageChange: (page: SettingsPage) => void;
  accounts: Account[];
  activeAccountId: string | null;
  onSelectAccount: (id: string) => void;
  onUpdateAccount: (account: Account) => void;
  fontSize: number;
  onFontSizeChange: (value: number) => void;
  wordGoal: number;
  onWordGoalChange: (value: number) => void;
  words: number;
};

function pageMeta(page: SettingsPage) {
  switch (page) {
    case "account":
      return SETTINGS_PAGES[0];
    case "appearance":
      return SETTINGS_PAGES[1];
    case "writing":
      return SETTINGS_PAGES[2];
    case "updates":
      return SETTINGS_PAGES[3];
    default: {
      const exhaustive: never = page;
      return exhaustive;
    }
  }
}

export function settingsPageLabel(page: SettingsPage) {
  return pageMeta(page).label;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Lecture impossible"));
    reader.readAsDataURL(file);
  });
}

function AccountSettings({
  accounts,
  activeAccountId,
  onSelectAccount,
  onUpdateAccount,
}: Pick<SettingsViewProps, "accounts" | "activeAccountId" | "onSelectAccount" | "onUpdateAccount">) {
  const active = accounts.find((account) => account.id === activeAccountId) ?? null;
  const [name, setName] = useState(active?.name ?? "");
  const [avatar, setAvatar] = useState(active?.avatar ?? "");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(active?.name ?? "");
    setAvatar(active?.avatar ?? "");
    setError(null);
  }, [active]);

  if (!active) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Aucun compte n'est connecté.</p>
        {accounts.length > 0 ? (
          <div className="flex flex-col gap-1">
            {accounts.map((account) => (
              <Button
                key={account.id}
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => onSelectAccount(account.id)}
              >
                <AccountMark name={account.name} avatar={account.avatar} />
                {account.name}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ajoute un compte depuis le menu en bas de la barre latérale.
          </p>
        )}
      </div>
    );
  }

  const dirty = name.trim() !== active.name || avatar !== active.avatar;

  return (
    <div className="flex flex-col gap-6">
      <Field>
        <FieldLabel>Nom</FieldLabel>
        <FieldControl value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="flex items-center gap-3">
        <AccountMark name={name} avatar={avatar} />
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
      <div>
        <Button
          type="button"
          disabled={!name.trim() || !dirty || Boolean(error)}
          onClick={() => onUpdateAccount({ ...active, name: name.trim(), avatar })}
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

function AccountMark({ name, avatar }: { name: string; avatar: string }) {
  const letters = initials(name);
  return (
    <Avatar className="size-8">
      {avatar ? <AvatarImage src={avatar} alt="" /> : null}
      <AvatarFallback>{letters ? letters : <User className="size-3.5" />}</AvatarFallback>
    </Avatar>
  );
}

function AppearanceSettings() {
  const { theme = "system", setTheme } = useTheme();
  return (
    <RadioGroup
      value={theme}
      onValueChange={(value) => {
        if (value === "light" || value === "dark" || value === "system") {
          setTheme(value);
        }
      }}
      aria-label="Thème"
      className="gap-2"
    >
      {themes.map((item) => (
        <Label key={item.value} className="h-9 justify-start rounded-4xl px-3">
          <RadioGroupItem value={item.value} />
          <item.icon className="size-3.5" />
          {item.label}
        </Label>
      ))}
    </RadioGroup>
  );
}

function WritingSettings({
  fontSize,
  onFontSizeChange,
  wordGoal,
  onWordGoalChange,
  words,
}: Pick<SettingsViewProps, "fontSize" | "onFontSizeChange" | "wordGoal" | "onWordGoalChange" | "words">) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Taille du texte</span>
          <span className="text-muted-foreground tabular-nums">{fontSize} px</span>
        </div>
        <Slider
          value={fontSize}
          min={13}
          max={22}
          step={1}
          aria-label="Taille du texte"
          onValueChange={(value) => {
            const next = typeof value === "number" ? value : value[0];
            if (next != null) {
              onFontSizeChange(next);
            }
          }}
        />
      </div>
      <Separator />
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Objectif de mots</span>
          <span className="text-muted-foreground tabular-nums">
            {words} / {wordGoal}
          </span>
        </div>
        <Meter value={Math.min(words, wordGoal)} min={0} max={wordGoal} aria-label="Mots écrits" />
        <NumberField
          value={wordGoal}
          min={50}
          max={5000}
          step={50}
          onValueChange={(value) => {
            if (value != null) {
              onWordGoalChange(value);
            }
          }}
        >
          <NumberFieldGroup>
            <NumberFieldDecrement />
            <NumberFieldInput aria-label="Objectif de mots" />
            <NumberFieldIncrement />
          </NumberFieldGroup>
        </NumberField>
      </div>
    </div>
  );
}

function UpdateSettings() {
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "downloading">("idle");
  const [available, setAvailable] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateRef = useRef<Awaited<ReturnType<typeof findUpdate>>>(null);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    void appVersion().then(setVersion);
  }, []);

  if (!isTauri()) {
    return (
      <p className="text-sm text-muted-foreground">
        Les mises à jour sont proposées dans l'application installée.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        Version actuelle{" "}
        <span className="font-medium tabular-nums">{version ?? "…"}</span>
      </p>
      {available ? (
        <p className="text-sm">
          La version <span className="font-medium tabular-nums">{available}</span> est disponible.
        </p>
      ) : null}
      {checked && !available && status === "idle" && !error ? (
        <p className="text-sm text-muted-foreground">Scribbly est à jour.</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={status !== "idle"}
          onClick={() => {
            setStatus("checking");
            setError(null);
            void findUpdate()
              .then((update) => {
                updateRef.current = update;
                setAvailable(update?.version ?? null);
                setChecked(true);
              })
              .catch((err: unknown) => setError(errorText(err)))
              .finally(() => setStatus("idle"));
          }}
        >
          {status === "checking" ? <Spinner data-icon="inline-start" /> : null}
          Vérifier
        </Button>
        {available ? (
          <Button
            type="button"
            disabled={status !== "idle" || !updateRef.current}
            onClick={() => {
              const update = updateRef.current;
              if (!update) {
                return;
              }
              setStatus("downloading");
              setError(null);
              void installUpdate(update).catch((err: unknown) => {
                setError(errorText(err));
                setStatus("idle");
              });
            }}
          >
            {status === "downloading" ? <Spinner data-icon="inline-start" /> : null}
            Installer et redémarrer
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PageBody({
  page,
  ...props
}: SettingsViewProps) {
  switch (page) {
    case "account":
      return (
        <AccountSettings
          accounts={props.accounts}
          activeAccountId={props.activeAccountId}
          onSelectAccount={props.onSelectAccount}
          onUpdateAccount={props.onUpdateAccount}
        />
      );
    case "appearance":
      return <AppearanceSettings />;
    case "writing":
      return (
        <WritingSettings
          fontSize={props.fontSize}
          onFontSizeChange={props.onFontSizeChange}
          wordGoal={props.wordGoal}
          onWordGoalChange={props.onWordGoalChange}
          words={props.words}
        />
      );
    case "updates":
      return <UpdateSettings />;
    default: {
      const exhaustive: never = page;
      return exhaustive;
    }
  }
}

export function SettingsNav({
  page,
  onPageChange,
}: {
  page: SettingsPage;
  onPageChange: (page: SettingsPage) => void;
}) {
  return (
    <nav aria-label="Pages des réglages" className="flex flex-col gap-1">
      {SETTINGS_PAGES.map((item) => {
        const active = item.id === page;
        return (
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            aria-current={active ? "page" : undefined}
            className={cn(
              "w-full justify-start font-normal",
              "aria-[current=page]:bg-secondary aria-[current=page]:font-medium",
            )}
            onClick={() => onPageChange(item.id)}
          >
            <item.icon />
            {item.label}
          </Button>
        );
      })}
    </nav>
  );
}

export function SettingsView(props: SettingsViewProps) {
  const current = pageMeta(props.page);

  return (
    <ScrollArea className="h-full min-h-0 min-w-0 flex-1">
      <div className="flex max-w-xl flex-col gap-8 px-8 py-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-lg font-medium tracking-tight text-foreground">{current.label}</h1>
          <p className="text-sm text-muted-foreground">{current.description}</p>
        </header>
        <PageBody {...props} />
      </div>
    </ScrollArea>
  );
}
