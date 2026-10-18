export const WORKSPACE_ICONS = ["logo", "book", "briefcase", "folder", "pen", "star"] as const;

export type WorkspaceIcon = (typeof WORKSPACE_ICONS)[number];

export const WORKSPACE_KINDS = ["default", "custom"] as const;

export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export type Workspace = {
  name: string;
  path: string;
  icon: string;
  /** Absolute path of a custom image, or empty when the environment uses an icon. */
  image: string;
  /** `default` is the original environment and cannot be deleted. */
  kind: WorkspaceKind;
};

export const NEW_WORKSPACE = "__new__";

export function workspaceIcon(icon: string): WorkspaceIcon {
  return WORKSPACE_ICONS.find((item) => item === icon) ?? "logo";
}
