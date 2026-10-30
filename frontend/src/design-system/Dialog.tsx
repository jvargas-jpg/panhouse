import { useEffect, useRef, type ReactNode } from 'react';
import { RrppIcon } from '../rrpp/RrppIcons';

export function Dialog({ title, children, onClose, busy = false, variant = 'modal', className = '', subtitle }: {
  title: string; children: ReactNode; onClose: () => void; busy?: boolean;
  variant?: 'modal' | 'drawer' | 'navigation'; className?: string; subtitle?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className={`ph-dialog ph-dialog-${variant} ${className}`} aria-label={title}
    onKeyDown={e => {
      e.stopPropagation();
      if (e.key !== 'Tab') return;
      const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex]:not([tabindex="-1"])') ?? []).filter(el => el.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { e.preventDefault(); first?.focus(); }
    }} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <header className="ph-dialog-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      <button type="button" className="ph-icon-button" aria-label="Cerrar panel" disabled={busy} onClick={onClose}><RrppIcon nombre="cerrar" /></button>
    </header>{children}
  </dialog>;
}
