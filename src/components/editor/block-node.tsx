import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { GripVertical, Plus } from "lucide-react";
import { displaySrc } from "@/lib/images";

function insertBelow(editor: Editor, pos: number | undefined) {
  if (pos == null || pos < 0) {
    return;
  }
  const node = editor.state.doc.nodeAt(pos);
  if (!node) {
    return;
  }
  const at = pos + node.nodeSize;
  editor.chain().focus().insertContentAt(at, { type: "paragraph" }).setTextSelection(at + 1).run();
  editor.chain().focus().insertContent("/").run();
}

function isTopLevel(editor: Editor, getPos: () => number | undefined) {
  const pos = getPos();
  if (typeof pos !== "number") {
    return false;
  }
  return editor.state.doc.resolve(pos).depth === 0;
}

function BlockControls({ editor, getPos }: { editor: Editor; getPos: () => number | undefined }) {
  if (!isTopLevel(editor, getPos)) {
    return null;
  }
  return (
    <div className="block-node-controls" contentEditable={false}>
      <div
        role="button"
        tabIndex={-1}
        aria-label="Insérer un bloc"
        className="notion-block-button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => insertBelow(editor, getPos())}
      >
        <Plus />
      </div>
      <div data-drag-handle="" aria-label="Déplacer le bloc" className="notion-block-button notion-block-grip">
        <GripVertical />
      </div>
    </div>
  );
}

export function DragBlock({ editor, node, getPos }: NodeViewProps) {
  const align = node.attrs.textAlign;
  const textAlign = align === "center" || align === "right" || align === "justify" ? align : undefined;
  return (
    <NodeViewWrapper className="block-node" style={textAlign ? { textAlign } : undefined}>
      <BlockControls editor={editor} getPos={getPos} />
      <NodeViewContent />
    </NodeViewWrapper>
  );
}

export function RuleBlock({ editor, getPos }: NodeViewProps) {
  return (
    <NodeViewWrapper className="block-node">
      <BlockControls editor={editor} getPos={getPos} />
      <hr />
    </NodeViewWrapper>
  );
}

function notePath(editor: Editor) {
  const storage = editor.storage as { noteContext?: { path?: string } };
  return storage.noteContext?.path ?? "";
}

export function ImageBlock({ editor, node, getPos }: NodeViewProps) {
  const source = String(node.attrs.src ?? "");
  const [src, setSrc] = useState(source);

  useEffect(() => {
    let cancelled = false;
    void displaySrc(notePath(editor), source).then((resolved) => {
      if (!cancelled) {
        setSrc(resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [editor, source]);

  return (
    <NodeViewWrapper className="block-node">
      <BlockControls editor={editor} getPos={getPos} />
      <img src={src} alt={String(node.attrs.alt ?? "")} draggable={false} />
    </NodeViewWrapper>
  );
}
