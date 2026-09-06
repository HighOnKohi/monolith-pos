import { memo } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  warning?: string        // optional extra warning line in red
  confirmLabel?: string
  cancelLabel?: string
  isDanger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmModal = memo(function ConfirmModal({
  isOpen, title, message, warning, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  isDanger = true, onConfirm, onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="menu-modal-overlay" role="dialog" aria-modal="true">
      <div className="confirm-modal-panel">
        <header className="confirm-modal-header">
          <h2>{title}</h2>
          <button type="button" className="menu-modal-close" onClick={onCancel} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="confirm-modal-body">
          {isDanger && <AlertTriangle className="confirm-modal-icon" />}
          <p className="confirm-modal-message">{message}</p>
          {warning && <p className="confirm-modal-warning">{warning}</p>}
        </div>

        <footer className="confirm-modal-footer">
          <button type="button" className="menu-modal-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={isDanger ? 'confirm-modal-danger-btn' : 'menu-modal-submit'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  )
})
