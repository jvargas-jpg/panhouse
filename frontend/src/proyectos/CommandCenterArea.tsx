import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProcesoProyecto } from '../../../shared/projectCommandCenter';
import { apiFetch } from '../lib/api';
import { invalidarOperacion } from './operacionQueries';
import { ReadFields, Estado } from './fichaViva/FichaElements';
import { fechaSolicitud } from '../especialista/SolicitudesPage';
export function CommandCenterArea({id,proceso,rrpp}:{id:string;proceso:ProcesoProyecto;rrpp:boolean}) {
  const cache=useQueryClient(),ctx=proceso.activacion;
  const request=useMutation({mutationFn:()=>apiFetch('/proyectos/'+id+'/solicitar-'+proceso.tipo,{method:'POST',body:'{}'}),onSuccess:()=>invalidarOperacion(cache,id)});
  return <section className="cc-area-detail"><div className="cc-area-owner"><strong>Operado por {proceso.ownerLabel}</strong><span>{proceso.assignee ?? 'Responsable individual por asignar'}</span></div><Estado state={proceso.estado}/><p>{proceso.detalle}</p>
    {ctx?.solicitud&&<div className="cc-request-summary"><strong>Solicitud {ctx.solicitud.estado.replaceAll('_',' ')}</strong><span>Enviada {fechaSolicitud(ctx.solicitud.requestedAt,true)}</span>{ctx.solicitud.resolvedAt&&<span>Activada {fechaSolicitud(ctx.solicitud.resolvedAt,true)}</span>}</div>}
    {proceso.action?.kind==='solicitar'&&<button className="fv-button fv-primary" disabled={request.isPending||request.isSuccess} onClick={()=>request.mutate()}>{request.isPending?'Enviando…':request.isSuccess?'Solicitud enviada':proceso.action.label}</button>}
    {proceso.action?.href&&<Link className="fv-button" to={proceso.action.href}>{proceso.action.label}</Link>}
    {ctx?.activo&&<ReadFields fields={(proceso.seguimiento ?? []).filter(f=>f.value!==null)}/>}
    {rrpp&&ctx?.activo&&proceso.tipo==='lanzamiento'&&<Link className="fv-button fv-primary" to={'/rrpp/lanzamientos?proyecto='+id}>Gestionar planificación en RRPP</Link>}
    {request.isError&&<p role="alert">{request.error.message} <button onClick={()=>request.mutate()}>Reintentar envío</button></p>}
  </section>;
}
