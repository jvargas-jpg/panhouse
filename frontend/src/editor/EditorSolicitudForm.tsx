import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { EDITOR_REQUEST_LABELS, EDITOR_REQUEST_TYPES, type EditorRequestType } from '../../../shared/editorOwn';
import { crearSolicitud } from './editorApi';

// Backend controla qué tipos existen (prompt §84-85): el frontend solo
// ofrece el selector de los 3 tipos permitidos, nunca un formulario libre.
export function NuevaSolicitudForm({ workItemId, onDone, onCancel }: { workItemId: string; onDone: () => void; onCancel: () => void }) {
  const cache=useQueryClient();
  const [type, setType] = useState<EditorRequestType>('editor_apoyo');
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if(busy)return; setBusy(true); setError('');
    try { await crearSolicitud(workItemId, type, motivo); await cache.invalidateQueries({queryKey:['editor']}); await cache.invalidateQueries({queryKey:['notificaciones']}); onDone(); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.'); }
    finally { setBusy(false); }
  }
  return <form className="ep-form" onSubmit={submit}>
    <div className="es-type-picker" role="group" aria-label="Tipo de solicitud">
      {EDITOR_REQUEST_TYPES.map(t => <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>{EDITOR_REQUEST_LABELS[t]}</button>)}
    </div>
    <label>Motivo<textarea required minLength={5} maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
    {error && <p role="alert" className="ec-empty">{error}</p>}
    <div className="ep-actions"><button className="ec-primary" disabled={busy}>Enviar solicitud</button><button type="button" onClick={onCancel}>Cancelar</button></div>
  </form>;
}
