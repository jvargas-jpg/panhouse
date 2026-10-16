import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PreparacionProyecto } from '../../../shared/operacionEspecialista';
import { apiFetch } from '../lib/api';
import { fechaSolicitud } from '../especialista/SolicitudesPage';
import { invalidarOperacion } from './operacionQueries';
import { ProjectWorkspaceCard } from './ProjectWorkspaceCard';

function localDate(s: string | null) {
  if (!s) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(s));
  const p = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function CommandCenterPreparacion({ id, data }: { id: string; data: PreparacionProyecto }) {
  const cache = useQueryClient();
  const [v, setV] = useState({ ...data, reunionOperativaFecha: localDate(data.reunionOperativaFecha) });
  const mutation = useMutation({ mutationFn: () => apiFetch('/proyectos/'+id+'/preparacion-inicial', { method: 'PATCH', body: JSON.stringify({
    recibidoEn: v.recibidoEn, expedienteRevisadoEn: v.expedienteRevisadoEn, primerContactoEn: v.primerContactoEn,
    reunionOperativaFecha: v.reunionOperativaFecha ? new Date(v.reunionOperativaFecha+'-04:00').toISOString() : null,
    reunionOperativaRealizada: v.reunionOperativaRealizada, grabacionUrl: v.grabacionUrl || null, transcripcionUrl: v.transcripcionUrl || null,
    minutaUrl: v.minutaUrl || null, cronogramaUrl: v.cronogramaUrl || null, observaciones: v.observaciones || null,
  }) }), onSuccess: () => invalidarOperacion(cache, id) });
  return <div className="cc-preparation">
    <p className="cc-caption">Recepción, primer contacto y organización del proyecto desde su asignación.</p>
    <p className="cc-deadline">Primer contacto · {data.primerContactoEn ? 'Registrado '+fechaSolicitud(data.primerContactoEn, true) : data.primerContactoDueAt ? 'Plazo '+fechaSolicitud(data.primerContactoDueAt, true) : 'Asignación anterior sin fecha auditada; plazo no calculable'}</p>
    <ProjectWorkspaceCard id={id} editable={data.editable} initial={data.workspace}/>
    {data.driveCarpetaUrl&&data.driveEstado!=='configurado'&&<p className="cc-caption">Enlace anterior, sin workspace registrado: <a href={data.driveCarpetaUrl} target="_blank" rel="noopener noreferrer">Consultar carpeta histórica ↗</a></p>}
    <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
      <fieldset disabled={!data.editable || mutation.isPending}><legend>Recepción y contacto</legend>
        {(['recibidoEn','expedienteRevisadoEn','primerContactoEn'] as const).map((k, i) => <label className="cc-check" key={k}><input type="checkbox" checked={!!v[k]} onChange={e => setV({...v,[k]:e.target.checked?new Date().toISOString():null})}/>{['Proyecto recibido','Expediente revisado','Primer contacto con el autor realizado'][i]}{v[k]&&<small>{fechaSolicitud(v[k],true)}</small>}</label>)}
      </fieldset>
      {data.editable ? <><fieldset disabled={mutation.isPending}><legend>Reunión operativa</legend>
        <label className="cc-label">Fecha y hora · Caracas<input type="datetime-local" value={v.reunionOperativaFecha} onChange={e => setV({...v,reunionOperativaFecha:e.target.value})}/></label>
        <label className="cc-check"><input type="checkbox" checked={v.reunionOperativaRealizada} onChange={e => setV({...v,reunionOperativaRealizada:e.target.checked})}/>Reunión realizada</label>
      </fieldset><fieldset disabled={mutation.isPending}><legend>Documentos de preparación</legend><p className="cc-caption">Registra los enlaces de los documentos preparados para el proyecto.</p>
        {(['grabacionUrl','transcripcionUrl','minutaUrl','cronogramaUrl'] as const).map((k,i) => <label className="cc-label" key={k}>{['Grabación de reunión','Transcripción de reunión','Minuta operativa','Cronograma del proyecto'][i]}<input type="url" value={v[k] ?? ''} placeholder="https://…" onChange={e => setV({...v,[k]:e.target.value})}/></label>)}
        <label className="cc-label">Observaciones<textarea rows={3} maxLength={2000} value={v.observaciones ?? ''} onChange={e => setV({...v,observaciones:e.target.value})}/></label>
      </fieldset><button className="fv-button fv-primary" disabled={mutation.isPending}>{mutation.isPending?'Guardando…':'Guardar preparación'}</button></> : <dl className="cc-read-preparation"><dt>Reunión operativa</dt><dd>{v.reunionOperativaFecha ? fechaSolicitud(data.reunionOperativaFecha,true) : 'Pendiente'} · {v.reunionOperativaRealizada?'Realizada':'Sin realizar'}</dd>{(['driveCarpetaUrl','grabacionUrl','transcripcionUrl','minutaUrl','cronogramaUrl'] as const).map(k=>v[k]?<dd key={k}><a href={v[k]!} target="_blank" rel="noreferrer">{k === 'driveCarpetaUrl'?'Abrir carpeta Drive':k.replace('Url','')} ↗</a></dd>:null)}</dl>}
      {mutation.isError&&<p role="alert">{mutation.error.message}</p>}{mutation.isSuccess&&<p role="status">Preparación guardada.</p>}
    </form>
  </div>;
}
