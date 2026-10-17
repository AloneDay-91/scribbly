import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { WorkspaceMark } from "@/components/workspace-mark";
import { NEW_WORKSPACE, type Workspace } from "@/lib/workspaces";

const FALLBACK: Workspace = { name: "Notes", path: "", icon: "logo", image: "" };

type WorkspaceSelectProps = {
  workspaces: Workspace[];
  activeWorkspace: string;
  onWorkspaceChange: (path: string) => void;
  onCreateWorkspace: () => void;
  onCustomizeWorkspace: (workspace: Workspace) => void;
};

export function WorkspaceSelect({
  workspaces,
  activeWorkspace,
  onWorkspaceChange,
  onCreateWorkspace,
  onCustomizeWorkspace,
}: WorkspaceSelectProps) {
  const [open, setOpen] = useState(false);
  const options = workspaces.length > 0 ? workspaces : [FALLBACK];
  const active = options.find((item) => item.path === activeWorkspace) ?? options[0];

  return (
    <Select
      open={open}
      onOpenChange={setOpen}
      value={active.path}
      onValueChange={(value) => {
        if (value == null || value === active.path) {
          return;
        }
        if (value === NEW_WORKSPACE) {
          onCreateWorkspace();
          return;
        }
        onWorkspaceChange(value);
      }}
    >
      <SelectTrigger
        aria-label="Environnement de travail"
        className="h-8 w-full max-w-full bg-transparent px-2 font-medium hover:bg-muted data-[size=default]:h-8 group-data-[collapsible=icon]/sidebar:size-8 group-data-[collapsible=icon]/sidebar:justify-center group-data-[collapsible=icon]/sidebar:px-0 group-data-[collapsible=icon]/sidebar:[&>svg:last-of-type]:hidden"
      >
        <WorkspaceMark icon={active.icon} image={active.image} className="size-4" />
        <SelectValue className="min-w-0 truncate group-data-[collapsible=icon]/sidebar:hidden">
          {(value) => options.find((item) => item.path === value)?.name ?? active.name}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        side="bottom"
        align="start"
        alignItemWithTrigger={false}
        collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
        className="min-w-52"
      >
        {options.map((workspace) => (
          <SelectItem key={workspace.path || workspace.name} value={workspace.path}>
            <WorkspaceMark icon={workspace.icon} image={workspace.image} className="size-3.5" />
            <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
            {workspace.path ? (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Personnaliser ${workspace.name}`}
                className="ml-auto size-5"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpen(false);
                  onCustomizeWorkspace(workspace);
                }}
              >
                <Pencil className="size-3" />
              </Button>
            ) : null}
          </SelectItem>
        ))}
        <SelectItem value={NEW_WORKSPACE}>
          <Plus className="size-3.5" />
          Nouvel environnement…
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
