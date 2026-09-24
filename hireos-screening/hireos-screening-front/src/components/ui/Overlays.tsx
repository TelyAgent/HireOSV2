import { Modal as AntModal, Drawer as AntDrawer } from "antd";
import type { ReactNode } from "react";
import { Icon } from "./Icons";
import { Button } from "./Primitives";
import { useStore } from "../../store/StoreContext";

/**
 * Thin wrappers over AntD Modal/Drawer that reproduce the prototype's own
 * header/body/footer chrome (`.modal-header`/`.modal-body`/`.modal-footer`,
 * `.drawer-header`/`.drawer-body`/`.drawer-footer`) so every feature modal
 * looks identical to the source design system while still getting AntD's
 * portal, focus-trap and escape/overlay-click handling for free.
 */
export function Modal({
  open,
  onClose,
  title,
  wide,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AntModal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      destroyOnHidden
      width={wide ? 760 : 640}
      styles={{ content: { padding: 0, borderRadius: 18, overflow: "hidden" }, mask: { background: "rgba(15,23,42,.44)" } }}
    >
      <div className="modal-header">
        <h3 className="modal-title">{title}</h3>
        <button className="close-x" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </AntModal>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}) {
  const { t } = useStore();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t(cancelLabel ?? "Cancel")}
          </Button>
          <Button
            variant={danger ? "danger-solid" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {t(confirmLabel ?? "Confirm")}
          </Button>
        </>
      }
    >
      {typeof body === "string" ? <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>{body}</p> : body}
    </Modal>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AntDrawer
      open={open}
      onClose={onClose}
      closable={false}
      destroyOnHidden
      width={520}
      styles={{ body: { padding: 0 }, mask: { background: "rgba(15,23,42,.44)" } }}
    >
      <div className="drawer-header">
        <h3 className="modal-title">{title}</h3>
        <button className="close-x" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="drawer-body">{children}</div>
      {footer && <div className="drawer-footer">{footer}</div>}
    </AntDrawer>
  );
}
