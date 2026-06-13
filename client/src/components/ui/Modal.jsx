import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

const Modal = ({
  isOpen = true,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  id,
}) => {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
    full: 'max-w-6xl',
  };

  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div id={id} className="modal-overlay">
      {/* Modal Content */}
      <div className={`modal-content ${sizeClasses[size] || ''}`}>

        {/* Header */}
        {title && (
          <div className="modal-header-premium">
            <h3 className="modal-title">{title}</h3>
            <button
              onClick={onClose}
              className="btn-close-premium"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="modal-body-premium max-h-[70vh] overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-footer-premium flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
