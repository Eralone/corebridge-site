'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Перенос window.CBPopup из design-source/assets/popup.js.
 * Классы .cb-modal-bd / .cb-modal / .x — из site.css, разметка дословно.
 *
 * В эталоне это был императивный синглтон с делегированием по [data-popup].
 * Здесь — обычный React-компонент: состояние держит вызывающий экран.
 */
export interface PopupAction {
  label: string;
  primary?: boolean;
  onClick?: () => void;
}

export function Popup({
  open,
  title,
  children,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  actions?: PopupAction[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const list: PopupAction[] = actions ?? [{ label: 'Понятно', primary: true }];

  return createPortal(
    <div
      className="cb-modal-bd open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cb-modal" role="dialog" aria-modal="true">
        <button className="x" aria-label="Закрыть" onClick={onClose}>
          ×
        </button>
        <h3>{title}</h3>
        <div>{children}</div>
        <div className="row gap-12 mt-20">
          {list.map((a, i) => (
            <button
              key={i}
              className={`btn ${a.primary ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => (a.onClick ? a.onClick() : onClose())}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
