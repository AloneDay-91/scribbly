import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { ScribblyLogo } from "@/components/scribbly-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, FieldControl, FieldLabel } from "@/components/ui/Field";
import { Label } from "@/components/ui/Label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { Spinner } from "@/components/ui/Spinner";
import { errorText } from "@/lib/errors";
import { isTauri } from "@/lib/platform";
import type { Account } from "@/lib/prefs";
import type { Workspace } from "@/lib/workspaces";

const MAX_IMAGE = 512 * 1024;

const STEPS = ["welcome", "account", "workspace", "appearance"] as const;

type Step = (typeof STEPS)[number];

const themes = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
] as const;

type ThemeName = (typeof themes)[number]["value"];

export type OnboardingResult = {
  account: Account;
  workspace: Workspace;
};

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Lecture impossible"));
    reader.readAsDataURL(file);
  });
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Onboarding({ onComplete }: { onComplete: (result: OnboardingResult) => void }) {
  const { theme = "system", setTheme } = useTheme();
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceTouched, setWorkspaceTouched] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const index = STEPS.indexOf(step);

  const go = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const finish = () => {
    const account: Account = {
      id: crypto.randomUUID(),
      name: name.trim(),
      avatar,
    };
    const display = workspaceName.trim();
    setBusy(true);
    setError(null);
    const create = isTauri()
      ? invoke<Workspace[]>("list_workspaces").then(async (listed) => {
          const existing = listed.find((item) => item.kind === "default") ?? listed[0];
          if (!existing?.path) {
            const workspace = await invoke<Workspace>("create_workspace", { name: display });
            await invoke("set_workspace", { path: workspace.path });
            return workspace;
          }
          const workspace = await invoke<Workspace>("update_workspace", {
            path: existing.path,
            name: display,
            icon: existing.icon,
            image: null,
            imageExt: null,
            clearImage: false,
          });
          await invoke("set_workspace", { path: workspace.path });
          return workspace;
        })
      : Promise.resolve<Workspace>({ name: display, path: "", icon: "logo", image: "", kind: "default" });
    create
      .then((workspace) => onComplete({ account, workspace }))
      .catch((err: unknown) => {
        setError(errorText(err));
        setBusy(false);
      });
  };

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <div data-tauri-drag-region className="h-11 shrink-0" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 pb-16">
        <div className="flex items-center gap-1.5" aria-hidden>
          {STEPS.map((item, itemIndex) => (
            <span
              key={item}
              className={
                itemIndex <= index ? "h-1 w-6 rounded-full bg-foreground" : "h-1 w-6 rounded-full bg-muted"
              }
            />
          ))}
        </div>
        <StepBody
          step={step}
          name={name}
          avatar={avatar}
          workspaceName={workspaceName}
          imageError={imageError}
          theme={theme === "light" || theme === "dark" || theme === "system" ? theme : "system"}
          onNameChange={setName}
          onAvatarChange={setAvatar}
          onImageError={setImageError}
          onWorkspaceNameChange={(value) => {
            setWorkspaceTouched(true);
            setWorkspaceName(value);
          }}
          onThemeChange={setTheme}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex items-center gap-2">
          {step !== "welcome" ? (
            <Button type="button" variant="outline" disabled={busy} onClick={() => go(previous(step))}>
              Retour
            </Button>
          ) : null}
          <Button
            type="button"
            className="ml-auto"
            disabled={busy || !canContinue(step, name, workspaceName)}
            onClick={() => {
              if (step === "appearance") {
                finish();
                return;
              }
              if (step === "account" && !workspaceTouched) {
                setWorkspaceName(workspaceLabel(name));
              }
              go(next(step));
            }}
          >
            {busy ? <Spinner data-icon="inline-start" /> : null}
            {step === "welcome" ? "Commencer" : step === "appearance" ? "Ouvrir Scribbly" : "Continuer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function previous(step: Step): Step {
  switch (step) {
    case "welcome":
      return "welcome";
    case "account":
      return "welcome";
    case "workspace":
      return "account";
    case "appearance":
      return "workspace";
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}

function next(step: Step): Step {
  switch (step) {
    case "welcome":
      return "account";
    case "account":
      return "workspace";
    case "workspace":
      return "appearance";
    case "appearance":
      return "appearance";
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}

function workspaceLabel(name: string) {
  return `Environnement de travail de ${name.trim()}`;
}

function canContinue(step: Step, name: string, workspaceName: string) {
  switch (step) {
    case "welcome":
    case "appearance":
      return true;
    case "account":
      return name.trim().length > 0;
    case "workspace":
      return workspaceName.trim().length > 0;
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}

function StepBody({
  step,
  name,
  avatar,
  workspaceName,
  imageError,
  theme,
  onNameChange,
  onAvatarChange,
  onImageError,
  onWorkspaceNameChange,
  onThemeChange,
}: {
  step: Step;
  name: string;
  avatar: string;
  workspaceName: string;
  imageError: string | null;
  theme: ThemeName;
  onNameChange: (value: string) => void;
  onAvatarChange: (value: string) => void;
  onImageError: (value: string | null) => void;
  onWorkspaceNameChange: (value: string) => void;
  onThemeChange: (value: ThemeName) => void;
}) {
  switch (step) {
    case "welcome":
      return (
        <div className="flex flex-col gap-4">
          <ScribblyLogo size={36} className="text-foreground" />
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-medium tracking-tight">Bienvenue dans Scribbly</h1>
            <p className="text-sm text-muted-foreground">
              Quelques choix pour préparer votre espace. Les notes restent sur cet ordinateur.
            </p>
          </div>
        </div>
      );
    case "account":
      return (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-medium tracking-tight">Votre compte</h1>
            <p className="text-sm text-muted-foreground">Le nom apparaît en bas de la barre latérale.</p>
          </div>
          <Field>
            <FieldLabel>Nom</FieldLabel>
            <FieldControl
              value={name}
              autoFocus
              placeholder="Votre nom"
              onChange={(event) => onNameChange(event.target.value)}
            />
          </Field>
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              {avatar ? <AvatarImage src={avatar} alt="" /> : null}
              <AvatarFallback>{initials(name) || "?"}</AvatarFallback>
            </Avatar>
            <Button type="button" variant="outline" render={<label />}>
              Choisir une image
              <input
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
                    onImageError("L'image doit faire moins de 512 Ko.");
                    return;
                  }
                  onImageError(null);
                  void readImage(file).then(onAvatarChange);
                }}
              />
            </Button>
            {avatar ? (
              <Button type="button" variant="ghost" onClick={() => onAvatarChange("")}>
                Retirer
              </Button>
            ) : null}
          </div>
          {imageError ? <p className="text-sm text-destructive">{imageError}</p> : null}
        </div>
      );
    case "workspace":
      return (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-medium tracking-tight">Premier environnement</h1>
            <p className="text-sm text-muted-foreground">
              Le nom de votre environnement. Vous pourrez en créer d'autres ensuite.
            </p>
          </div>
          <Field>
            <FieldLabel>Nom</FieldLabel>
            <FieldControl
              value={workspaceName}
              autoFocus
              onChange={(event) => onWorkspaceNameChange(event.target.value)}
            />
          </Field>
        </div>
      );
    case "appearance":
      return (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-medium tracking-tight">Apparence</h1>
            <p className="text-sm text-muted-foreground">Vous pourrez la changer plus tard dans les réglages.</p>
          </div>
          <RadioGroup
            value={theme}
            onValueChange={(value) => {
              if (value === "light" || value === "dark" || value === "system") {
                onThemeChange(value);
              }
            }}
            aria-label="Thème"
          >
            {themes.map((item) => (
              <Label key={item.value} className="h-9 justify-start rounded-4xl px-3">
                <RadioGroupItem value={item.value} />
                <item.icon className="size-3.5" />
                {item.label}
              </Label>
            ))}
          </RadioGroup>
        </div>
      );
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}
