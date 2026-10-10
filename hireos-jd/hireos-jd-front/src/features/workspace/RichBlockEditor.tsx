/**
 * A tiny TipTap editor scoped to exactly one document block. Rather than one continuous
 * ProseMirror document for the whole page (which would need custom NodeViews for the per-block chrome
 * — drag handle, visibility tag, delete button), each block gets its own editor instance whose schema
 * is restricted — via a `Document` node with a fixed `content` expression — to hold exactly one node
 * of that block's kind. Block structure is handled by the page instead: Enter in a bullet hands the
 * text after the cursor to `onSplit` (which creates the next bullet block), and Backspace in an empty
 * block calls `onRemoveEmpty`.
 */
import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapDocument from "@tiptap/extension-document";
import { DOMSerializer, type Fragment } from "@tiptap/pm/model";
import type { DocBlock } from "../../data/types";

export const COMMIT_DEBOUNCE_MS = 400;
/** Drag data type used when reordering blocks — editors must not treat such a drop as text to insert. */
export const BLOCK_DRAG_MIME = "application/x-hireos-doc-block";

function initialHtml(block: DocBlock): string {
  if (block.kind === "ul") {
    const items = (block.text as string[]) ?? [];
    return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
  }
  const tag = block.kind;
  return `<${tag}>${(block.text as string) ?? ""}</${tag}>`;
}

/** Pulls the inner HTML out of a single-node TipTap document, e.g. `<p><strong>x</strong></p>` → `<strong>x</strong>`. */
function innerHtmlOfSingleNode(html: string): string {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  return parsed.body.firstElementChild?.innerHTML ?? "";
}

function fragmentHtml(fragment: Fragment, serializer: DOMSerializer): string {
  const div = document.createElement("div");
  div.appendChild(serializer.serializeFragment(fragment));
  return div.innerHTML;
}

function listItemsFromHtml(html: string): string[] {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  return Array.from(parsed.querySelectorAll("li")).map((li) => li.innerHTML);
}

export function RichBlockEditor({
  block,
  onTextChange,
  onFocusBlock,
  onEditorReady,
  onEditorDestroy,
  onActivity,
  onBlurBlock,
  onSplit,
  onRemoveEmpty,
  autoFocus,
  placeholder,
}: {
  block: DocBlock;
  onTextChange: (text: string | string[]) => void;
  onFocusBlock: () => void;
  onEditorReady: (editor: Editor) => void;
  onEditorDestroy: () => void;
  onActivity: () => void;
  /** Called with the editor's final text when it loses focus (Suggesting mode turns it into a proposal). */
  onBlurBlock?: (text: string | string[]) => void;
  /** Bullets only: Enter splits the bullet at the cursor; receives the inline HTML before / after it. */
  onSplit?: (before: string, after: string) => void;
  /** Backspace in an empty block. */
  onRemoveEmpty?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const commitTimer = useRef<number | undefined>(undefined);
  // Last text this editor itself committed — lets the sync effect below tell the editor's own edits
  // apart from changes made outside it (e.g. accepting a Copilot suggestion).
  const lastCommitted = useRef(JSON.stringify(block.text));
  const lastProp = useRef(lastCommitted.current);
  const latest = useRef({ onTextChange, onFocusBlock, onActivity, onBlurBlock, onSplit, onRemoveEmpty });
  latest.current = { onTextChange, onFocusBlock, onActivity, onBlurBlock, onSplit, onRemoveEmpty };
  const readText = (editor: Editor) => {
    const html = editor.getHTML();
    return block.kind === "ul" ? listItemsFromHtml(html) : innerHtmlOfSingleNode(html);
  };

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          document: false,
          blockquote: false,
          code: false,
          codeBlock: false,
          horizontalRule: false,
          orderedList: false,
          strike: false,
          underline: false,
          link: false,
          heading: block.kind === "h2" ? { levels: [2] } : block.kind === "h3" ? { levels: [3] } : false,
          bulletList: block.kind === "ul" ? {} : false,
          listItem: block.kind === "ul" ? {} : false,
          listKeymap: block.kind === "ul" ? {} : false,
        }),
        TiptapDocument.extend({
          content: block.kind === "ul" ? "bulletList" : block.kind === "h2" || block.kind === "h3" ? "heading" : "paragraph",
        }),
      ],
      content: initialHtml(block),
      editorProps: {
        attributes: { class: "rich-block-content", ...(placeholder ? { "data-placeholder": placeholder } : {}) },
        handleDrop: (_view, event) => !!(event as DragEvent).dataTransfer?.types.includes(BLOCK_DRAG_MIME),
        handleKeyDown: (view, event) => {
          // Leave Enter alone while an IME is composing (Chinese input confirms candidates with Enter).
          if (event.isComposing || event.keyCode === 229) return false;
          if (event.key === "Enter" && !event.shiftKey && block.kind === "ul" && latest.current.onSplit) {
            // Read the caret from the DOM: after a native caret move (arrow keys) ProseMirror only syncs
            // its selection on the next selectionchange, which can still be pending at this keydown.
            let { from, to } = view.state.selection;
            const domSel = view.dom.ownerDocument.getSelection();
            if (domSel?.anchorNode && domSel.focusNode && view.dom.contains(domSel.anchorNode) && view.dom.contains(domSel.focusNode)) {
              const a = view.posAtDOM(domSel.anchorNode, domSel.anchorOffset);
              const f = view.posAtDOM(domSel.focusNode, domSel.focusOffset);
              from = Math.min(a, f);
              to = Math.max(a, f);
            }
            const $from = view.state.doc.resolve(from);
            const $to = view.state.doc.resolve(to);
            if ($from.parent !== $to.parent || !$from.parent.isTextblock) return false;
            const serializer = DOMSerializer.fromSchema(view.state.schema);
            const before = fragmentHtml($from.parent.content.cut(0, $from.parentOffset), serializer);
            const after = fragmentHtml($to.parent.content.cut($to.parentOffset), serializer);
            // This editor keeps only the first half; the page inserts a new bullet block for the rest.
            view.dispatch(view.state.tr.delete($from.pos, $to.end()));
            window.clearTimeout(commitTimer.current);
            lastCommitted.current = JSON.stringify([before]);
            latest.current.onSplit(before, after);
            return true;
          }
          // Check the DOM, not the state: a native Backspace that just emptied the block may not be synced yet.
          if (event.key === "Backspace" && latest.current.onRemoveEmpty && !view.dom.textContent) {
            latest.current.onRemoveEmpty();
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        window.clearTimeout(commitTimer.current);
        commitTimer.current = window.setTimeout(() => {
          const text = readText(editor);
          lastCommitted.current = JSON.stringify(text);
          latest.current.onTextChange(text);
        }, COMMIT_DEBOUNCE_MS);
      },
      autofocus: autoFocus ? "end" : false,
      onFocus: () => latest.current.onFocusBlock(),
      onBlur: ({ editor }) => latest.current.onBlurBlock?.(readText(editor)),
      onSelectionUpdate: () => latest.current.onActivity(),
      onTransaction: () => latest.current.onActivity(),
    },
    [block.id, block.kind],
  );

  useEffect(() => {
    if (!editor) return;
    onEditorReady(editor);
    return () => onEditorDestroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // The editor is uncontrolled after mount, so push in block text that changed from outside.
  useEffect(() => {
    if (!editor) return;
    const next = JSON.stringify(block.text);
    // Only react to the prop actually changing, and not to it catching up with our own commit.
    if (next === lastProp.current) return;
    lastProp.current = next;
    if (next === lastCommitted.current) return;
    lastCommitted.current = next;
    window.clearTimeout(commitTimer.current);
    editor.commands.setContent(initialHtml(block), { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, block.text]);

  useEffect(() => () => window.clearTimeout(commitTimer.current), []);

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
