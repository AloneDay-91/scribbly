import { useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Images, Library, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { isMac, modKey } from "@/lib/platform";
import { cn } from "@/lib/utils";

export type TitleTab = {
  id: string;
  title: string;
  active: boolean;
  dirty: boolean;
};

type TitleBarProps = {
  tabs: TitleTab[];
  canBack: boolean;
  canForward: boolean;
  libraryActive: boolean;
  mediaActive: boolean;
  onBack: () => void;
  onForward: () => void;
  onLibrary: () => void;
  onMedia: () => void;
  onSearch: () => void;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNewTab: () => void;
};

export function TitleBar({
  tabs,
  canBack,
  canForward,
  libraryActive,
  mediaActive,
  onBack,
  onForward,
  onLibrary,
  onMedia,
  onSearch,
  onSelect,
  onClose,
  onNewTab,
}: TitleBarProps) {
  return (
    <header className="relative flex h-11 shrink-0 select-none border-b border-border bg-background">
      <div data-tauri-drag-region className="absolute inset-0" />
      <div
        className={cn(
          "relative z-10 flex min-w-0 flex-1 items-center gap-1 pr-1 pointer-events-none",
          isMac ? "pl-24" : "pl-2",
        )}
      >
        <div className="pointer-events-auto flex shrink-0 items-center">
          <NavButton label="Retour" shortcut={isMac ? `${modKey}[` : "Alt ←"} disabled={!canBack} onClick={onBack}>
            <ChevronLeft />
          </NavButton>
          <NavButton label="Avancer" shortcut={isMac ? `${modKey}]` : "Alt →"} disabled={!canForward} onClick={onForward}>
            <ChevronRight />
          </NavButton>
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center">
          <NavButton label="Bibliothèque" shortcut="" disabled={false} active={libraryActive} onClick={onLibrary}>
            <Library />
          </NavButton>
          <NavButton label="Médiathèque" shortcut="" disabled={false} active={mediaActive} onClick={onMedia}>
            <Images />
          </NavButton>
          <NavButton label="Rechercher" shortcut={`${modKey}K`} disabled={false} onClick={onSearch}>
            <Search />
          </NavButton>
        </div>
        <div
          role="tablist"
          aria-label="Onglets"
          className="pointer-events-auto flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => (
            <TabButton key={tab.id} tab={tab} onSelect={onSelect} onClose={onClose} />
          ))}
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Nouvel onglet"
                className="pointer-events-auto shrink-0"
                onClick={onNewTab}
              />
            }
          >
            <Plus />
          </TooltipTrigger>
          <TooltipContent>Nouvel onglet · {modKey}T</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

function NavButton({
  label,
  shortcut,
  disabled,
  active = false,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  disabled: boolean;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-sm"
            variant={active ? "outline" : "ghost"}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            disabled={disabled}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{shortcut ? `${label} · ${shortcut}` : label}</TooltipContent>
    </Tooltip>
  );
}

function TabButton({
  tab,
  onSelect,
  onClose,
}: {
  tab: TitleTab;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tab.active) {
      ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [tab.active]);

  return (
    <div ref={ref} className="group relative shrink-0">
      <Button
        size="sm"
        variant={tab.active ? "outline" : "ghost"}
        role="tab"
        aria-selected={tab.active}
        title={tab.title}
        className="max-w-48 min-w-0 pe-7"
        onClick={() => onSelect(tab.id)}
        onMouseDown={(event) => {
          if (event.button === 1) {
            event.preventDefault();
          }
        }}
        onAuxClick={(event) => {
          if (event.button === 1) {
            event.preventDefault();
            onClose(tab.id);
          }
        }}
      >
        {tab.dirty ? <span className="size-1.5 shrink-0 rounded-full bg-brand" /> : null}
        <span className="min-w-0 truncate">{tab.title}</span>
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Fermer ${tab.title}`}
        className={cn(
          "absolute top-1/2 right-0.5 z-10 -translate-y-1/2",
          tab.active || tab.dirty ? undefined : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        )}
        onClick={() => onClose(tab.id)}
      >
        <X />
      </Button>
    </div>
  );
}
