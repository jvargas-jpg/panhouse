import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useMe } from '../auth/useAuth';
import { fetchDisenadoresCarga } from './proyectoDetalleApi';
import { fetchCorreccionesDeProyecto } from './correccionesApi';
import { asignarDiseno, coordinarDiseno, entregarDiseno, fetchDisenos, revisarCubierta, solicitarDiseno, type TrabajoDiseno, type TipoDiseno } from './disenoApi';
const etiquetas = { muestra_diagramacion: 'Muestra de diagramación', diagramacion: 'Diagramación completa', cubierta_extendida: 'Cubierta extendida' };
const campo = 'min-w-0 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-tinta';
const boton = 'rounded-lg bg-tinta px-3 py-2 text-sm font-medium text-white disabled:opacity-50';
export const fechaHora = (s: string | null) => s ? new Date(s).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin pautar';
function ErrorAccion({ error }: { error: unknown }) { return error ? <p role="alert" className="text-sm text-red-700">{error instanceof Error ? error.message : 'No se pudo guardar'}</p> : null; }
export function TarjetaDiseno({ trabajo: t, modo = 'operativo' }: { trabajo: TrabajoDiseno; modo?: 'operativo' | 'creativa' | 'interna' }) {
  const { data: user } = useMe();
  const qc = useQueryClient();
  const [enlace, setEnlace] = useState('');
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [feedback, setFeedback] = useState('');
  const [comentarios, setComentarios] = useState(0);
  const [disenador, setDisenador] = useState(t.disenadorId ?? '');
  const [due, setDue] = useState('');
  const [feedbackDue, setFeedbackDue] = useState('');
  const esEspecialista = user?.rol === 'especialista';
  const esDisenador = user?.rol === 'disenador';
  const carga = useQuery({ queryKey: ['disenadores', 'carga'], queryFn: fetchDisenadoresCarga, enabled: esEspecialista });
  const v = t.versiones[0];
  const accion = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: () => { qc.invalidateQueries({ queryKey: ['diseno'] }); qc.invalidateQueries({ queryKey: ['direcciones-creativas'] }); qc.invalidateQueries({ queryKey: ['calidad'] }); qc.invalidateQueries({ queryKey: ['proyecto', t.proyectoId] }); } });
  const enviar = () => accion.mutate(async () => { await entregarDiseno(t.id, enlace, key); setKey(crypto.randomUUID()); setEnlace(''); });
  return <article className="min-w-0 rounded-xl border border-tinta/10 bg-white p-4 shadow-sm sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h3 className="break-words font-semibold text-tinta">{etiquetas[t.tipo]} · {t.autorNombre}</h3><p className="break-words text-xs text-gray-500">#{t.proyectoCodigo} · {t.servicioCodigo}{t.modalidad ? ` / ${t.modalidad}` : ''} · {t.tituloDefinitivo}</p></div>
      <span className={`rounded-full px-3 py-1 text-xs ${t.cerradoEn ? 'bg-green-100 text-green-800' : t.plazo === 'vencido' ? 'bg-red-100 text-red-800' : 'bg-dorado/15 text-tinta'}`}>{t.cerradoEn ? 'Entregado / aprobado' : v?.feedbackEn ? 'Necesita ajustes' : t.estado.replaceAll('_', ' ')}</span>
    </header>
    <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-gray-500">Vencimiento pautado</dt><dd>{fechaHora(t.dueAt)}</dd></div><div><dt className="text-xs text-gray-500">Referencia del Manual</dt><dd>{t.diasReferencia ? `${t.diasReferencia} días` : 'Requiere definición'} · calendario por confirmar</dd></div><div><dt className="text-xs text-gray-500">Versión activa</dt><dd>{v ? `V${v.numero} · ${fechaHora(v.entregadoEn)}` : 'Pendiente de entrega'}</dd></div></dl>
    <p className="mt-3 text-sm text-gray-600">Diseñador: {t.disenadorNombre ?? 'Pendiente de asignación'}</p>
    <nav aria-label="Fuentes del trabajo" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-tinta underline">
      {[[t.fuenteUrl, 'Archivo fuente'], [t.briefEnlace, 'Brief aprobado'], [t.recursoConceptoPdfUrl, 'Concepto aprobado'], [t.recursoImagenUrl, 'Recursos creativos']].map(([url, texto]) => <a key={texto} href={url} target="_blank" rel="noreferrer">{texto}</a>)}
    </nav>
    {v && <div className="mt-4 border-t border-gray-100 pt-3 text-sm"><a href={v.enlace} target="_blank" rel="noreferrer" className="font-medium text-tinta underline">Abrir entrega V{v.numero}</a>
      {v.feedback && <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-amber-50 p-3">{v.feedback}{v.cantidadComentarios !== null ? ` (${v.cantidadComentarios} comentarios)` : ''}</p>}
      {v.feedbackArchivoUrl && <a href={v.feedbackArchivoUrl} target="_blank" rel="noreferrer" className="mt-2 block text-tinta underline">Abrir PDF con comentarios</a>}
      {t.tipo === 'cubierta_extendida' && <p className="mt-2 text-xs text-gray-500">Creativa: {t.revisionCreativaResultado ?? 'Pendiente'} · Interna: {v.aprobadaInternaEn ? 'Aprobada' : 'Pendiente'} · Autor: {v.aprobadaAutorEn ? 'Aprobada' : v.enviadaAutorEn ? 'En revisión' : 'Sin enviar'}</p>}
      {v.handoffEn && <p className="mt-2 text-green-700">Entregada a Calidad · {fechaHora(v.handoffEn)}</p>}
    </div>}
    {esDisenador && !t.cerradoEn && (!v || v.feedbackEn) && <div className="mt-4 flex flex-col gap-2 sm:flex-row"><label className="flex-1 text-xs text-gray-600">Enlace de la nueva versión<input type="url" className={campo} value={enlace} onChange={e => setEnlace(e.target.value)} /></label><button className={boton} disabled={!enlace || accion.isPending} onClick={enviar}>Entregar {v ? `V${v.numero + 1}` : 'V1'}</button></div>}
    {esEspecialista && !t.cerradoEn && <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      <div className="grid gap-2 sm:grid-cols-3"><label className="text-xs text-gray-600">Diseñador<select className={campo} value={disenador} onChange={e => setDisenador(e.target.value)}><option value="">Seleccionar</option>{carga.data?.disenadores.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select></label><label className="text-xs text-gray-600">Pautar vencimiento exacto<input type="datetime-local" className={campo} value={due} onChange={e => setDue(e.target.value)} /></label><button className={boton} disabled={!disenador || accion.isPending} onClick={() => accion.mutate(() => asignarDiseno(t.id, disenador, due ? new Date(due).toISOString() : undefined))}>Asignar / actualizar plazo</button></div>
      <ErrorAccion error={carga.error} />
      {v && !v.feedbackEn && <><label className="block text-xs text-gray-600">Feedback o correcciones<textarea className={campo} value={feedback} onChange={e => setFeedback(e.target.value)} /></label><label className="block text-xs text-gray-600">Cantidad de comentarios<input type="number" min="0" className={campo} value={comentarios} onChange={e => setComentarios(Number(e.target.value))} /></label>
        <div className="flex flex-wrap gap-2"><button className={boton} disabled={!feedback.trim() || accion.isPending} onClick={() => accion.mutate(() => coordinarDiseno(t.id, v.id, { accion: 'feedback', feedback, cantidadComentarios: comentarios }))}>Enviar ajustes a Diseño</button>
          {t.tipo === 'diagramacion' ? <button className={boton} disabled={accion.isPending} onClick={() => accion.mutate(() => coordinarDiseno(t.id, v.id, { accion: 'handoff_calidad' }))}>Enviar versión a Calidad</button> : !v.enviadaAutorEn ? <><label className="text-xs text-gray-600">Pautar feedback del autor (referencia: 1 día)<input type="datetime-local" className={campo} value={feedbackDue} onChange={e => setFeedbackDue(e.target.value)} /></label><button className={boton} disabled={accion.isPending || (t.tipo === 'cubierta_extendida' && (!v.aprobadaInternaEn || t.revisionCreativaResultado !== 'aprobado'))} onClick={() => accion.mutate(() => coordinarDiseno(t.id, v.id, { accion: 'enviar_autor', feedbackAutorDueAt: feedbackDue ? new Date(feedbackDue).toISOString() : undefined }))}>Registrar envío al autor</button></> : <button className={boton} disabled={accion.isPending} onClick={() => accion.mutate(() => coordinarDiseno(t.id, v.id, { accion: 'aprobar_autor' }))}>Registrar aprobación del autor</button>}
        </div>{v.enviadaAutorEn && <p className="text-xs text-gray-500">Enviado: {fechaHora(v.enviadaAutorEn)} · Feedback pautado: {fechaHora(v.feedbackAutorDueAt)}</p>}
      </>}
    </div>}
    {modo !== 'operativo' && v && !v.feedbackEn && !t.cerradoEn && !(modo === 'creativa' ? t.revisionCreativaResultado : v.aprobadaInternaEn) && <div className="mt-4 space-y-2"><label className="block text-xs text-gray-600">Observaciones de revisión<textarea className={campo} value={feedback} onChange={e => setFeedback(e.target.value)} /></label><div className="flex flex-wrap gap-2"><button className={boton} disabled={accion.isPending} onClick={() => accion.mutate(() => revisarCubierta(t.id, v.id, true, undefined, modo === 'interna'))}>Aprobar {modo === 'creativa' ? 'verificación creativa' : 'corrección interna e identidad'}</button><button className={boton} disabled={!feedback.trim() || accion.isPending} onClick={() => accion.mutate(() => revisarCubierta(t.id, v.id, false, feedback, modo === 'interna'))}>Devolver con correcciones</button></div></div>}
    <ErrorAccion error={accion.error} />
    {t.versiones.length > 1 && <details className="mt-4 text-sm"><summary className="cursor-pointer text-gray-500">Historial de versiones ({t.versiones.length})</summary><ul className="mt-2 space-y-2">{t.versiones.map(h => <li key={h.id} className="break-words"><a className="underline" href={h.enlace} target="_blank" rel="noreferrer">V{h.numero}</a> · {fechaHora(h.entregadoEn)}{h.feedback ? ` · ${h.feedback}` : ''}</li>)}</ul></details>}
  </article>;
}
function Solicitar({ proyectoId }: { proyectoId: string }) {
  const [tipo, setTipo] = useState<TipoDiseno>('muestra_diagramacion'); const [fuente, setFuente] = useState('');
  const [capitulos, setCapitulos] = useState(3); const [correccion, setCorreccion] = useState(''); const [aprobacion, setAprobacion] = useState('');
  const [confirmada, setConfirmada] = useState(false); const [key, setKey] = useState(() => crypto.randomUUID()); const qc = useQueryClient();
  const cs = useQuery({ queryKey: ['correcciones', proyectoId], queryFn: () => fetchCorreccionesDeProyecto(proyectoId), enabled: tipo === 'diagramacion' });
  const mutation = useMutation({ mutationFn: () => solicitarDiseno(proyectoId, { tipo, solicitudKey: key, fuenteUrl: fuente, preparacionConfirmada: confirmada,
    capitulosMuestra: tipo === 'muestra_diagramacion' ? capitulos : undefined, correccionId: tipo === 'diagramacion' ? correccion : undefined, aprobacionEdicionUrl: tipo === 'diagramacion' ? aprobacion : undefined }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['diseno'] }); setKey(crypto.randomUUID()); setFuente(''); setConfirmada(false); } });
  return <form onSubmit={(e: FormEvent) => { e.preventDefault(); mutation.mutate(); }} className="mb-5 space-y-3 rounded-xl border border-tinta/10 bg-gray-50 p-4">
    <h3 className="font-semibold text-tinta">Solicitar trabajo de Diseño</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-gray-600">Entregable<select className={campo} value={tipo} onChange={e => setTipo(e.target.value as TipoDiseno)}>{Object.entries(etiquetas).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label><label className="text-xs text-gray-600">Enlace de archivo preparado / complementos<input required type="url" className={campo} value={fuente} onChange={e => setFuente(e.target.value)} /></label></div>
    {tipo === 'muestra_diagramacion' && <label className="block text-xs text-gray-600">Capítulos incluidos en la muestra<input type="number" min="3" value={capitulos} className={campo} onChange={e => setCapitulos(Number(e.target.value))} /></label>}
    {tipo === 'diagramacion' && <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-gray-600">Tripa corregida<select required className={campo} value={correccion} onChange={e => setCorreccion(e.target.value)}><option value="">Seleccionar</option>{cs.data?.correcciones.filter(c => c.alcance === 'tripa_completa' && c.fechaEntrega).map(c => <option key={c.id} value={c.id}>Entrega {c.fechaEntrega}</option>)}</select></label><label className="text-xs text-gray-600">Enlace a aprobación de Jefatura de Edición<input required type="url" className={campo} value={aprobacion} onChange={e => setAprobacion(e.target.value)} /></label></div>}
    <label className="flex items-start gap-2 text-sm text-gray-600"><input type="checkbox" checked={confirmada} onChange={e => setConfirmada(e.target.checked)} />{tipo === 'diagramacion' ? 'Tripa con cambios aceptados, créditos, preliminares corregidos, destacados y editables aplicables preparados.' : tipo === 'cubierta_extendida' ? 'Complementos de cubierta (sinopsis, redes y frases aplicables) preparados; recursos canónicos disponibles.' : 'Primeros tres capítulos de la tripa enviada a corrección preparados.'}</label>
    <button className={boton} disabled={!confirmada || mutation.isPending}>Solicitar Diseño</button><ErrorAccion error={mutation.error || cs.error} />
  </form>;
}
export function SeccionDisenoOperativa({ proyectoId }: { proyectoId: string }) {
  const { data: user } = useMe(); const roles = ['especialista', 'disenador', 'jefe_area', 'soporte_editorial'];
  const q = useQuery({ queryKey: ['diseno', 'proyecto', proyectoId], queryFn: () => fetchDisenos(proyectoId), enabled: !!user && roles.includes(user.rol) });
  if (!user || !roles.includes(user.rol)) return null;
  return <section className="min-w-0 w-full p-4 sm:p-6"><h2 className="mb-4 text-xl font-bold text-tinta">Diseño y diagramación</h2>{user.rol === 'especialista' && <Solicitar proyectoId={proyectoId} />}{q.isLoading && <p>Cargando trabajos…</p>}<ErrorAccion error={q.error} />{q.data?.trabajos.length === 0 && <p className="text-sm text-gray-500">Todavía no hay trabajos solicitados.</p>}<div className="space-y-4">{q.data?.trabajos.map(t => <TarjetaDiseno key={t.id} trabajo={t} />)}</div></section>;
}
export function RevisionesCubiertaPanel({ interna = false }: { interna?: boolean }) {
  const q = useQuery({ queryKey: ['diseno', 'revisiones', interna], queryFn: () => fetchDisenos(undefined, true) });
  const pendientes = q.data?.trabajos.filter(t => t.versiones.length && !t.cerradoEn && !t.versiones[0].feedbackEn && (interna ? !t.versiones[0].aprobadaInternaEn : !t.revisionCreativaResultado)) ?? [];
  return <section className="mb-6 min-w-0"><h2 className="mb-4 text-xl font-bold text-tinta">{interna ? 'Corrección interna de cubiertas' : 'Revisiones de cubierta'}</h2><ErrorAccion error={q.error} />{q.isLoading && <p>Cargando revisiones…</p>}<div className="space-y-4">{pendientes.map(t => <TarjetaDiseno key={t.id} trabajo={t} modo={interna ? 'interna' : 'creativa'} />)}</div>{q.data && pendientes.length === 0 && <p className="text-sm text-gray-500">Sin revisiones de cubierta.</p>}</section>;
}
