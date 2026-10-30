import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type TableHTMLAttributes } from 'react';
import { RrppIcon } from '../rrpp/RrppIcons';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export function statusTone(value: string): Tone {
  const label = value.replaceAll('_', ' ');
  if (/bloque|vencid|error|rechaz|devuelt|no solvente|sobrepago|unavailable/i.test(label)) return 'danger';
  if (/complet|culmin|resuelt|solvente|verificado|pagado|liberado|aprobado|listo|^asignad[oa]$|healthy|up.to.date|^ready$|^connected$/i.test(label)) return 'success';
  if (/pend|esper|pausa|stand.by|requier|ajustes|por iniciar|parcial|provision|not.configured|disconnected|revisar moneda/i.test(label)) return 'warning';
  if (/en curso|en proceso|en progreso|revisi|^activ[oa]$|responding|observed/i.test(label)) return 'info';
  return 'neutral';
}
export function StatusBadge({ children, tone, className = '' }: { children: string; tone?: Tone; className?: string }) {
  return <span className={`ph-badge ph-tone-${tone ?? statusTone(children)} ${className}`}>{children}</span>;
}
export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'quiet' }) {
  return <button type={type} className={`ph-button ph-button-${variant} ${className}`} {...props} />;
}
export function PageHeader({ title, description, action, eyebrow, className = '' }: { title: string; description?: string; action?: ReactNode; eyebrow?: string; className?: string }) {
  return <header className={`ph-page-header ${className}`}><div>{eyebrow && <p className="ph-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>;
}
export function Surface({ className = '', ...props }: HTMLAttributes<HTMLElement>) { return <section className={`ph-surface ${className}`} {...props} />; }
export function FilterBar({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`ph-filter-bar ${className}`} {...props} />; }
export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { onClear?: () => void }>(function SearchInput({ className = '', 'aria-label': label, placeholder = 'Buscar…', onClear, ...props }, ref) {
  return <label className={`ph-search ${className}`}><span className="sr-only">{label ?? placeholder}</span><RrppIcon nombre="buscar" /><input ref={ref} type="search" placeholder={placeholder} {...props} />{onClear && props.value && <button type="button" className="ph-icon-button" aria-label="Limpiar búsqueda" onClick={onClear}><RrppIcon nombre="cerrar"/></button>}</label>;
});
export function DataTable({ className = '', wrapperClassName = '', children, ...props }: TableHTMLAttributes<HTMLTableElement> & { wrapperClassName?: string }) { return <div className={`ph-table-wrap ${wrapperClassName}`}><table className={`ph-table ${className}`} {...props}>{children}</table></div>; }
export function EmptyState({ title, children }: { title?: string; children?: ReactNode }) { return <div className="ph-empty">{title && <h3>{title}</h3>}{children && <p>{children}</p>}</div>; }
export function Skeleton({ label = 'Cargando información' }: { label?: string }) { return <div className="ph-skeleton" role="status" aria-label={label}><i /><i /><i /><i /></div>; }
export function MetricCard({ label, value, detail, icon }: { label: string; value: ReactNode; detail?: ReactNode; icon?: ReactNode }) {
  return <div className="ph-metric">{icon && <span className="ph-metric-icon">{icon}</span>}<p>{label}</p><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}
export function Pagination({ total, page, pages, onPage, children }: { total: number; page: number; pages: number; onPage: (n: number) => void; children?: ReactNode }) {
  return <footer className="ph-pagination"><span>{total} resultados</span><div>{children}<button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button><span>{page} / {pages}</span><button type="button" aria-label="Página siguiente" disabled={page >= pages} onClick={() => onPage(page + 1)}>›</button></div></footer>;
}
