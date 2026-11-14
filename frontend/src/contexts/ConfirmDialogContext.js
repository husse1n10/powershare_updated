import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi';

const ConfirmDialogContext = createContext(async () => false);

const INTENT_CONFIG = {
  danger: {
    icon: FiAlertTriangle,
    title: 'Confirm Action',
    confirmClass: 'btn-danger',
  },
  warning: {
    icon: FiAlertTriangle,
    title: 'Confirm Action',
    confirmClass: 'btn-warning',
  },
  success: {
    icon: FiCheckCircle,
    title: 'Confirm Action',
    confirmClass: 'btn-success',
  },
  info: {
    icon: FiInfo,
    title: 'Confirm Action',
    confirmClass: 'btn-primary',
  },
};

function normalizeOptions(options) {
  if (typeof options === 'string') {
    return { message: options };
  }
  return options || {};
}

export function ConfirmDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((options) => {
    const normalized = normalizeOptions(options);
    return new Promise((resolve) => {
      const intent = normalized.intent || 'warning';
      const config = INTENT_CONFIG[intent] || INTENT_CONFIG.warning;

      setDialog({
        resolve,
        intent,
        title: normalized.title || config.title,
        message: normalized.message || 'Are you sure?',
        confirmText: normalized.confirmText || 'Confirm',
        cancelText: normalized.cancelText || 'Cancel',
        confirmClass: normalized.confirmClass || config.confirmClass,
        Icon: normalized.icon || config.icon,
      });
    });
  }, []);

  const closeDialog = useCallback((result) => {
    setDialog((current) => {
      if (current?.resolve) current.resolve(result);
      return null;
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}

      <Modal
        show={!!dialog}
        onHide={() => closeDialog(false)}
        centered
        backdrop="static"
        keyboard
        dialogClassName="confirm-dialog"
      >
        <Modal.Header closeButton>
          <Modal.Title>{dialog?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="confirm-dialog-body">
            {dialog?.Icon && (
              <span className={`confirm-dialog-icon ${dialog?.intent || 'warning'}`}>
                <dialog.Icon />
              </span>
            )}
            <div className="confirm-dialog-text">{dialog?.message}</div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={() => closeDialog(false)}>
            {dialog?.cancelText || 'Cancel'}
          </button>
          <button type="button" className={`btn ${dialog?.confirmClass || 'btn-primary'}`} onClick={() => closeDialog(true)}>
            {dialog?.confirmText || 'Confirm'}
          </button>
        </Modal.Footer>
      </Modal>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  return useContext(ConfirmDialogContext);
}

