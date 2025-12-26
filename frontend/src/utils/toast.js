// Custom toast notification system matching dark theme
let toastContainer = null;

const createToastContainer = () => {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
};

const createToast = (content, type = 'info', duration = 3000) => {
  const container = createToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.innerHTML = getIcon(type);

  const text = document.createElement('span');
  text.className = 'toast-message';
  text.textContent = content;

  toast.appendChild(icon);
  toast.appendChild(text);
  container.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add('show'), 10);

  // Remove after duration
  if (duration > 0) {
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          container.removeChild(toast);
          if (container.children.length === 0) {
            document.body.removeChild(container);
            toastContainer = null;
          }
        }
      }, 300);
    }, duration);
  }

  // Return close function for loading messages
  return () => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        container.removeChild(toast);
        if (container.children.length === 0) {
          document.body.removeChild(container);
          toastContainer = null;
        }
      }
    }, 300);
  };
};

const getIcon = (type) => {
  const icons = {
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="22 4 12 14.01 9 11.01" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="9" x2="15" y2="15" stroke-width="2" stroke-linecap="round"/></svg>',
    warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="16" x2="12" y2="12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="8" x2="12.01" y2="8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    loading: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="spinner"><circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg>'
  };
  return icons[type] || icons.info;
};

// Export as message to match Ant Design API
export const message = {
  success: (content, duration) => createToast(content, 'success', duration),
  error: (content, duration) => createToast(content, 'error', duration),
  warning: (content, duration) => createToast(content, 'warning', duration),
  info: (content, duration) => createToast(content, 'info', duration),
  loading: (content) => createToast(content, 'loading', 0)
};

// Also export as default
export default message;

// Add CSS styles matching dark theme
const style = document.createElement('style');
style.textContent = `
.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-elevated, #2d3548);
  border: 1px solid var(--border-color, #3d4558);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  min-width: 300px;
  max-width: 400px;
  opacity: 0;
  transform: translateX(400px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: auto;
}

.toast.show {
  opacity: 1;
  transform: translateX(0);
}

.toast-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.toast-icon svg {
  display: block;
}

.toast-icon .spinner {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.toast-message {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary, #e4e6eb);
}

.toast-success {
  border-left: 3px solid var(--success-color, #52c41a);
}

.toast-success .toast-icon {
  color: var(--success-color, #52c41a);
}

.toast-error {
  border-left: 3px solid var(--error-color, #ff4d4f);
}

.toast-error .toast-icon {
  color: var(--error-color, #ff4d4f);
}

.toast-warning {
  border-left: 3px solid var(--warning-color, #faad14);
}

.toast-warning .toast-icon {
  color: var(--warning-color, #faad14);
}

.toast-info,
.toast-loading {
  border-left: 3px solid var(--info-color, #1890ff);
}

.toast-info .toast-icon,
.toast-loading .toast-icon {
  color: var(--info-color, #1890ff);
}

@media (max-width: 768px) {
  .toast-container {
    left: 16px;
    right: 16px;
    top: 16px;
  }

  .toast {
    min-width: auto;
    max-width: 100%;
  }
}
`;
document.head.appendChild(style);
