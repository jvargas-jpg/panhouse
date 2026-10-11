import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ActividadJefatura } from '../../../shared/jefatura';
import type {
  EstadoIntervencion,
  IntervencionSeguimiento,
  PaginaSeguimiento,
} from '../../../shared/seguimientoOperativo';
export const estadosIntervencion: Record<EstadoIntervencion, string> = {
  pendiente: 'Pendiente',
  asignado: 'Asignado',
  en_progreso: 'En proceso',
  bloqueado: 'Bloqueado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};
export function fechaSeguimiento(v: string | null | undefined, hora = true) {
  if (!v) return 'Sin registrar';
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(v);
  const d = new Date(soloFecha ? `${v}T12:00:00-04:00` : v);
  if (isNaN(d.getTime())) return 'Sin registrar';
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(!soloFecha && hora ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
}
export function horasSeguimiento(n: number | null) {
  return n === null
    ? 'Sin registro preciso'
    : `${new Intl.NumberFormat('es-VE', { maximumFractionDigits: 1 }).format(n)} h`;
}
export function EstadoIntervencionBadge({
  estado,
}: {
  estado: EstadoIntervencion;
}) {
  return (
    <span className={`js-badge js-state-${estado}`}>
      {estadosIntervencion[estado]}
    </span>
  );
}
export function SlaBadge({ sla }: { sla: IntervencionSeguimiento['sla'] }) {
  return (
    <span className={`js-badge js-sla-${sla.estado}`}>{sla.etiqueta}</span>
  );
}
export function DatoSeguimiento({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="js-dato">
      <span>{label}</span>
      <strong>{children ?? 'Sin registrar'}</strong>
    </div>
  );
}
export function SelectSeguimiento({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; nombre: string }[];
}) {
  return (
    <label className="js-filter">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
export function BusquedaSeguimiento({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onChange(draft), 300);
    return () => clearTimeout(t);
  }, [draft, value, onChange]);
  return (
    <label className="js-search">
      <span aria-hidden="true">⌕</span>
      <input
        aria-label="Buscar proyectos o autores"
        placeholder="Buscar por proyecto, autor o código…"
        value={draft}
        maxLength={160}
        onChange={(e) => setDraft(e.target.value)}
      />
    </label>
  );
}
export function PaginacionSeguimiento({
  p,
  onPage,
  onSize,
}: {
  p: PaginaSeguimiento;
  onPage: (v: number) => void;
  onSize: (v: number) => void;
}) {
  return (
    <footer className="js-pagination">
      <span>
        {p.total
          ? `${(p.page - 1) * p.pageSize + 1}–${Math.min(p.page * p.pageSize, p.total)} de ${p.total}`
          : '0 resultados'}
      </span>
      <label>
        Filas{' '}
        <select
          aria-label="Filas por página"
          value={p.pageSize}
          onChange={(e) => onSize(Number(e.target.value))}
        >
          {[10, 20, 50].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <div>
        <button disabled={p.page <= 1} onClick={() => onPage(p.page - 1)}>
          Anterior
        </button>
        <span>
          Página {p.page} de {Math.max(1, p.pages)}
        </span>
        <button disabled={p.page >= p.pages} onClick={() => onPage(p.page + 1)}>
          Siguiente
        </button>
      </div>
    </footer>
  );
}
export function StatsSeguimiento({
  items,
}: {
  items: { label: string; value: number | undefined; tone?: string }[];
}) {
  return (
    <div className="js-stats">
      {items.map((i) => (
        <div key={i.label} className={`js-stat ${i.tone ?? ''}`}>
          <span>{i.label}</span>
          <strong>{i.value ?? '—'}</strong>
        </div>
      ))}
    </div>
  );
}
export function ErrorSeguimiento({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="js-error" role="alert">
      <p>
        {error instanceof Error
          ? error.message
          : 'No se pudo cargar esta información.'}
      </p>
      <button onClick={retry}>Reintentar</button>
    </div>
  );
}
export function ActividadSeguimiento({
  items,
}: {
  items: (ActividadJefatura & { nota?: string | null })[];
}) {
  return !items.length ? (
    <p className="js-empty">Sin actividad registrada.</p>
  ) : (
    <ol className="js-activity">
      {items.map((a) => (
        <li key={a.id}>
          <strong>{a.actor}</strong>
          <p>{a.texto}</p>
          {a.nota && <p>{a.nota}</p>}
          <time>{fechaSeguimiento(a.fecha)}</time>
        </li>
      ))}
    </ol>
  );
}
export function DrawerSeguimiento({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab') {
        const els = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input,textarea,select,[tabindex="0"]',
          ) ?? [],
        ).filter((el) => el.offsetParent !== null);
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', key);
      before?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div className="js-drawer-layer">
      <button
        className="js-scrim"
        tabIndex={-1}
        aria-label="Cerrar panel"
        onClick={onClose}
      />
      <div
        className="js-drawer"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <p>JEFATURA · SEGUIMIENTO</p>
            <h2>{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Cerrar detalle">
            ×
          </button>
        </header>
        <div className="js-drawer-body">{children}</div>
        {footer && <footer className="js-drawer-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
