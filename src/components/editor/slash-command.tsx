import { useEffect, useImperativeHandle, useState, type Ref } from "react";
import { Extension, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Image as ImageIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  SquareCode,
  Table2,
  TextQuote,
  Type,
  WrapText,
  type LucideIcon,
} from "lucide-react";
import { menuItemClassName, popupClassName } from "@/components/ui/styles";
import { cn } from "@/lib/utils";

type SlashItem = {
  id: string;
  group: string;
  title: string;
  hint: string;
  keywords: string;
  icon: LucideIcon;
  run: (editor: Editor, range: Range) => void;
};

function alignItem(id: string, title: string, align: "left" | "center" | "right" | "justify", icon: LucideIcon): SlashItem {
  return {
    id,
    group: "Alignement",
    title,
    hint: "Le bloc courant",
    keywords: `align ${align} alignement`,
    icon,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setTextAlign(align).run(),
  };
}

const slashItems: SlashItem[] = [
  {
    id: "text",
    group: "Texte",
    title: "Texte",
    hint: "Paragraphe",
    keywords: "paragraph texte",
    icon: Type,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    id: "h1",
    group: "Texte",
    title: "Titre 1",
    hint: "Grand titre",
    keywords: "heading h1 titre",
    icon: Heading1,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    group: "Texte",
    title: "Titre 2",
    hint: "Titre de section",
    keywords: "heading h2 titre",
    icon: Heading2,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    group: "Texte",
    title: "Titre 3",
    hint: "Petit titre",
    keywords: "heading h3 titre",
    icon: Heading3,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    id: "h4",
    group: "Texte",
    title: "Titre 4",
    hint: "Titre mineur",
    keywords: "heading h4 titre",
    icon: Heading4,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHeading({ level: 4 }).run(),
  },
  {
    id: "h5",
    group: "Texte",
    title: "Titre 5",
    hint: "Titre mineur",
    keywords: "heading h5 titre",
    icon: Heading5,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHeading({ level: 5 }).run(),
  },
  {
    id: "h6",
    group: "Texte",
    title: "Titre 6",
    hint: "Le plus petit titre",
    keywords: "heading h6 titre",
    icon: Heading6,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHeading({ level: 6 }).run(),
  },
  {
    id: "quote",
    group: "Texte",
    title: "Citation",
    hint: "Bloc en exergue",
    keywords: "quote blockquote citation",
    icon: TextQuote,
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: "bullet",
    group: "Listes",
    title: "Liste à puces",
    hint: "Liste simple",
    keywords: "bullet list puce",
    icon: List,
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: "ordered",
    group: "Listes",
    title: "Liste numérotée",
    hint: "Liste ordonnée",
    keywords: "ordered number numero",
    icon: ListOrdered,
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: "task",
    group: "Listes",
    title: "Liste de tâches",
    hint: "Cases à cocher",
    keywords: "todo task check",
    icon: ListChecks,
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    id: "code",
    group: "Blocs",
    title: "Code",
    hint: "Bloc de code",
    keywords: "code pre",
    icon: SquareCode,
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    id: "rule",
    group: "Blocs",
    title: "Séparateur",
    hint: "Ligne horizontale",
    keywords: "hr rule divider separateur",
    icon: Minus,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    id: "break",
    group: "Blocs",
    title: "Saut de ligne",
    hint: "Dans le paragraphe",
    keywords: "break hard line saut",
    icon: WrapText,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHardBreak().run(),
  },
  {
    id: "table",
    group: "Blocs",
    title: "Tableau",
    hint: "3 colonnes",
    keywords: "table tableau",
    icon: Table2,
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: "image",
    group: "Blocs",
    title: "Image",
    hint: "Fichier ou lien",
    keywords: "image photo img",
    icon: ImageIcon,
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      editor.view.dom.dispatchEvent(new CustomEvent("scribbly-insert-image", { bubbles: true }));
    },
  },
  alignItem("align-left", "Aligner à gauche", "left", AlignLeft),
  alignItem("align-center", "Centrer", "center", AlignCenter),
  alignItem("align-right", "Aligner à droite", "right", AlignRight),
  alignItem("align-justify", "Justifier", "justify", AlignJustify),
];

function filterSlashItems(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return slashItems;
  }
  return slashItems.filter((item) => `${item.title} ${item.hint} ${item.keywords}`.toLowerCase().includes(needle));
}

type SlashMenuHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

function SlashMenu({
  ref,
  items,
  command,
}: {
  ref?: Ref<SlashMenuHandle>;
  items: SlashItem[];
  command: (item: SlashItem) => void;
}) {
  const [index, setIndex] = useState(0);
  const selected = items.length === 0 ? 0 : index % items.length;

  useEffect(() => {
    setIndex(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) {
        return false;
      }
      if (event.key === "ArrowDown") {
        setIndex((current) => (current + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setIndex((current) => (current - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[selected];
        if (item) {
          command(item);
        }
        return true;
      }
      return false;
    },
  }));

  return (
    <div className={cn(popupClassName, "w-72 overflow-hidden p-1")}>
      <div className="max-h-80 overflow-y-auto" role="listbox" aria-label="Insérer un bloc">
        {items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Aucun bloc</p>
        ) : (
          items.map((item, itemIndex) => {
            const Icon = item.icon;
            const active = itemIndex === selected;
            const showGroup = itemIndex === 0 || items[itemIndex - 1]?.group !== item.group;
            return (
              <div key={item.id}>
                {showGroup ? (
                  <p className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {item.group}
                  </p>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  ref={
                    active
                      ? (node) => {
                          node?.scrollIntoView({ block: "nearest" });
                        }
                      : undefined
                  }
                  data-highlighted={active ? "" : undefined}
                  className={cn(menuItemClassName, "w-full text-left")}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setIndex(itemIndex)}
                  onClick={() => command(item)}
                >
                  <Icon />
                  <span className="min-w-0 flex-1">
                    <span className="block">{item.title}</span>
                    <span className="block text-muted-foreground">{item.hint}</span>
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export const SlashCommands = Extension.create({
  name: "slashCommands",
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: "/",
        pluginKey: new PluginKey("slashCommands"),
        allowedPrefixes: null,
        decorationClass: "slash-query",
        items: ({ query }) => filterSlashItems(query),
        command: ({ editor, range, props }) => {
          props.run(editor, range);
        },
        render: () => {
          let renderer: ReactRenderer<SlashMenuHandle> | null = null;
          let unmount: (() => void) | null = null;
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenu, {
                props,
                editor: props.editor,
              });
              renderer.element.style.zIndex = "50";
              unmount = props.mount(renderer.element);
            },
            onUpdate: (props) => {
              renderer?.updateProps(props);
            },
            onKeyDown: (props) => renderer?.ref?.onKeyDown(props) ?? false,
            onExit: () => {
              unmount?.();
              unmount = null;
              renderer?.destroy();
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});
