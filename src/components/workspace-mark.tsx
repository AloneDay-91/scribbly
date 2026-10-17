import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { BookOpen, Briefcase, Folder, PenLine, Star, type LucideIcon } from "lucide-react";
import { ScribblyLogo } from "@/components/scribbly-logo";
import { isTauri } from "@/lib/platform";
import { workspaceIcon, type WorkspaceIcon } from "@/lib/workspaces";
import { cn } from "@/lib/utils";

const ICONS: Record<Exclude<WorkspaceIcon, "logo">, LucideIcon> = {
  book: BookOpen,
  briefcase: Briefcase,
  folder: Folder,
  pen: PenLine,
  star: Star,
};

type WorkspaceMarkProps = {
  icon: string;
  image: string;
  /** Local preview, shown before the file is saved. */
  preview?: string | null;
  className?: string;
};

export function WorkspaceMark({ icon, image, preview, className }: WorkspaceMarkProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (preview) {
      setSrc(preview);
      return;
    }
    if (!image || !isTauri()) {
      setSrc(null);
      return;
    }
    setSrc(convertFileSrc(image));
  }, [image, preview]);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn("size-5 shrink-0 rounded-full object-cover", className)}
        onError={() => setSrc(null)}
      />
    );
  }

  const chosen = workspaceIcon(icon);
  if (chosen !== "logo") {
    const Icon = ICONS[chosen];
    return <Icon className={cn("size-5 shrink-0", className)} />;
  }

  return <ScribblyLogo size={20} className={cn("size-5 shrink-0 text-brand", className)} />;
}
