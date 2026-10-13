import type { ReactNode } from 'react';
import { RrppIcon } from '../rrpp/RrppIcons';
import type {
  IndicadoresJefatura,
  SlaIndicador,
} from '../../../shared/indicadoresJefatura';
export const numeroIndicador = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('es-VE', { maximumFractionDigits: 1 });
export const fechaIndicadorJefatura = (d: string) =>
  new Intl.DateTimeFormat('es-VE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${d}T12:00:00Z`));
export function CardIndicadores({
  titulo,
  subtitulo,
  extra,
  children,
  className = '',
}: {
  titulo: string;
  subtitulo?: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ji-card ${className}`} aria-label={titulo}>
      <div className="ji-card-head">
        <div>
          <h2>{titulo}</h2>
          {subtitulo && <p>{subtitulo}</p>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}
export function VacioIndicadores({
  children = 'No hay registros con estos filtros.',
}: {
  children?: ReactNode;
}) {
  return (
    <div className="ji-empty">
      <RrppIcon nombre="indicadores" />
      <p>{children}</p>
    </div>
  );
}
export function KpisIndicadores({ data }: { data: IndicadoresJefatura }) {
  const r = data.resumen;
  const stats = [
    {
      label: 'Proyectos activos',
      value: r.activos,
      icon: 'proyectos' as const,
      note: 'Cartera actual · incluye pausados',
    },
    {
      label: 'Por asignar',
      value: r.porAsignar,
      icon: 'persona' as const,
      note: 'Recibidos por Jefatura',
    },
    {
      label: 'En riesgo',
      value: r.enRiesgo,
      icon: 'riesgo' as const,
      note: 'Alertas de proyecto o proceso',
      tone: 'risk',
    },
    {
      label: 'Express confirmados',
      value: r.express,
      icon: 'rapido' as const,
      note: `${r.expressPosibles} por confirmar`,
      tone: 'gold',
    },
    {
      label: 'Carga del equipo',
      value: r.cargaEquipo,
      icon: 'indicadores' as const,
      note: `Puntos · ${numeroIndicador(r.cargaSinAsignar)} sin asignar`,
    },
    {
      label: 'Cierres registrados',
      value: r.cierres,
      icon: 'check' as const,
      note:
        r.cierres === null
          ? 'Sin datos suficientes'
          : 'En el período seleccionado',
      tone: 'success',
    },
  ];
  return (
    <div className="ji-kpis">
      {stats.map((s) => (
        <section
          className={`ji-card ji-kpi ${s.tone ?? ''}`}
          aria-label={s.label}
          key={s.label}
        >
          <span className="ji-kpi-icon">
            <RrppIcon nombre={s.icon} />
          </span>
          <div>
            <strong>{numeroIndicador(s.value)}</strong>
            <h2>{s.label}</h2>
            <p>{s.note}</p>
          </div>
        </section>
      ))}
    </div>
  );
}
export function LoadingIndicadores() {
  return (
    <div className="ji-loading" role="status" aria-label="Cargando indicadores">
      <div className="ji-kpis">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="ji-skeleton ji-skeleton-kpi" key={i} />
        ))}
      </div>
      <div className="ji-overview-grid">
        {[0, 1, 2].map((i) => (
          <div className="ji-skeleton ji-skeleton-chart" key={i} />
        ))}
      </div>
      <div className="ji-skeleton ji-skeleton-team" />
      <span className="sr-only">Cargando datos reales…</span>
    </div>
  );
}
export function SlaResumen({ sla }: { sla: SlaIndicador }) {
  return (
    <div className="ji-sla-summary">
      <div>
        <strong>
          {sla.cumplimiento === null
            ? '—'
            : `${numeroIndicador(sla.cumplimiento)}%`}
        </strong>
        <p>
          {sla.cumplimiento === null
            ? 'Sin datos suficientes'
            : 'Entregas dentro del SLA'}
        </p>
      </div>
      <dl>
        <div>
          <dt>En plazo</dt>
          <dd>{sla.enPlazo}</dd>
        </div>
        <div>
          <dt>Fuera de plazo</dt>
          <dd>{sla.fueraPlazo}</dd>
        </div>
        <div>
          <dt>Entregas medibles</dt>
          <dd>
            {sla.medibles} de {sla.entregas}
          </dd>
        </div>
        <div>
          <dt>Tiempo efectivo promedio</dt>
          <dd>
            {sla.promedioHoras === null
              ? 'Sin datos suficientes'
              : `${numeroIndicador(sla.promedioHoras)} h`}
          </dd>
        </div>
      </dl>
      <p className="ji-note">
        Cumplimiento sobre entregas con fecha y SLA verificables. Tiempo
        promedio sobre {sla.muestrasTiempo} registros con inicio y entrega;
        descuenta pausas.
      </p>
    </div>
  );
}
