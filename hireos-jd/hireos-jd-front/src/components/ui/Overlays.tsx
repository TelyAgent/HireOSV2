import { useEffect, useRef, type ReactNode } from "react";
import { useStore } from "../../store/StoreContext";
import { Button } from "./Primitives";
import { Icon } from "./Icons";

/**
 * Renders the overlay stack pushed through `openModal` / `openDrawer`.
 * Each entry is a React element that reads the store itself, so overlays stay
 * live as state changes — the prototype re-rendered overlay HTML by hand.
 */
export function OverlayHost() {
  const { overlays, closeModal } = useStore();
  return (
    <>
      {overlays.map((o) => (
        <div
          key={o.id}
          className={`overlay${o.overlayClass ? " " + o.overlayClass : ""}`}
          tabIndex={-1}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          {o.kind === "modal" ? (
            <div className={`modal-wrap${o.wide ? " wide" : ""}${o.xwide ? " xwide" : ""}`}>{o.node}</div>
          ) : (
            <DrawerShell entry={o}>{o.node}</DrawerShell>
          )}
        </div>
      ))}
    </>
  );
}

const GEMINI_WIDTH_KEY = "hireos-jd-gemini-width";

function DrawerShell({
  entry,
  children,
}: {
  entry: { wide?: boolean; drawerClass?: string };
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const resizable = entry.drawerClass === "gemini-drawer-shell";

  // Restore the persisted Copilot sidebar width (per-viewer convenience only).
  useEffect(() => {
    if (!resizable || !ref.current) return;
    try {
      const saved = Number(localStorage.getItem(GEMINI_WIDTH_KEY));
      if (saved) {
        const clamped = Math.max(360, Math.min(saved, Math.round(window.innerWidth * 0.85)));
        ref.current.style.setProperty("--gemini-width", clamped + "px");
      }
    } catch {
      // localStorage unavailable — fall back to the CSS default width.
    }
  }, [resizable]);

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const drawer = ref.current;
    const handle = e.currentTarget as HTMLElement;
    if (!drawer) return;
    handle.classList.add("is-dragging");
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: PointerEvent) => {
      const max = Math.min(900, Math.round(window.innerWidth * 0.85));
      const width = Math.max(360, Math.min(max, window.innerWidth - ev.clientX));
      drawer.style.setProperty("--gemini-width", width + "px");
    };
    const onUp = () => {
      handle.classList.remove("is-dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem(GEMINI_WIDTH_KEY, String(parseInt(getComputedStyle(drawer).width, 10)));
      } catch {
        // Width just won't persist.
      }
      window.removeEventListener("pointermove", onMove);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <div ref={ref} className={`drawer${entry.wide ? " wide" : ""}${entry.drawerClass ? " " + entry.drawerClass : ""}`}>
      {resizable && (
        <div
          className="gemini-resize-handle"
          role="separator"
          aria-label="Resize Copilot sidebar"
          title="Drag to resize"
          onPointerDown={startDrag}
        />
      )}
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------
   Modal / drawer chrome
   --------------------------------------------------------------- */
export function ModalHeader({ title }: { title: ReactNode }) {
  const { closeModal, t } = useStore();
  return (
    <div className="modal-header">
      <h3 className="modal-title">{title}</h3>
      <button className="close-x" onClick={closeModal} aria-label={t("Close")}>
        <Icon name="close" />
      </button>
    </div>
  );
}

export function ModalBody({ children }: { children: ReactNode }) {
  return <div className="modal-body">{children}</div>;
}

export function ModalFooter({ children, spread }: { children: ReactNode; spread?: boolean }) {
  return (
    <div className="modal-footer" style={spread ? { justifyContent: "space-between" } : undefined}>
      {children}
    </div>
  );
}

export function DrawerHeader({ title }: { title: ReactNode }) {
  const { closeModal, t } = useStore();
  return (
    <div className="drawer-header">
      <h3 className="modal-title">{title}</h3>
      <button className="close-x" onClick={closeModal} aria-label={t("Close")}>
        <Icon name="close" />
      </button>
    </div>
  );
}

export function DrawerBody({ children }: { children: ReactNode }) {
  return <div className="drawer-body">{children}</div>;
}

export function DrawerFooter({ children }: { children: ReactNode }) {
  return <div className="drawer-footer">{children}</div>;
}

export function CloseButton() {
  const { closeModal, t } = useStore();
  return (
    <Button variant="secondary" onClick={closeModal}>
      {t("Close")}
    </Button>
  );
}

export function CancelButton() {
  const { closeModal, t } = useStore();
  return (
    <Button variant="secondary" onClick={closeModal}>
      {t("Cancel")}
    </Button>
  );
}

/** Port of the prototype's `confirmDialog(title, body, confirmLabel, onConfirm, danger)`. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  danger,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
}) {
  const { closeModal } = useStore();
  return (
    <>
      <ModalHeader title={title} />
      <ModalBody>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}>{body}</div>
      </ModalBody>
      <ModalFooter>
        <CancelButton />
        <Button
          variant={danger ? "danger-solid" : "primary"}
          onClick={() => {
            closeModal();
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
      </ModalFooter>
    </>
  );
}
