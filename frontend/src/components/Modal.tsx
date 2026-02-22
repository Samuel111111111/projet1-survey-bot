import React, { useEffect } from 'react';
import clsx from 'classnames';
import Button from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Basic modal component. Uses a semi‑transparent backdrop and centers
 * content on the screen. Closes when clicking the backdrop or pressing
 * Escape.
 */
const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer }) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        aria-hidden="true"
      ></div>
      <div className="relative bg-white dark:bg-gray-800 rounded-md shadow-lg max-w-lg w-full mx-4">
        {title && (
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium">{title}</h3>
          </div>
        )}
        <div className="p-4">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;