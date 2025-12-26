import React from 'react';
import { createRoot } from 'react-dom/client';
import './ConfirmDialog.css';

const ConfirmDialogComponent = ({
  title = 'Confirm Action',
  content = 'Are you sure you want to proceed?',
  onConfirm,
  onCancel,
  okText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning'
}) => {
  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    closeDialog();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    closeDialog();
  };

  const closeDialog = () => {
    const container = document.getElementById('confirm-dialog-root');
    if (container) {
      document.body.removeChild(container);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="confirm-icon-wrapper">
            <svg
              className={`confirm-icon confirm-icon-${type}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle cx="12" cy="12" r="10" strokeWidth="2"/>
              <path d="M12 8v4M12 16h.01" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
        <div className="modal-body">
          <h3 className="confirm-title">{title}</h3>
          <p className="confirm-content">{content}</p>
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={handleCancel}
          >
            {cancelText}
          </button>
          <button
            className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleConfirm}
          >
            {okText}
          </button>
        </div>
      </div>
    </div>
  );
};

export const showConfirmDialog = (config) => {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    container.id = 'confirm-dialog-root';
    document.body.appendChild(container);

    const root = createRoot(container);

    const handleConfirm = () => {
      if (config.onConfirm) config.onConfirm();
      resolve(true);
    };

    const handleCancel = () => {
      if (config.onCancel) config.onCancel();
      resolve(false);
    };

    root.render(
      <ConfirmDialogComponent
        {...config}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );
  });
};

export default showConfirmDialog;
