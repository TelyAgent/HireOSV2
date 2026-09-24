/**
 * A tiny TipTap editor scoped to exactly one document block. Rather than one continuous
 * ProseMirror document for the whole page (which would need custom NodeViews to keep rendering the
 * existing comment-badge/stale-flag/requirement-ref chrome that already hangs off each `DocBlock`),
 * each block gets its own editor instance whose schema is restricted — via a `Document` node with a
 * fixed `content` expression — to hold exactly one node of that block's kind. That restriction is also
 * what stops Enter from splitting a block into two: this feature intentionally doesn't support
 * adding/removing/reordering blocks yet, only making each existing block's own text genuinely
 * editable (typing, bold, italic, undo).
 */
import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapDocument from "@tiptap/extension-document";
import type { DocBlock } from "../../data/types";

const COMMIT_DEBOUNCE_MS = 400;

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
}: {
  block: DocBlock;
  onTextChange: (text: string | string[]) => void;
  onFocusBlock: () => void;
  onEditorReady: (editor: Editor) => void;
  onEditorDestroy: () => void;
  onActivity: () => void;
}) {
  const commitTimer = useRef<number | undefined>(undefined);
  const latest = useRef({ onTextChange, onFocusBlock, onActivity });
  latest.current = { onTextChange, onFocusBlock, onActivity };

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
      editorProps: { attributes: { class: "rich-block-content" } },
      onUpdate: ({ editor }) => {
        window.clearTimeout(commitTimer.current);
        commitTimer.current = window.setTimeout(() => {
          const html = editor.getHTML();
          latest.current.onTextChange(block.kind === "ul" ? listItemsFromHtml(html) : innerHtmlOfSingleNode(html));
        }, COMMIT_DEBOUNCE_MS);
      },
      onFocus: () => latest.current.onFocusBlock(),
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

  useEffect(() => () => window.clearTimeout(commitTimer.current), []);

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
