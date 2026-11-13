import { validationWorkLabel, type ValidationWorkIdentity } from '../../../shared/validationWork.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { ValidationNavigation, validationDate as date } from './ValidationUi';
import { apiFetch } from '../lib/api';
import { Dialog } from '../design-system/Dialog';
import './validaciones.css';

export interface ValidationRow extends ValidationWorkIdentity { id: string; projectId?: string; title: string; author: string; phase: string; round: number; version: string; dueAt: string | null; pages: number | null; provider: string | null; validator: string | null; requested: boolean; assigned: boolean; status: string }
export interface ValidationDetail extends ValidationWorkIdentity { id: string; title: string; author: string; phase: string; phaseNumber: number; collectionName?: string | null; round: number; version: string; dueAt: string | null; provider: string | null; assignmentId: string; started: boolean; canApprove: boolean; upload: { name: string; fileId: string } | null; materials: { label: string; url: string; role: string }[] }
export const validationKey = ['validaciones'];
export const command = <T,>(path: string, body?: unknown) => apiFetch<T>('/validaciones' + path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
export function ValidationReview({ detail: d, refresh }: { detail: ValidationDetail; refresh: () => void }) {
 const approvalLabel = d.workType === 'REVISION_CUBIERTA' ? 'Confirmar revisión de cubierta' : 'Todos los cambios fueron aplicados correctamente';
 const [upload, setUpload] = useState(d.upload), [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirm, setConfirm] = useState(false), [comments, setComments] = useState(''), [observations, setObservations] = useState(''), [extension, setExtension] = useState('pdf');
 const [collectionReason, setCollectionReason] = useState('');
 const collection = useMutation({ mutationFn: () => command(`/${d.id}/coleccion`, { motivo: collectionReason }) });
 const [uploadKey, setUploadKey] = useState(() => crypto.randomUUID());
 const [decisionKey] = useState(() => crypto.randomUUID());
 useEffect(() => { command(`/${d.id}/iniciar`).then(refresh).catch(e => setError(e.message)); }, [d.id]);
 const filename = `${d.version}_${d.workType === 'REVISION_CUBIERTA' ? 'CUBIERTA' : `F${d.phaseNumber}`}_R${d.round}_correcciones_a_aplicar_${uploadKey}.${extension}`;
 async function receive(file?: File) {
  if (!file || busy || decision.isPending) return;
  const keyForUpload = upload ? crypto.randomUUID() : uploadKey;
  setUploadKey(keyForUpload);
  setError(''); setUpload(null);
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''; setExtension(ext);
  if (!['pdf', 'doc', 'docx'].includes(ext) || file.size === 0 || file.size > 20 * 1024 * 1024) { setError('Selecciona un PDF o Word de hasta 20 MB.'); return; }
  setBusy(true);
  try {
   const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('No se pudo leer el archivo')); reader.readAsDataURL(file); });
   const saved = await command<{ name: string; fileId: string }>(`/${d.id}/archivo`, { name: file.name, contentBase64: data, key: keyForUpload });
   setUpload(saved); refresh();
  } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
 }
 const decision = useMutation({ mutationFn: (result: 'comentarios' | 'todos_aplicados') => command(`/${d.id}/decision`, { result, key: decisionKey, assignmentId: d.assignmentId, ...(result === 'comentarios' && comments ? { comments: Number(comments) } : {}), ...(observations ? { observations } : {}) }), onSuccess: refresh });
 return <article className="vr-review" aria-label="Superficie de revisión">
  <header><p className="vr-eyebrow">{validationWorkLabel(d)}</p><h2>{d.title}</h2><p>{d.author}</p><div className="vr-context"><strong>Versión para revisar: {d.version}</strong><span>Ronda {d.round}</span><span>Asignado por Jefatura</span>{d.dueAt && <span>Fecha límite: {date(d.dueAt)}</span>}{d.provider && <span>Diseño aliado: {d.provider}</span>}</div></header>
  <section><h3>Archivos para revisar</h3><div className="vr-files">{d.materials.map(m => <a key={m.role} href={m.url} target="_blank" rel="noreferrer"><span aria-hidden="true">↗</span>{m.label}</a>)}</div></section>
  {[1,3].includes(d.phaseNumber) && <details className="vr-management"><summary>Revisar colección{d.collectionName ? `: ${d.collectionName}` : ''}</summary><p>Si la colección no corresponde al contenido del libro, avisa a Jefatura.</p><label>Motivo<textarea className="vr-textarea" maxLength={1000} value={collectionReason} onChange={e => setCollectionReason(e.target.value)}/></label><button className="vr-secondary" disabled={collection.isPending || collectionReason.trim().length < 10} onClick={() => collection.mutate()}>Avisar a Jefatura</button>{collection.isSuccess && <p role="status">Jefatura recibió la alerta.</p>}{collection.error && <p role="alert">{collection.error.message}</p>}</details>}
  <section><h3>Archivo con tus comentarios</h3><label className={`vr-dropzone ${busy ? 'vr-busy' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void receive(e.dataTransfer.files[0]); }}>
   <strong>{busy ? 'Guardando en Google Drive…' : 'Arrastra aquí el archivo revisado'}</strong><span>PDF o Word · hasta 20 MB</span><span className="vr-file-button">Seleccionar archivo</span><input aria-label="Seleccionar archivo revisado" type="file" accept=".pdf,.doc,.docx" disabled={busy || decision.isPending} onChange={e => void receive(e.target.files?.[0])}/>
  </label><p className="vr-save-name"><strong>Se guardará como:</strong><br/>{filename}</p>{upload && <p className="vr-success" role="status">Guardado correctamente en Drive: {upload.name}</p>}
  <div className="vr-fields"><label>Cantidad de comentarios (si la conoces)<input type="number" min="1" value={comments} onChange={e => setComments(e.target.value)}/></label><label>Observaciones relevantes<textarea value={observations} onChange={e => setObservations(e.target.value)} maxLength={10000}/></label></div></section>
  <footer className="vr-decisions"><div><button className="vr-primary" disabled={!upload || busy || decision.isPending} onClick={() => decision.mutate('comentarios')}>Enviar cambios para aplicar</button>{!upload && <p>Sube primero el archivo con tus comentarios.</p>}</div><div><button className="vr-secondary" disabled={!d.canApprove || busy || decision.isPending} onClick={() => setConfirm(true)}>{approvalLabel}</button>{!d.canApprove && <p>Disponible al revisar una versión posterior generada después de tus comentarios.</p>}</div></footer>
  {(error || decision.error) && <p role="alert" className="vr-error">{error || decision.error?.message}</p>}
  {confirm && <Dialog title="Confirmar validación" busy={decision.isPending} onClose={() => setConfirm(false)}><div className="vr-confirm"><p>Estás confirmando que la versión {d.version} incorpora correctamente todos los comentarios pendientes.</p><p>Esta decisión cerrará la ronda actual de validación.</p><button autoFocus className="vr-secondary" disabled={decision.isPending} onClick={() => setConfirm(false)}>Cancelar</button><button className="vr-primary" disabled={decision.isPending} onClick={() => decision.mutate('todos_aplicados')}>Confirmar validación</button>{decision.error && <p role="alert">{decision.error.message}</p>}</div></Dialog>}
 </article>;
}
export function ValidacionesPage() {
 const cache = useQueryClient(), [params, setParams] = useSearchParams();
 const query = useQuery({ queryKey: validationKey, queryFn: () => apiFetch<{ items: ValidationRow[] }>('/validaciones/'), refetchInterval: 15000 });
 const id = params.get('validacion') ?? params.get('workItem') ?? query.data?.items[0]?.id;
 const detail = useQuery({ queryKey: [...validationKey, id], queryFn: () => apiFetch<ValidationDetail>(`/validaciones/${id}`), enabled: !!id && !!query.data?.items.some(i => i.id === id), refetchInterval: 15000 });
 const refresh = () => { void cache.invalidateQueries({ queryKey: validationKey }); void cache.invalidateQueries({ queryKey: ['notificaciones'] }); };
 const items = query.data?.items ?? [];
 useEffect(() => { if (query.data && id && !items.some(i => i.id === id)) setParams({}, { replace: true }); }, [query.data, id]);
 return <CrmSidebarLayout nav={<ValidationNavigation/>} contentMaxWidth="max-w-[1440px]" contentClassName="p-4 sm:p-7">
  <main className="vr-page"><header className="vr-heading"><p className="vr-eyebrow">Validadores</p><h1>Validaciones</h1><p>{items.length ? `${items.length} validaciones requieren tu atención` : 'No tienes validaciones pendientes.'}</p></header>
   {query.isPending && <p role="status">Consultando trabajos asignados…</p>}{query.error && <p role="alert">{query.error.message}</p>}
   <div className="vr-workspace"><ValidationInbox items={items} selectedId={id} onSelect={id => setParams({ validacion: id })}/>
   <div>{detail.isFetching && !detail.data && id && <p role="status">Abriendo revisión…</p>}{detail.error && <p role="alert">{detail.error.message}</p>}{detail.data && items.some(i => i.id === detail.data.id) && <ValidationReview key={detail.data.assignmentId} detail={detail.data} refresh={refresh}/>}</div></div>
  </main></CrmSidebarLayout>;
}

export function ValidationInbox({ items, selectedId, onSelect }: { items: ValidationRow[]; selectedId?: string; onSelect: (id: string) => void }) {
 return <aside className="vr-inbox"><h2>Trabajos asignados</h2>{items.map(i => <button key={i.id} className={`vr-job ${i.id === selectedId ? 'vr-selected' : ''}`} onClick={() => onSelect(i.id)}><strong>{i.author} — {i.title}</strong><span>{validationWorkLabel(i)}</span><span>Versión recibida: {i.version}</span>{i.pages && <span>{i.pages} páginas</span>}{i.provider && <span>Diseño aliado: {i.provider}</span>}{i.dueAt && <span>Entrega: {date(i.dueAt)}</span>}<b>Revisar →</b></button>)}{!items.length && <p>Los trabajos aparecerán aquí cuando Jefatura te asigne una revisión o Diseño entregue una nueva versión.</p>}</aside>;
}
