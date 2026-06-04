import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

export default function ConfirmDialog({
  open,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmText,
  confirmButtonLabel,
  cancelButtonLabel = 'Cancel',
  destructive = false,
  hideCancel = false,
  variant = 'confirm',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message?: ReactNode;
  confirmText?: string;
  confirmButtonLabel?: string;
  cancelButtonLabel?: string;
  destructive?: boolean;
  hideCancel?: boolean;
  variant?: 'confirm' | 'info';
  onConfirm: (typed?: string) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [typed, setTyped] = useState('');
  useEffect(() => { 
    if (!open) {
      setTyped(''); 
    } else {
      console.log('[ConfirmDialog] Opened:', { title, variant, destructive, confirmText, message });
    }
  }, [open, title, variant, destructive, confirmText, message]);
  if (!open) return null;
  const isInfo = variant === 'info';
  const computedConfirmLabel = confirmButtonLabel || (isInfo ? 'OK' : 'Confirm');
  const showCancel = !isInfo && !hideCancel && !!onCancel;

  const overlayStyle: CSSProperties = {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050,
  };
  const modalStyle: CSSProperties = {
    backgroundColor: '#fff', borderRadius: 8, width: 'min(520px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.25)'
  };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <div className="card shadow" style={modalStyle}>
        <div className="card-body">
          <div className="d-flex align-items-center mb-2" style={{ gap: 10 }}>
            <div className={`rounded-circle d-flex align-items-center justify-content-center ${isInfo ? 'bg-success' : (destructive ? 'bg-danger' : 'bg-primary')}`} style={{ width: 34, height: 34 }}>
              <i className={`fas ${isInfo ? 'fa-check' : 'fa-exclamation'} text-white`} aria-hidden="true"></i>
            </div>
            <h5 className="mb-0">{title}</h5>
          </div>
          <div className="mb-3 text-muted" style={{ lineHeight: 1.5 }}>
            {message}
          </div>
          {!isInfo && confirmText && (
            <div className="mb-3">
              <label htmlFor="confirmInput" className="form-label small mb-1">
                Type <strong>{confirmText}</strong> to continue
              </label>
              <input
                id="confirmInput"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={confirmText}
                className="form-control"
                autoFocus
              />
            </div>
          )}
          <div className="d-flex justify-content-end gap-2">
            {showCancel && (
              <button className="btn btn-outline-secondary" onClick={() => {
                console.log('[ConfirmDialog] Cancel clicked');
                onCancel?.();
              }}>{cancelButtonLabel}</button>
            )}
            <button
              className={`btn ${isInfo ? 'btn-success' : (destructive ? 'btn-danger' : 'btn-primary')}`}
              onClick={() => {
                console.log('[ConfirmDialog] Confirm clicked:', { typed, confirmText, variant });
                onConfirm(typed);
              }}
              disabled={!isInfo && !!confirmText && typed !== confirmText}
            >
              {computedConfirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
