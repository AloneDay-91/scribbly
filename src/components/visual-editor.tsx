import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
} from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Bold,
  Code,
  Highlighter,
  Italic,
  Link2,
  Redo2,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table2,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { BlockMenu } from "@/components/editor/block-handle";
import { installDragLog } from "@/components/editor/drag-log";
import { TableOfContents } from "@/components/editor/table-of-contents";
import { editorExtensions, setNotePath } from "@/components/editor/kit";
import { Button } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { FieldDescription } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip";
import { popupClassName } from "@/components/ui/styles";
import { Typography } from "@/components/ui/Typography";
import { reportError } from "@/lib/errors";
import { imageFiles, storeImages } from "@/lib/images";
import { resolveNoteHref } from "@/lib/notes";
import { modKey } from "@/lib/platform";
import { cn } from "@/lib/utils";

type VisualEditorProps = {
  markdown: string;
  path: string;
  fontSize: number;
  onChange: (markdown: string) => void;
  onOpenNote: (path: string, newTab?: boolean) => void;
};

const editorDeps = [0];

function keepSelection(event: { preventDefault: () => void }) {
  event.preventDefault();
}

export function VisualEditor({
  markdown,
  path,
  fontSize,
  onChange,
  onOpenNote,
}: VisualEditorProps) {
  const initial = useRef(markdown);
  const onChangeRef = useRef(onChange);
  const pathRef = useRef(path);
  const onOpenNoteRef = useRef(onOpenNote);
  const baseline = useRef<string | null>(null);
  const insertImagesRef = useRef<(files: File[], at?: number) => void>(
    () => {},
  );
  const [imageOpen, setImageOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  onChangeRef.current = onChange;
  pathRef.current = path;
  onOpenNoteRef.current = onOpenNote;

  const editorProps = useMemo(
    () => ({
      attributes: {
        class:
          "note tiptap-doc mx-auto min-h-[70vh] w-full max-w-3xl px-16 py-12 text-left outline-none",
        "aria-label": "Éditeur de la note",
        spellcheck: "true",
      },
      handleClick: (_view: unknown, _pos: number, event: MouseEvent) => {
        if (!(event.target instanceof Element)) {
          return false;
        }
        const anchor = event.target.closest("a");
        if (!(anchor instanceof HTMLAnchorElement)) {
          return false;
        }
        const href = anchor.getAttribute("href");
        if (!href) {
          return false;
        }
        const notePath = resolveNoteHref(pathRef.current, href);
        if (notePath) {
          event.preventDefault();
          onOpenNoteRef.current(notePath, event.metaKey || event.ctrlKey);
          return true;
        }
        if (/^https?:\/\//i.test(href)) {
          event.preventDefault();
          void openUrl(href);
          return true;
        }
        return false;
      },
      handlePaste: (_view: unknown, event: ClipboardEvent) => {
        const files = imageFiles(event.clipboardData?.files);
        if (files.length === 0) {
          return false;
        }
        event.preventDefault();
        insertImagesRef.current(files);
        return true;
      },
      handleDrop: (
        view: {
          posAtCoords: (coords: {
            left: number;
            top: number;
          }) => { pos: number } | null;
        },
        event: DragEvent,
      ) => {
        const files = imageFiles(event.dataTransfer?.files);
        if (files.length === 0) {
          return false;
        }
        event.preventDefault();
        const coords = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        insertImagesRef.current(files, coords?.pos);
        return true;
      },
    }),
    [],
  );

  const editor = useEditor(
    {
      extensions: editorExtensions,
      content: initial.current,
      contentType: "markdown",
      autofocus: "end",
      editorProps,
      onCreate: ({ editor: current }) => {
        baseline.current = current.getMarkdown();
      },
      onUpdate: ({ editor: current }) => {
        const next = current.getMarkdown();
        if (baseline.current === null) {
          baseline.current = next;
          return;
        }
        if (next === baseline.current) {
          return;
        }
        baseline.current = next;
        onChangeRef.current(next);
      },
    },
    editorDeps,
  );

  useEffect(() => {
    if (!editor) {
      return;
    }
    const open = () => setImageOpen(true);
    editor.view.dom.addEventListener("scribbly-insert-image", open);
    const removeDragLog = installDragLog(editor);
    return () => {
      editor.view.dom.removeEventListener("scribbly-insert-image", open);
      removeDragLog();
    };
  }, [editor]);

  if (editor) {
    setNotePath(editor, path);
    insertImagesRef.current = (files, at) => {
      void storeImages(pathRef.current, files)
        .then((images) => {
          if (images.length === 0) {
            return;
          }
          let chain = editor.chain().focus();
          if (at != null) {
            chain = chain.setTextSelection(at);
          }
          for (const image of images) {
            chain = chain.setImage({ src: image.src, alt: image.alt });
          }
          chain.run();
        })
        .catch((err: unknown) => {
          reportError("Impossible d'ajouter l'image", err);
        });
    };
  }

  if (!editor) {
    return null;
  }

  return (
    <div
      className="visual-editor flex h-full min-h-0 w-full"
      style={{ fontSize }}
    >
      <div className="min-h-0 min-w-0 flex-1">
        <BlockMenu editor={editor}>
          <div
            ref={scrollerRef}
            className="h-full overflow-auto mx-auto flex items-center justify-center"
          >
            <Typography className="h-full">
              <EditorContent className="w-full" editor={editor} />
            </Typography>
          </div>
        </BlockMenu>
      </div>
      <TableOfContents editor={editor} scroller={scrollerRef} />
      <SelectionMenu editor={editor} />
      <ImageDialog
        open={imageOpen}
        onOpenChange={setImageOpen}
        onFiles={(files) => insertImagesRef.current(files)}
        onUrl={(src) => {
          editor.chain().focus().setImage({ src, alt: "" }).run();
        }}
      />
    </div>
  );
}

function SelectionMenu({ editor }: { editor: Editor }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) {
        return null;
      }
      const align =
        current.getAttributes("paragraph").textAlign ||
        current.getAttributes("heading").textAlign;
      return {
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        underline: current.isActive("underline"),
        strike: current.isActive("strike"),
        code: current.isActive("code"),
        highlight: current.isActive("highlight"),
        subscript: current.isActive("subscript"),
        superscript: current.isActive("superscript"),
        link: current.isActive("link"),
        table: current.isActive("table"),
        align: typeof align === "string" && align ? align : "left",
      };
    },
  });

  if (!active) {
    return null;
  }

  return (
    <BubbleMenu
      editor={editor}
      appendTo={() => document.body}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: current, from, to }) =>
        !current.isActive("codeBlock") &&
        (from !== to || current.isActive("table"))
      }
      className={cn(
        popupClassName,
        "flex max-w-xl flex-wrap items-center gap-0.5 p-1",
      )}
    >
      <MarkButton
        label="Annuler"
        pressed={false}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 />
      </MarkButton>
      <MarkButton
        label="Rétablir"
        pressed={false}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 />
      </MarkButton>
      <MenuDivider />
      <MarkButton
        label={`Gras · ${modKey}B`}
        pressed={active.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold />
      </MarkButton>
      <MarkButton
        label={`Italique · ${modKey}I`}
        pressed={active.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </MarkButton>
      <MarkButton
        label={`Souligné · ${modKey}U`}
        pressed={active.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon />
      </MarkButton>
      <MarkButton
        label="Barré"
        pressed={active.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough />
      </MarkButton>
      <MarkButton
        label="Code"
        pressed={active.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code />
      </MarkButton>
      <MarkButton
        label="Surligné"
        pressed={active.highlight}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        <Highlighter />
      </MarkButton>
      <MarkButton
        label="Indice"
        pressed={active.subscript}
        onClick={() => editor.chain().focus().toggleSubscript().run()}
      >
        <SubscriptIcon />
      </MarkButton>
      <MarkButton
        label="Exposant"
        pressed={active.superscript}
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
      >
        <SuperscriptIcon />
      </MarkButton>
      <LinkButton editor={editor} active={active.link} />
      <MenuDivider />
      <MarkButton
        label="Gauche"
        pressed={active.align === "left"}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft />
      </MarkButton>
      <MarkButton
        label="Centré"
        pressed={active.align === "center"}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter />
      </MarkButton>
      <MarkButton
        label="Droite"
        pressed={active.align === "right"}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight />
      </MarkButton>
      <MarkButton
        label="Justifié"
        pressed={active.align === "justify"}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      >
        <AlignJustify />
      </MarkButton>
      {active.table ? (
        <>
          <MenuDivider />
          <MarkButton
            label="Ligne au-dessus"
            pressed={false}
            onClick={() => editor.chain().focus().addRowBefore().run()}
          >
            <BetweenHorizontalStart />
          </MarkButton>
          <MarkButton
            label="Ligne en dessous"
            pressed={false}
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            <BetweenHorizontalEnd />
          </MarkButton>
          <MarkButton
            label="Colonne avant"
            pressed={false}
            onClick={() => editor.chain().focus().addColumnBefore().run()}
          >
            <BetweenVerticalStart />
          </MarkButton>
          <MarkButton
            label="Colonne après"
            pressed={false}
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            <BetweenVerticalEnd />
          </MarkButton>
          <MarkButton
            label="Supprimer la ligne"
            pressed={false}
            onClick={() => editor.chain().focus().deleteRow().run()}
          >
            <Trash2 />
          </MarkButton>
          <MarkButton
            label="Supprimer le tableau"
            pressed={false}
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <Table2 />
          </MarkButton>
        </>
      ) : null}
    </BubbleMenu>
  );
}

function MenuDivider() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />;
}

function MarkButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={label}
            aria-pressed={pressed}
            onMouseDown={keepSelection}
            onClick={onClick}
            className={pressed ? "bg-muted text-foreground" : undefined}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function LinkButton({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");

  function onOpenChange(next: boolean) {
    if (next) {
      const current = editor.getAttributes("link").href;
      setHref(typeof current === "string" ? current : "");
    }
    setOpen(next);
  }

  function apply(event: FormEvent) {
    event.preventDefault();
    const value = href.trim();
    const chain = editor.chain().focus();
    if (!value) {
      chain.unsetLink().run();
    } else if (editor.state.selection.empty) {
      chain
        .insertContent({
          type: "text",
          text: value,
          marks: [{ type: "link", attrs: { href: value } }],
        })
        .run();
    } else {
      chain.extendMarkRange("link").setLink({ href: value }).run();
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Lien"
                  aria-pressed={active}
                  onMouseDown={keepSelection}
                  className={active ? "bg-muted text-foreground" : undefined}
                />
              }
            />
          }
        >
          <Link2 />
        </TooltipTrigger>
        <TooltipContent>Lien</TooltipContent>
      </Tooltip>
      <PopoverContent align="center" className="w-80 p-3">
        <form className="flex flex-col gap-3" onSubmit={apply}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-link">Adresse</Label>
            <Input
              id="note-link"
              value={href}
              placeholder="https://… ou note.md"
              onChange={(event) => setHref(event.target.value)}
            />
            <FieldDescription>
              Lien web, ou chemin vers une note Markdown.
            </FieldDescription>
          </div>
          <ButtonGroup className="justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!active && !href}
              onClick={() => {
                editor.chain().focus().unsetLink().run();
                setOpen(false);
              }}
            >
              Retirer
            </Button>
            <Button type="submit" size="sm">
              Appliquer
            </Button>
          </ButtonGroup>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function ImageDialog({
  open,
  onOpenChange,
  onFiles,
  onUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFiles: (files: File[]) => void;
  onUrl: (src: string) => void;
}) {
  const [href, setHref] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function applyUrl(event: FormEvent) {
    event.preventDefault();
    const value = href.trim();
    if (!value) {
      return;
    }
    onUrl(value);
    setHref("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Insérer une image</DialogTitle>
          <DialogDescription>
            Un fichier du disque, ou l'adresse d'une image.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const files = imageFiles(event.target.files);
              event.target.value = "";
              if (files.length === 0) {
                return;
              }
              onFiles(files);
              onOpenChange(false);
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
          >
            Choisir un fichier
          </Button>
          <form className="flex flex-col gap-3" onSubmit={applyUrl}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note-image-url">Adresse</Label>
              <Input
                id="note-image-url"
                value={href}
                placeholder="https://…"
                onChange={(event) => setHref(event.target.value)}
              />
            </div>
            <ButtonGroup className="justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit" size="sm" disabled={!href.trim()}>
                Insérer
              </Button>
            </ButtonGroup>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
