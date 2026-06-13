import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
    sm: 'w-[calc(100vw-32px)] sm:max-w-md',
    md: 'w-[calc(100vw-32px)] sm:max-w-lg',
    lg: 'w-[calc(100vw-32px)] sm:max-w-2xl',
    xl: 'w-[calc(100vw-32px)] sm:max-w-4xl',
    '2xl': 'w-[calc(100vw-32px)] sm:max-w-5xl',
    full: 'w-[calc(100vw-32px)] sm:max-w-6xl',
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

  return createPortal(
    <div 
      id={id} 
      className="modal-overlay"
      onClick={onClose}
    >
      {/* Modal Content */}
      <div 
        className={`modal-content ${sizeClasses[size] || ''} flex flex-col max-h-[calc(100vh-48px)] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        {title && (
          <div className="modal-header-premium shrink-0">
            <h3 className="modal-title">{title}</h3>
            <button
              onClick={onClose}
              className="btn-close-premium"
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="modal-body-premium flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-footer-premium flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
