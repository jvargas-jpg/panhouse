// Integración mínima del destinatario en el panel existente de solicitudes.
// El Validador nunca recibe estos controles ni permisos de decisión.
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { ApiError } from '../lib/api';
import { fetchCalidad } from '../proyectos/calidadApi';
import { QUALITY_REQUEST_LABELS, type QualityRequestDetail } from '../../../shared/soporteEditorialRequests';
import { QualityRequestBadge, QualityRequestInformation } from './SoporteEditorialMisSolicitudes';
import { decideQualityRequest, fetchIncomingQualityDetail, fetchIncomingQualityRequests, qualityIncomingKey, qualityRequestsKey } from './soporteEditorialRequestsApi';

export function QualityIncomingRequests() {
  const { data: user } = useMe(), [params, setParams] = useSearchParams(), [page, setPage] = useState(1);
  const selected = params.get('qualityRequest');
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (selected) ref.current?.scrollIntoView({ block: 'start' }); }, [selected]);
  const q = useQuery({ queryKey: [...qualityIncomingKey, user?.id, 'list', page], queryFn: () => fetchIncomingQualityRequests(page), refetchInterval: 15000 });
  const detail = useQuery({ queryKey: [...qualityIncomingKey, user?.id, 'detail', selected], queryFn: () => fetchIncomingQualityDetail(selected!), enabled: !!selected, refetchInterval: 15000 });
  const select = (id: string) => setParams(current => { const next = new URLSearchParams(current); id ? next.set('qualityRequest', id) : next.delete('qualityRequest'); return next; });
  return <section ref={ref} className="qr-incoming" aria-label="Solicitudes recibidas de Soporte Editorial"><h2>Solicitudes recibidas de Soporte Editorial</h2>
    {q.isPending ? <p role="status">Consultando solicitudes de Calidad…</p> : q.isError ? <p role="alert">No se pudieron cargar las solicitudes. <button onClick={() => q.refetch()}>Reintentar</button></p> : <>
      {!q.data.items.length ? <p className="qr-muted">No hay solicitudes de Calidad pendientes de respuesta.</p> : <ul>{q.data.items.map(r => <li key={r.id}><button type="button" aria-pressed={selected === r.id} onClick={() => select(r.id)}><strong>{r.projectTitle} · F{r.phase}.{r.round} · {r.versionLabel}</strong><span>{QUALITY_REQUEST_LABELS[r.type]} · {r.subject}</span><QualityRequestBadge status={r.status} /></button></li>)}</ul>}
      {q.data.pages > 1 && <nav aria-label="Páginas de solicitudes recibidas"><button disabled={q.data.page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span>{q.data.page} / {q.data.pages}</span><button disabled={q.data.page >= q.data.pages} onClick={() => setPage(page + 1)}>Siguiente</button></nav>}
    </>}
    {selected && <div className="qr-incoming-detail"><button type="button" className="sr-button" onClick={() => select('')}>Cerrar solicitud de Calidad</button>
      {detail.isPending ? <p role="status">Consultando el detalle…</p> : detail.isError ? <p role="alert">No se pudo abrir esta solicitud. <button onClick={() => detail.refetch()}>Reintentar detalle</button></p> : detail.data && <><h3>{detail.data.summary.subject}</h3><QualityRequestBadge status={detail.data.summary.status} /><QualityRequestInformation d={detail.data} allowValidationLink={false} />
        {['pendiente', 'en_revision'].includes(detail.data.summary.status) && <Decision key={detail.data.summary.id + ':' + detail.data.summary.version} d={detail.data} />}
        {detail.data.summary.status === 'requiere_informacion' && <p className="qr-muted">Esperando la información solicitada al Validador.</p>}
      </>}
    </div>}
  </section>;
}
function Decision({ d }: { d: QualityRequestDetail }) {
  const cache = useQueryClient();
  const [action, setAction] = useState<'review' | 'return' | 'resolve'>('resolve'), [text, setText] = useState(''), [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const refs = useQuery({ queryKey: ['calidad', d.summary.projectId], queryFn: () => fetchCalidad(d.summary.projectId), enabled: action === 'resolve' });
  const invalidate = async () => { await Promise.all([cache.invalidateQueries({ queryKey: qualityIncomingKey }), cache.invalidateQueries({ queryKey: qualityRequestsKey }), cache.invalidateQueries({ queryKey: ['notificaciones'] })]); };
  return <form className="qr-form" onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await decideQualityRequest(d.summary.id, d.summary.version, action, text, action === 'resolve' && reference ? reference : undefined); await invalidate(); }
    catch (e) { setError(e instanceof ApiError && e.status === 409 ? 'La solicitud cambió. Revisa el estado actualizado antes de responder.' : e instanceof Error ? e.message : 'No se pudo registrar la respuesta.'); if (e instanceof ApiError && e.status === 409) await invalidate(); }
    finally { setBusy(false); }
  }}><fieldset disabled={busy}><h4>Responder a Soporte Editorial</h4><label>Acción<select value={action} onChange={e => setAction(e.target.value as typeof action)}><option value="resolve">Resolver con respuesta</option><option value="return">Solicitar información</option>{d.summary.status === 'pendiente' && <option value="review">Iniciar revisión</option>}</select></label>
    <label>{action === 'resolve' ? 'Resolución' : action === 'return' ? 'Información que necesitas' : 'Nota de revisión'}<textarea required minLength={5} maxLength={2000} value={text} onChange={e => setText(e.target.value)} /></label>
    {action === 'resolve' && !!refs.data?.rondas.length && <label>Validación relacionada con el resultado (opcional)<select value={reference} onChange={e => setReference(e.target.value)}><option value="">Sin referencia adicional</option>{refs.data.rondas.map(r => <option key={r.id} value={r.id}>F{r.numeroFase} · Ronda {r.ronda} · {r.pdfVersion}</option>)}</select></label>}
    <p className="qr-muted">La respuesta registra la atención de esta solicitud. Las entregas y las rondas siguen el flujo de Calidad.</p></fieldset>{error && <p role="alert">{error}</p>}<button className="sr-button sr-primary" disabled={busy}>{busy ? 'Guardando…' : 'Registrar respuesta'}</button></form>;
}
