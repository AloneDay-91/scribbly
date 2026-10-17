import { useRef, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Copy, Trash2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/ContextMenu";

function blockPosAt(editor: Editor, x: number, y: number) {
  const found =
    editor.view.posAtCoords({ left: x, top: y }) ??
    editor.view.posAtCoords({ left: x + 48, top: y });
  if (!found) {
    return null;
  }
  const $pos = editor.state.doc.resolve(found.pos);
  if ($pos.depth < 1) {
    return null;
  }
  let depth = $pos.depth;
  if ($pos.node(depth).type.name === "paragraph" && depth > 1) {
    const parentName = $pos.node(depth - 1).type.name;
    if (parentName === "listItem" || parentName === "taskItem") {
      depth -= 1;
    }
  }
  return $pos.before(depth);
}

function duplicateBlock(editor: Editor, pos: number | null) {
  if (pos == null || pos < 0) {
    return;
  }
  const node = editor.state.doc.nodeAt(pos);
  if (!node) {
    return;
  }
  editor
    .chain()
    .focus()
    .insertContentAt(pos + node.nodeSize, node.toJSON())
    .run();
}

function removeBlock(editor: Editor, pos: number | null) {
  if (pos == null || pos < 0) {
    return;
  }
  const node = editor.state.doc.nodeAt(pos);
  if (!node) {
    return;
  }
  const $pos = editor.state.doc.resolve(pos);
  if ($pos.parent.type.name === "doc" && $pos.parent.childCount <= 1) {
    editor.chain().focus().clearContent().run();
    return;
  }
  if ($pos.parent.childCount <= 1 && $pos.depth > 0) {
    const parentPos = $pos.before($pos.depth);
    if ($pos.depth === 1 && editor.state.doc.childCount <= 1) {
      editor.chain().focus().clearContent().run();
      return;
    }
    editor
      .chain()
      .focus()
      .deleteRange({ from: parentPos, to: parentPos + $pos.parent.nodeSize })
      .run();
    return;
  }
  editor
    .chain()
    .focus()
    .deleteRange({ from: pos, to: pos + node.nodeSize })
    .run();
}

function alignBlock(editor: Editor, pos: number | null, align: "left" | "center" | "right" | "justify") {
  if (pos == null || pos < 0) {
    return;
  }
  editor.chain().focus().setTextSelection(pos + 1).setTextAlign(align).run();
}

function lockHandle(editor: Editor, open: boolean) {
  editor.view.dispatch(editor.state.tr.setMeta("lockDragHandle", open));
}

export function BlockMenu({ editor, children }: { editor: Editor; children: ReactNode }) {
  const blockRef = useRef<number | null>(null);

  return (
    <ContextMenu onOpenChange={(open) => lockHandle(editor, open)}>
      <div
        className="h-full min-h-0"
        onContextMenuCapture={(event) => {
          blockRef.current = blockPosAt(editor, event.clientX, event.clientY);
        }}
      >
        <ContextMenuTrigger className="block h-full min-h-0">{children}</ContextMenuTrigger>
      </div>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onClick={() => alignBlock(editor, blockRef.current, "left")}>
          <AlignLeft />
          Aligner à gauche
        </ContextMenuItem>
        <ContextMenuItem onClick={() => alignBlock(editor, blockRef.current, "center")}>
          <AlignCenter />
          Centrer
        </ContextMenuItem>
        <ContextMenuItem onClick={() => alignBlock(editor, blockRef.current, "right")}>
          <AlignRight />
          Aligner à droite
        </ContextMenuItem>
        <ContextMenuItem onClick={() => alignBlock(editor, blockRef.current, "justify")}>
          <AlignJustify />
          Justifier
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => duplicateBlock(editor, blockRef.current)}>
          <Copy />
          Dupliquer
        </ContextMenuItem>
        <ContextMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
          onClick={() => removeBlock(editor, blockRef.current)}
        >
          <Trash2 />
          Supprimer
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
