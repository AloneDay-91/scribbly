import type { Editor } from "@tiptap/core";
import type { Slice } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import { dropPoint } from "@tiptap/pm/transform";

type ViewDesc = {
  posBefore: number;
  parent: ViewDesc | null;
};

type Gesture = {
  from: number;
  slice: Slice;
  pointerId: number;
};

function positionBefore(editor: Editor, handle: HTMLElement) {
  let dom: HTMLElement | null = handle.closest("[data-node-view-wrapper]")?.parentElement ?? null;
  while (dom && dom !== editor.view.dom) {
    const desc = (dom as HTMLElement & { pmViewDesc?: ViewDesc }).pmViewDesc;
    if (desc?.parent) {
      const node = editor.state.doc.nodeAt(desc.posBefore);
      if (node?.isBlock) {
        return desc.posBefore;
      }
    }
    dom = dom.parentElement;
  }
  return null;
}

function pointPosition(editor: Editor, x: number, y: number) {
  const view = editor.view;
  const box = view.dom.getBoundingClientRect();
  if (y < box.top || y > box.bottom) {
    return null;
  }
  const clampedX = Math.min(Math.max(x, box.left + 24), box.right - 24);
  return view.posAtCoords({ left: clampedX, top: y })?.pos ?? null;
}

function lineBox(editor: Editor, pos: number) {
  const view = editor.view;
  const $pos = view.state.doc.resolve(pos);
  const before = $pos.nodeBefore;
  const after = $pos.nodeAfter;
  if ($pos.parent.inlineContent || (!before && !after)) {
    const coords = view.coordsAtPos(pos);
    const column = view.dom.getBoundingClientRect();
    return { left: column.left + 64, top: coords.top, width: Math.max(80, column.width - 128) };
  }
  const beforeDom = before ? view.nodeDOM(pos - before.nodeSize) : null;
  const afterDom = after ? view.nodeDOM(pos) : null;
  const beforeBox = beforeDom instanceof HTMLElement ? beforeDom.getBoundingClientRect() : null;
  const afterBox = afterDom instanceof HTMLElement ? afterDom.getBoundingClientRect() : null;
  if (!beforeBox && !afterBox) {
    return null;
  }
  const anchor = beforeBox ?? afterBox;
  if (!anchor) {
    return null;
  }
  const top =
    beforeBox && afterBox ? (beforeBox.bottom + afterBox.top) / 2 : beforeBox ? beforeBox.bottom : anchor.top;
  return { left: anchor.left, top, width: anchor.width };
}

function dropLine() {
  let line = document.querySelector<HTMLElement>(".scribbly-drop-line");
  if (!line) {
    line = document.createElement("div");
    line.className = "scribbly-drop-line";
    document.body.append(line);
  }
  return line;
}

function hideDropLine() {
  dropLine().classList.remove("is-visible");
}

function showDropLine(editor: Editor, slice: Slice, x: number, y: number) {
  const raw = pointPosition(editor, x, y);
  const pos = raw == null ? null : (dropPoint(editor.state.doc, raw, slice) ?? raw);
  const box = pos == null ? null : lineBox(editor, pos);
  const line = dropLine();
  if (!box) {
    line.classList.remove("is-visible");
    return;
  }
  line.classList.add("is-visible");
  line.style.left = `${box.left}px`;
  line.style.top = `${box.top}px`;
  line.style.width = `${box.width}px`;
}

function moveBlock(editor: Editor, from: number, slice: Slice, x: number, y: number) {
  const node = slice.content.firstChild;
  const raw = pointPosition(editor, x, y);
  if (!node || raw == null) {
    return;
  }
  const target = dropPoint(editor.state.doc, raw, slice) ?? raw;
  const end = from + node.nodeSize;
  if (target >= from && target <= end) {
    return;
  }
  const tr = editor.state.tr.delete(from, end);
  tr.insert(tr.mapping.map(target), node);
  editor.view.dispatch(tr);
}

/** Pointer gesture so the drop line paints. WebKit does not repaint during a native drag. */
export function installDragLog(editor: Editor) {
  const root = editor.view.dom;
  let gesture: Gesture | null = null;

  const end = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.pointerId) {
      return;
    }
    const current = gesture;
    gesture = null;
    document.body.classList.remove("is-block-dragging");
    hideDropLine();
    moveBlock(editor, current.from, current.slice, event.clientX, event.clientY);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element) || !root.contains(target)) {
      return;
    }
    const handle = target.closest<HTMLElement>("[data-drag-handle]");
    if (!handle) {
      return;
    }
    const from = positionBefore(editor, handle);
    if (from == null) {
      console.warn("[glisser] position du bloc introuvable");
      return;
    }
    let selection: NodeSelection;
    try {
      selection = NodeSelection.create(editor.state.doc, from);
    } catch (err: unknown) {
      console.warn("[glisser] ce bloc ne peut pas être sélectionné", err);
      return;
    }
    event.preventDefault();
    try {
      handle.setPointerCapture(event.pointerId);
    } catch (err: unknown) {
      console.warn("[glisser] capture du pointeur refusée", err);
    }
    gesture = { from, slice: selection.content(), pointerId: event.pointerId };
    document.body.classList.add("is-block-dragging");
    showDropLine(editor, gesture.slice, event.clientX, event.clientY);
    console.log("[glisser] suivi du curseur", { pos: from, type: selection.node.type.name });
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.pointerId) {
      return;
    }
    showDropLine(editor, gesture.slice, event.clientX, event.clientY);
  };

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  return () => {
    gesture = null;
    document.body.classList.remove("is-block-dragging");
    hideDropLine();
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", end);
  };
}
