"use client";

import { Modal } from "./modal";
import { Button } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

/** Diálogo de confirmación construido sobre <Modal>. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "¿Confirmar acción?",
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:flex-1"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
            className="w-full sm:flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {description && (
        <p className="text-body-md text-on-surface-variant">{description}</p>
      )}
    </Modal>
  );
}