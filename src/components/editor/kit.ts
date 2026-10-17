import {
  Extension,
  type Editor,
  type JSONContent,
  type MarkdownParseHelpers,
  type MarkdownRendererHelpers,
  type MarkdownToken,
  type RenderContext,
} from "@tiptap/core";
import Blockquote from "@tiptap/extension-blockquote";
import BulletList from "@tiptap/extension-bullet-list";
import CodeBlock from "@tiptap/extension-code-block";
import Heading from "@tiptap/extension-heading";
import Highlight from "@tiptap/extension-highlight";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import OrderedList from "@tiptap/extension-ordered-list";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { Markdown } from "@tiptap/markdown";
import { ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { DragBlock, ImageBlock, RuleBlock } from "@/components/editor/block-node";
import { SlashCommands } from "@/components/editor/slash-command";

const ALIGNMENTS = ["left", "center", "right", "justify"] as const;
const EMPTY_PARAGRAPH = "&nbsp;";

type NoteStorage = { noteContext?: { path: string } };

export function notePathOf(editor: Editor) {
  return (editor.storage as NoteStorage).noteContext?.path ?? "";
}

export function setNotePath(editor: Editor, path: string) {
  const storage = editor.storage as NoteStorage;
  if (storage.noteContext) {
    storage.noteContext.path = path;
  }
}

function wrapAlign(node: { attrs?: { textAlign?: string | null } }, body: string) {
  const align = node.attrs?.textAlign;
  if (!body || !align || align === "left" || !ALIGNMENTS.some((item) => item === align)) {
    return body;
  }
  return `:::${align}\n${body}\n:::`;
}

function headingTag(level: unknown) {
  switch (level) {
    case 1:
      return "h1";
    case 2:
      return "h2";
    case 3:
      return "h3";
    case 4:
      return "h4";
    case 5:
      return "h5";
    case 6:
      return "h6";
    default:
      return "h1";
  }
}

function dragView(contentDOMElementTag: string) {
  return ReactNodeViewRenderer(DragBlock, { contentDOMElementTag });
}

const AlignedParagraph = Paragraph.extend({
  draggable: true,
  addNodeView() {
    return dragView("p");
  },
  renderMarkdown(node, helpers: MarkdownRendererHelpers, ctx: RenderContext) {
    const content = Array.isArray(node.content) ? node.content : [];
    if (content.length === 0) {
      const previous = ctx.previousNode;
      const previousContent = Array.isArray(previous?.content) ? previous.content : [];
      const body = previous?.type === "paragraph" && previousContent.length === 0 ? EMPTY_PARAGRAPH : "";
      return wrapAlign(node, body);
    }
    return wrapAlign(node, helpers.renderChildren(content));
  },
});

const AlignedHeading = Heading.extend({
  draggable: true,
  addNodeView() {
    return (props) =>
      ReactNodeViewRenderer(DragBlock, {
        contentDOMElementTag: headingTag(props.node.attrs.level),
        update: ({ oldNode, newNode, updateProps }) => {
          if (oldNode.attrs.level !== newNode.attrs.level) {
            return false;
          }
          updateProps();
          return true;
        },
      })(props);
  },
  renderMarkdown(node, helpers: MarkdownRendererHelpers) {
    const level = Number(node.attrs?.level) || 1;
    const marks = "#".repeat(Math.min(Math.max(level, 1), 6));
    const content = Array.isArray(node.content) ? node.content : [];
    return wrapAlign(node, `${marks} ${helpers.renderChildren(content)}`);
  },
}).configure({ levels: [1, 2, 3, 4, 5, 6] });

const AlignBlock = Extension.create({
  name: "alignBlock",
  markdownTokenName: "alignBlock",
  markdownTokenizer: {
    name: "alignBlock",
    level: "block",
    start: (src: string) => src.indexOf(":::"),
    tokenize(src, _tokens, lexer) {
      const match = /^:::(left|center|right|justify)\r?\n([\s\S]*?)\r?\n:::(?:\r?\n|$)/.exec(src);
      if (!match) {
        return;
      }
      return {
        type: "alignBlock",
        raw: match[0],
        align: match[1],
        text: match[2],
        tokens: lexer.blockTokens(match[2]),
      };
    },
  },
  parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
    const children = helpers.parseChildren(token.tokens ?? []);
    return children.map((child) => {
      if (child.type !== "paragraph" && child.type !== "heading") {
        return child;
      }
      return { ...child, attrs: { ...child.attrs, textAlign: token.align } };
    });
  },
});

const NoteContext = Extension.create({
  name: "noteContext",
  addStorage() {
    return { path: "" };
  },
});

const NoteImage = Image.extend({
  draggable: true,
  addNodeView() {
    return ReactNodeViewRenderer(ImageBlock);
  },
}).configure({ allowBase64: true });

const DragQuote = Blockquote.extend({
  draggable: true,
  addNodeView() {
    return dragView("blockquote");
  },
});

const DragBulletList = BulletList.extend({
  draggable: true,
  addNodeView() {
    return dragView("ul");
  },
});

const DragOrderedList = OrderedList.extend({
  draggable: true,
  addNodeView() {
    return dragView("ol");
  },
});

const DragCodeBlock = CodeBlock.extend({
  draggable: true,
  addNodeView() {
    return dragView("pre");
  },
});

const DragRule = HorizontalRule.extend({
  draggable: true,
  addNodeView() {
    return ReactNodeViewRenderer(RuleBlock);
  },
});

const DragTaskList = TaskList.extend({
  draggable: true,
  addNodeView() {
    return dragView("ul");
  },
});

function placeholderFor(name: string, level: unknown) {
  if (name === "heading") {
    if (level === 1 || level === 2 || level === 3 || level === 4 || level === 5 || level === 6) {
      return `Titre ${level}`;
    }
    return "Titre";
  }
  if (name === "paragraph") {
    return "Tapez « / » pour les commandes";
  }
  return "";
}

function htmlMark(tag: "sub" | "sup") {
  return {
    renderMarkdown(node: JSONContent, helpers: MarkdownRendererHelpers) {
      const content = Array.isArray(node.content) ? node.content : [];
      return `<${tag}>${helpers.renderChildren(content)}</${tag}>`;
    },
  };
}

export const editorExtensions = [
  StarterKit.configure({
    link: false,
    paragraph: false,
    heading: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    codeBlock: false,
    horizontalRule: false,
    dropcursor: false,
    trailingNode: false,
  }),
  AlignedParagraph,
  AlignedHeading,
  DragQuote,
  DragBulletList,
  DragOrderedList,
  DragCodeBlock,
  DragRule,
  AlignBlock,
  NoteContext,
  Link.configure({
    openOnClick: false,
    autolink: true,
    markdownLinks: true,
    HTMLAttributes: { target: null, rel: null, class: null },
    shouldAutoLink: (url) => /^https?:\/\//i.test(url) || url.startsWith("mailto:"),
  }),
  NoteImage,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Highlight,
  Subscript.extend(htmlMark("sub")),
  Superscript.extend(htmlMark("sup")),
  TableKit.configure({ table: { resizable: false } }),
  DragTaskList,
  TaskItem.configure({ nested: true }),
  Placeholder.configure({
    showOnlyCurrent: true,
    placeholder: ({ node }) => placeholderFor(node.type.name, node.attrs.level),
  }),
  SlashCommands,
  Markdown.configure({ markedOptions: { gfm: true } }),
];
