import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export default function IssueSlideOver({ open, onClose, children, title }: Props) {
  const prevOpen = useRef(open);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    prevOpen.current = open;
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return createPortal(
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-4xl bg-white rounded-l-[32px] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 flex-shrink-0">
          {title && (
            <h2 className="text-lg font-bold text-donezo-dark tracking-tight">{title}</h2>
          )}
          <button
            onClick={onClose}
            className="ml-auto flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-donezo-light hover:text-donezo-dark text-gray-500 transition-all duration-200"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
