import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../lib/api';
import type { DetalleDecision, ItemDecision } from '../../../shared/decisiones';
import {
  fetchActividadDecision,
  fetchDecision,
  fetchDecisiones,
  fetchResumenDecisiones,
  iniciarRevisionDecision,
  resolverDecisionApi,
  solicitarInfoDecision,
} from './decisionesApi';
import './portafolio.css';
import './decisiones.css';

const SUBJECTS: Record<string, string> = {
  revision_previa_correccion: 'Revisión previa de Corrección',
  coleccion_inconsistente: 'Revisión de colección',
};

const REGLAS: Record<
  string,
  { titulo: string; texto: (d: DetalleDecision) => string }
> = {
  revision_previa_correccion: {
    titulo: 'Revisión previa por extensión',
    texto: (d) =>
      `Las tripas Word de más de 120 páginas requieren revisión previa. Este caso registra ${d.contextSnapshot?.paginas ?? d.correccion?.paginas ?? 'más de 120'} páginas.`,
  },
  coleccion_inconsistente: {
    titulo: 'Colección registrada vs. proyecto',
    texto: () =>
      'Calidad detectó una posible discrepancia en la colección registrada. Jefatura puede solicitar una revisión con RRPP; este caso no cambia el checklist ni detiene la ronda de Calidad.',
  },
};

function tiempoRelativo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'Recién';
  if (min < 60) return `Hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'Ayer';
  if (dias < 7) return `Hace ${dias} d`;
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

function fecha(iso: string | null) {
  if (!iso) return 'Sin registrar';
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  informacion_solicitada: 'Esperando información',
  resuelta: 'Resuelta',
};

function EstadoBadge({
  status,
  resolutionType,
}: {
  status: string;
  resolutionType: string | null;
}) {
  if (status === 'resuelta') {
    const label =
      resolutionType === 'approved'
        ? 'Aprobada'
        : resolutionType === 'rejected'
          ? 'Rechazada'
          : 'Cancelada';
    return (
      <span className={`jd-badge jd-resolved-${resolutionType}`}>{label}</span>
    );
  }
  return (
    <span className={`jd-badge jd-status-${status}`}>
      {ESTADO_LABEL[status]}
    </span>
  );
}

function CasoItem({
  item,
  activo,
  onSelect,
}: {
  item: ItemDecision;
  activo: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`jd-item ${activo ? 'jd-item-selected' : ''}`}
      onClick={onSelect}
      aria-current={activo}
    >
      <div className="jd-item-top">
        {item.bloqueaCorreccion && (
          <span className="jd-flag jd-flag-block">Bloquea Corrección</span>
        )}
        {!item.bloqueaCorreccion && (
          <EstadoBadge
            status={item.status}
            resolutionType={item.resolutionType}
          />
        )}
        <span className="jd-item-time">{tiempoRelativo(item.requestedAt)}</span>
      </div>
      <strong className="jd-item-title">{item.titulo}</strong>
      <span className="jd-item-meta" title={item.autores}>
        {item.autores} · #{item.codigo} ·{' '}
        {item.origen === 'correccion' ? 'Corrección' : 'Calidad'}
      </span>
      <span
        className="jd-item-subject"
        title={item.requestMessage ?? item.subject}
      >
        {item.requestMessage ?? item.subject}
      </span>
      <span className="jd-item-from">
        {item.subject} · {item.requestedByNombre}
      </span>
    </button>
  );
}

function Regla({ detalle }: { detalle: DetalleDecision }) {
  const r = REGLAS[detalle.tipo];
  if (!r) return null;
  return (
    <section className="jd-rule">
      <p className="jd-section-label">Regla activada</p>
      <p className="jd-rule-title">{r.titulo}</p>
      <p>{r.texto(detalle)}</p>
    </section>
  );
}

function Contexto({ detalle }: { detalle: DetalleDecision }) {
  const filas: [string, string][] = [
    ['Servicio', detalle.servicioNombre],
    ['Especialista', detalle.especialistaNombre ?? 'Sin asignar'],
  ];
  if (detalle.correccion) {
    filas.push([
      'Páginas',
      detalle.correccion.paginas
        ? `${detalle.correccion.paginas}`
        : 'Sin registrar',
    ]);
    filas.push([
      'Tipo material',
      detalle.correccion.alcance === 'tripa_completa'
        ? 'Tripa completa'
        : detalle.correccion.alcance === 'preliminares'
          ? 'Preliminares'
          : detalle.correccion.alcance === 'cubierta_extendida'
            ? 'Cubierta extendida'
            : (detalle.correccion.alcance ?? 'Sin registrar'),
    ]);
  }
  if (
    typeof detalle.contextSnapshot?.coleccionRegistrada === 'string' ||
    detalle.contextSnapshot?.coleccionRegistrada === null
  ) {
    filas.push([
      'Colección registrada',
      (detalle.contextSnapshot?.coleccionRegistrada as string | null) ??
        'Sin colección',
    ]);
  }
  return (
    <section className="jd-context">
      <p className="jd-section-label">Contexto</p>
      <dl className="jd-dl">
        {filas.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Consecuencia({ tipo }: { tipo: string }) {
  if (tipo === 'revision_previa_correccion')
    return (
      <section className="jd-consequence">
        <div>
          <p className="jd-section-label">Si apruebas</p>
          <p>El Especialista podrá continuar con la asignación de Corrector.</p>
        </div>
        <div>
          <p className="jd-section-label">Si rechazas</p>
          <p>
            La Corrección permanece bloqueada y el Especialista recibe tu
            justificación.
          </p>
        </div>
      </section>
    );
  return (
    <section className="jd-consequence">
      <div>
        <p className="jd-section-label">Si apruebas</p>
        <p>
          RRPP recibe una solicitud de revisión de la colección. Su dato y la
          revisión de Calidad permanecen a cargo de sus responsables.
        </p>
      </div>
      <div>
        <p className="jd-section-label">Si rechazas</p>
        <p>
          Se descarta esta escalación con tu justificación; no se modifica la
          colección registrada.
        </p>
      </div>
    </section>
  );
}

function Confirmacion({
  titulo,
  texto,
  children,
  onConfirm,
  onCancel,
  busy,
  error,
}: {
  titulo: string;
  texto: string;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
  error?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const nodes = () => [
      ...ref.current!.querySelectorAll<HTMLElement>(
        'textarea,button:not(:disabled)',
      ),
    ];
    nodes()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        onCancel();
      }
      if (event.key === 'Tab') {
        const all = nodes();
        if (!all.length) return;
        const first = all[0],
          last = all[all.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      prior?.focus();
    };
  }, []);
  return (
    <div className="jd-confirm-layer">
      <div
        ref={ref}
        className="jd-confirm"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <h3>{titulo}</h3>
        <p>{texto}</p>
        <fieldset disabled={busy}>{children}</fieldset>
        {error && (
          <p className="jd-action-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            className="jd-confirm-primary"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Enviando…' : 'Confirmar'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function DecisionesPage() {
  const [params, setParams] = useSearchParams();
  const estado = (params.get('estado') ?? 'pendiente') as
    | 'pendiente'
    | 'en_revision'
    | 'informacion_solicitada'
    | 'resuelta'
    | 'todas';
  const decisionId = params.get('decision');
  const q = params.get('q') ?? '';
  const [qDraft, setQDraft] = useState(q);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const tipo = params.get('tipo') ?? '';
  const origen = params.get('origen') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const [accion, setAccion] = useState<null | 'approved' | 'rejected' | 'info'>(
    null,
  );
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const cache = useQueryClient();
  const [compact, setCompact] = useState(
    () => matchMedia('(max-width:1024px)').matches,
  );
  useEffect(() => {
    const media = matchMedia('(max-width:1024px)');
    const change = () => setCompact(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const detailRef = useRef<HTMLElement>(null);
  const started = useRef<string | null>(null);
  function filtro(key: string, value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      value ? next.set(key, value) : next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  }
  useEffect(() => setQDraft(q), [q]);

  useEffect(() => {
    if (qDraft === q) return;
    const t = setTimeout(() => filtro('q', qDraft), 300);
    return () => clearTimeout(t);
  }, [qDraft]);

  const resumen = useQuery({
    queryKey: ['decisiones', 'resumen'],
    queryFn: fetchResumenDecisiones,
    refetchInterval: 60000,
  });
  const lista = useQuery({
    queryKey: ['decisiones', 'lista', estado, q, tipo, origen, from, to, page],
    queryFn: () =>
      fetchDecisiones({
        status: estado,
        q,
        tipo,
        origen,
        from,
        to,
        page,
        pageSize: 20,
      }),
  });
  const detalle = useQuery({
    queryKey: ['decisiones', 'detalle', decisionId],
    queryFn: () => fetchDecision(decisionId!),
    enabled: !!decisionId,
  });
  const actividad = useQuery({
    queryKey: ['decisiones', 'actividad', decisionId],
    queryFn: () => fetchActividadDecision(decisionId!),
    enabled: !!decisionId,
  });

  // Abrir el caso inicia revisión automáticamente si estaba pendiente
  // (prompt §38: "en segundos" -- no un botón extra "Iniciar revisión"
  // antes de poder leer el caso).
  useEffect(() => {
    if (
      detalle.data &&
      detalle.data.status === 'pendiente' &&
      started.current !== detalle.data.id
    ) {
      started.current = detalle.data.id;
      void iniciarRevisionDecision(detalle.data.id, detalle.data.version)
        .then(() => {
          void cache.invalidateQueries({ queryKey: ['decisiones'] });
        })
        .catch((error) => {
          setErrorAccion(
            error instanceof Error
              ? error.message
              : 'No se pudo iniciar la revisión',
          );
          void detalle.refetch();
        });
    }
  }, [detalle.data?.id, detalle.data?.status]);
  useEffect(() => {
    setAccion(null);
    setErrorAccion(null);
    setMensaje('');
  }, [decisionId]);
  useEffect(() => {
    if (!decisionId || !compact) return;
    const prior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    detailRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('.jd-confirm')) {
        event.preventDefault();
        cerrarDetalle();
      }
      if (event.key === 'Tab' && !document.querySelector('.jd-confirm')) {
        const all = [
          ...detailRef.current!.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input,textarea',
          ),
        ];
        if (!all.length) return;
        if (
          event.shiftKey &&
          (document.activeElement === all[0] ||
            document.activeElement === detailRef.current)
        ) {
          event.preventDefault();
          all[all.length - 1].focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === all[all.length - 1]
        ) {
          event.preventDefault();
          all[0].focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', key);
      prior?.focus();
    };
  }, [decisionId, compact]);

  function seleccionar(id: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('decision', id);
      return next;
    });
  }
  function cerrarDetalle() {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('decision');
      return next;
    });
  }

  async function confirmar() {
    if (!detalle.data || enviando) return;
    if (accion === 'rejected' && !mensaje.trim()) {
      setErrorAccion('El rechazo requiere una justificación');
      return;
    }
    if (accion === 'info' && !mensaje.trim()) {
      setErrorAccion('Indicá qué información necesitás');
      return;
    }
    setEnviando(true);
    setErrorAccion(null);
    try {
      if (accion === 'info') {
        await solicitarInfoDecision(
          detalle.data.id,
          mensaje,
          detalle.data.version,
        );
      } else if (accion) {
        await resolverDecisionApi(
          detalle.data.id,
          accion,
          mensaje || undefined,
          detalle.data.version,
        );
      }
      setAccion(null);
      setMensaje('');
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['decisiones'] }),
        cache.invalidateQueries({ queryKey: ['jefatura'] }),
        cache.invalidateQueries({ queryKey: ['seguimiento'] }),
        cache.invalidateQueries({ queryKey: ['notificaciones'] }),
        cache.invalidateQueries({ queryKey: ['correcciones'] }),
        cache.invalidateQueries({ queryKey: ['ficha'] }),
        detalle.refetch(),
        actividad.refetch(),
      ]);
    } catch (e) {
      setErrorAccion(
        e instanceof ApiError ? e.message : 'No se pudo completar la acción',
      );
      if (e instanceof ApiError && e.status === 409) {
        setAccion(null);
        await detalle.refetch();
      }
    } finally {
      setEnviando(false);
    }
  }

  const tabs: { id: typeof estado; label: string }[] = [
    { id: 'pendiente', label: 'Pendientes' },
    { id: 'en_revision', label: 'En revisión' },
    { id: 'informacion_solicitada', label: 'Esperando información' },
    { id: 'resuelta', label: 'Resueltas' },
  ];

  const d = detalle.data;
  const selectedOutside =
    d && lista.data && !lista.data.items.some((item) => item.id === d.id)
      ? {
          id: d.id,
          proyectoId: d.proyectoId,
          codigo: d.codigo,
          titulo: d.titulo,
          autores: d.autores,
          tipo: d.tipo,
          subject: d.subject,
          status: d.status,
          resolutionType: d.resolutionType,
          requestedAt: d.requestedAt,
          requestedByNombre: d.requestedByNombre,
          requestMessage: d.requestMessage,
          origen: d.correccion ? ('correccion' as const) : ('calidad' as const),
          bloqueaCorreccion:
            !!d.correccion?.requiereRevisionPrevia &&
            !d.correccion.revisionPreviaConfirmada &&
            d.status !== 'resuelta',
          urgente: false,
        }
      : null;
  const puedeResolver =
    d && (d.status === 'pendiente' || d.status === 'en_revision');

  return (
    <div className="jd-layout">
      <div className="jd-summary">
        <div>
          <span>Pendientes</span>
          <strong>{resumen.data?.pendientes ?? '—'}</strong>
        </div>
        <div>
          <span>Bloquean Corrección</span>
          <strong className={resumen.data?.urgentes ? 'jd-urgent-count' : ''}>
            {resumen.data?.urgentes ?? '—'}
          </strong>
        </div>
        <div>
          <span>Esperando información</span>
          <strong>{resumen.data?.esperandoInfo ?? '—'}</strong>
        </div>
      </div>

      <div className="jd-split">
        <aside className="jd-inbox">
          <div className="jd-tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={estado === t.id ? 'jd-tab-active' : ''}
                onClick={() => filtro('estado', t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="jd-search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Buscar proyecto, autor o motivo"
              placeholder="Buscar proyecto, autor o motivo…"
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
            />
          </label>
          <div className="jd-filters">
            <select
              aria-label="Tipo de decisión"
              value={tipo}
              onChange={(e) => filtro('tipo', e.target.value)}
            >
              <option value="">Tipo</option>
              <option value="revision_previa_correccion">
                Revisión previa
              </option>
              <option value="coleccion_inconsistente">Colección</option>
            </select>
            <select
              aria-label="Origen"
              value={origen}
              onChange={(e) => filtro('origen', e.target.value)}
            >
              <option value="">Origen</option>
              <option value="correccion">Corrección</option>
              <option value="calidad">Calidad</option>
            </select>
            <label>
              Desde
              <input
                aria-label="Desde"
                type="date"
                value={from}
                onChange={(e) => filtro('from', e.target.value)}
              />
            </label>
            <label>
              Hasta
              <input
                aria-label="Hasta"
                type="date"
                value={to}
                onChange={(e) => filtro('to', e.target.value)}
              />
            </label>
          </div>
          {selectedOutside && (
            <div className="jd-current-selection">
              <p>Seleccionada · fuera de este filtro</p>
              <CasoItem
                item={selectedOutside}
                activo
                onSelect={() => seleccionar(selectedOutside.id)}
              />
            </div>
          )}
          {lista.isError && (
            <div className="jd-error" role="alert">
              <p>No pudimos cargar la bandeja.</p>
              <button onClick={() => lista.refetch()}>Reintentar</button>
            </div>
          )}
          {lista.isLoading ? (
            <div className="jd-skeleton-list" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="jd-skeleton-item" />
              ))}
            </div>
          ) : lista.data && lista.data.items.length === 0 ? (
            <div className="jd-empty">
              <p>
                <strong>
                  {estado === 'pendiente'
                    ? 'No tienes decisiones pendientes.'
                    : 'No hay casos en este filtro.'}
                </strong>
              </p>
              <p>
                Los procesos que requieran revisión de Jefatura aparecerán acá
                automáticamente.
              </p>
              {estado !== 'resuelta' && (
                <button
                  className="jd-empty-cta"
                  onClick={() => filtro('estado', 'resuelta')}
                >
                  Ver resueltas
                </button>
              )}
            </div>
          ) : (
            <div className="jd-list">
              {lista.data?.items.map((item) => (
                <CasoItem
                  key={item.id}
                  item={item}
                  activo={item.id === decisionId}
                  onSelect={() => seleccionar(item.id)}
                />
              ))}
            </div>
          )}
          {lista.data && lista.data.total > lista.data.pageSize && (
            <footer className="jd-pagination">
              <button
                disabled={page <= 1}
                onClick={() => filtro('page', String(page - 1))}
              >
                Anterior
              </button>
              <span>
                Página {page} de{' '}
                {Math.max(1, Math.ceil(lista.data.total / lista.data.pageSize))}
              </span>
              <button
                disabled={page * lista.data.pageSize >= lista.data.total}
                onClick={() => filtro('page', String(page + 1))}
              >
                Siguiente
              </button>
            </footer>
          )}
        </aside>

        {compact && decisionId && (
          <div
            className="jd-detail-shade"
            aria-hidden="true"
            onClick={cerrarDetalle}
          />
        )}
        <section
          ref={detailRef}
          tabIndex={-1}
          role={compact && decisionId ? 'dialog' : undefined}
          aria-modal={compact && decisionId ? true : undefined}
          aria-label="Expediente de decisión"
          className={`jd-detail ${decisionId ? 'jd-detail-active' : ''}`}
        >
          {!decisionId ? (
            <div className="jd-detail-empty">
              <p>Seleccioná un caso para ver el expediente completo.</p>
            </div>
          ) : detalle.isLoading ? (
            <div className="jd-skeleton-detail" aria-hidden="true" />
          ) : detalle.isError ? (
            <div className="jd-error" role="alert">
              <p>No pudimos abrir este caso.</p>
              <button onClick={() => detalle.refetch()}>Reintentar</button>
            </div>
          ) : d ? (
            <>
              <header className="jd-detail-header">
                <div>
                  <div className="jd-detail-badges">
                    <EstadoBadge
                      status={d.status}
                      resolutionType={d.resolutionType}
                    />
                  </div>
                  <h2>{d.titulo}</h2>
                  <p>
                    {d.autores} · #{d.codigo}
                  </p>
                </div>
                <button
                  className="jd-close"
                  onClick={cerrarDetalle}
                  aria-label="Cerrar expediente"
                >
                  ×
                </button>
              </header>

              <div className="jd-detail-body">
                {errorAccion && !accion && (
                  <p className="jd-error" role="alert">
                    {errorAccion}
                  </p>
                )}
                <section className="jd-ask">
                  <p className="jd-section-label">Decisión requerida</p>
                  <p className="jd-ask-title">
                    {SUBJECTS[d.tipo] ?? d.subject}
                  </p>
                  {d.requestMessage && <p>{d.requestMessage}</p>}
                  <p className="jd-ask-meta">
                    Solicitado por {d.requestedByNombre} ·{' '}
                    {d.requestedByRole === 'soporte_editorial'
                      ? 'Soporte Editorial'
                      : 'Especialista'}{' '}
                    · {fecha(d.requestedAt)}
                  </p>
                </section>

                <Regla detalle={d} />
                <Contexto detalle={d} />

                {d.requestedInfoMessage && (
                  <section className="jd-info-exchange">
                    <p className="jd-section-label">Información solicitada</p>
                    <p>{d.requestedInfoMessage}</p>
                    {d.status === 'informacion_solicitada' && (
                      <p>Esperando respuesta del solicitante.</p>
                    )}
                    {d.respondedInfoMessage && (
                      <>
                        <p className="jd-section-label">Respuesta</p>
                        <p>{d.respondedInfoMessage}</p>
                      </>
                    )}
                  </section>
                )}

                {d.status === 'resuelta' && (
                  <section className="jd-resolution">
                    <p className="jd-section-label">Resultado</p>
                    <p>
                      {d.resolutionMessage || 'Sin justificación adicional.'}
                    </p>
                    <p className="jd-ask-meta">
                      {d.resolvedByNombre} · {fecha(d.resolvedAt)}
                    </p>
                  </section>
                )}

                {puedeResolver && <Consecuencia tipo={d.tipo} />}

                <section className="jd-activity">
                  <p className="jd-section-label">Actividad</p>
                  {actividad.isError ? (
                    <div className="jd-error" role="alert">
                      No pudimos cargar la actividad.{' '}
                      <button onClick={() => actividad.refetch()}>
                        Reintentar
                      </button>
                    </div>
                  ) : actividad.isLoading ? (
                    <p>Cargando actividad…</p>
                  ) : !actividad.data?.actividad.length ? (
                    <p className="jd-empty-inline">Sin actividad registrada.</p>
                  ) : (
                    <ol>
                      {actividad.data.actividad.map((a) => (
                        <li key={a.id}>
                          <strong>{a.actor}</strong> {a.texto}
                          <time>{fecha(a.fecha)}</time>
                          {typeof a.detalles?.mensaje === 'string' && (
                            <p>{a.detalles.mensaje}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>

              {puedeResolver && (
                <footer className="jd-actions">
                  {errorAccion && (
                    <p className="jd-action-error">{errorAccion}</p>
                  )}
                  <button
                    className="jd-btn-secondary"
                    onClick={() => {
                      setAccion('info');
                      setMensaje('');
                      setErrorAccion(null);
                    }}
                  >
                    Solicitar información
                  </button>
                  <button
                    className="jd-btn-destructive"
                    onClick={() => {
                      setAccion('rejected');
                      setMensaje('');
                      setErrorAccion(null);
                    }}
                  >
                    {d.tipo === 'coleccion_inconsistente'
                      ? 'Descartar discrepancia'
                      : 'Rechazar'}
                  </button>
                  <button
                    className="jd-btn-primary"
                    onClick={() => {
                      setAccion('approved');
                      setMensaje('');
                      setErrorAccion(null);
                    }}
                  >
                    {d.tipo === 'coleccion_inconsistente'
                      ? 'Revisar con RRPP'
                      : 'Aprobar'}
                  </button>
                </footer>
              )}

              {accion === 'approved' && (
                <Confirmacion
                  titulo="Aprobar este caso"
                  texto={
                    d.tipo === 'revision_previa_correccion'
                      ? 'El Especialista podrá continuar con la asignación de Corrector.'
                      : 'RRPP recibe una solicitud para revisar la colección registrada.'
                  }
                  onCancel={() => setAccion(null)}
                  onConfirm={confirmar}
                  busy={enviando}
                  error={errorAccion}
                >
                  <label className="jd-confirm-field">
                    Comentario (opcional)
                    <textarea
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      maxLength={2000}
                    />
                  </label>
                </Confirmacion>
              )}
              {accion === 'rejected' && (
                <Confirmacion
                  titulo="Rechazar este caso"
                  texto="El rechazo requiere una justificación; el solicitante la recibirá."
                  onCancel={() => setAccion(null)}
                  onConfirm={confirmar}
                  busy={enviando}
                  error={errorAccion}
                >
                  <label className="jd-confirm-field">
                    Justificación
                    <textarea
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      maxLength={2000}
                      required
                    />
                  </label>
                </Confirmacion>
              )}
              {accion === 'info' && (
                <Confirmacion
                  titulo="Solicitar información"
                  texto="El caso queda esperando esta respuesta antes de poder resolverse."
                  onCancel={() => setAccion(null)}
                  onConfirm={confirmar}
                  busy={enviando}
                  error={errorAccion}
                >
                  <label className="jd-confirm-field">
                    ¿Qué información necesitás?
                    <textarea
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      maxLength={2000}
                      required
                    />
                  </label>
                </Confirmacion>
              )}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
