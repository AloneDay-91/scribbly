import { useEffect, useState, type RefObject } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type TocHeading = {
  pos: number;
  level: number;
  text: string;
};

function headingLevel(value: unknown) {
  switch (value) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      return value;
    default:
      return 1;
  }
}

const OPEN_KEY = "scribbly:toc-open";

function readOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

function headingElement(editor: Editor, pos: number) {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "heading") {
    return null;
  }
  const dom = editor.view.nodeDOM(pos);
  return dom instanceof HTMLElement ? dom : null;
}

export function TableOfContents({
  editor,
  scroller,
}: {
  editor: Editor;
  scroller: RefObject<HTMLDivElement | null>;
}) {
  const headings = useEditorState({
    editor,
    selector: ({ editor: current }): TocHeading[] => {
      const items: TocHeading[] = [];
      current.state.doc.descendants((node, pos) => {
        if (node.type.name !== "heading") {
          return;
        }
        const text = node.textContent.trim();
        if (!text) {
          return;
        }
        items.push({ pos, level: headingLevel(node.attrs.level), text });
      });
      return items;
    },
  });
  const [active, setActive] = useState<number | null>(null);
  const [open, setOpen] = useState(readOpen);
  const minLevel = headings.reduce((min, item) => Math.min(min, item.level), 6);

  function toggle() {
    setOpen((current) => {
      const next = !current;
      try {
        localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      } catch {
        // Le choix reste valable pour cette note si le stockage est indisponible.
      }
      return next;
    });
  }

  useEffect(() => {
    const root = scroller.current;
    if (!root || headings.length === 0) {
      return;
    }
    const update = () => {
      const line = root.getBoundingClientRect().top + 48;
      let current = headings[0]?.pos ?? null;
      for (const item of headings) {
        const element = headingElement(editor, item.pos);
        if (element && element.getBoundingClientRect().top <= line) {
          current = item.pos;
        }
      }
      setActive(current);
    };
    update();
    root.addEventListener("scroll", update, { passive: true });
    return () => root.removeEventListener("scroll", update);
  }, [editor, headings, scroller]);

  function reveal(pos: number) {
    const root = scroller.current;
    const element = headingElement(editor, pos);
    if (!root || !element) {
      return;
    }
    const top = root.scrollTop + element.getBoundingClientRect().top - root.getBoundingClientRect().top - 32;
    root.scrollTo({ top, behavior: "smooth" });
    setActive(pos);
  }

  return (
    <nav
      aria-label="Table des matières"
      className={cn("flex h-full shrink-0 flex-col bg-background", open ? "w-56" : "w-10")}
    >
      <div className={cn("flex items-center pt-3", open ? "justify-between gap-2 px-3 pb-2" : "justify-center")}>
        {open ? <p className="text-xs font-medium text-muted-foreground">Sur cette page</p> : null}
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-expanded={open}
          aria-label={open ? "Masquer la table des matières" : "Afficher la table des matières"}
          onClick={toggle}
        >
          {open ? <PanelRightClose /> : <PanelRightOpen />}
        </Button>
      </div>
      {open && headings.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-auto">
        <ul className="mx-3 flex flex-col gap-0.5 border-l border-border">
          {headings.map((item) => {
            const current = item.pos === active;
            return (
              <li key={item.pos}>
                <button
                  type="button"
                  title={item.text}
                  aria-current={current ? "location" : undefined}
                  onClick={() => reveal(item.pos)}
                  className={cn(
                    "-ml-px block w-full truncate border-l-2 border-transparent py-1 pr-2 text-left text-xs leading-snug text-muted-foreground hover:text-foreground",
                    current && "border-foreground font-medium text-foreground",
                  )}
                  style={{ paddingLeft: `${12 + (item.level - minLevel) * 12}px` }}
                >
                  {item.text}
                </button>
              </li>
            );
          })}
        </ul>
        </div>
      ) : null}
      {open && headings.length === 0 ? <p className="px-3 text-xs text-muted-foreground">Aucun titre</p> : null}
    </nav>
  );
}
