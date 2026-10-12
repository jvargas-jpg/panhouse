import type { AccionEspecialista } from '../../shared/especialistaInicio.js';
import type { ProyectoJefatura } from '../../shared/jefatura.js';

export const diaCaracas = (fecha: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
export interface HechosAtencion {
  titulo: string | null; subtitulo: string | null; editorId: string | null;
  capitulos: { numero: number; entrega: string | null; envio: string | null; respuesta: string | null; vence: string | null }[];
  decisiones: { id: string; subject: string; status: string; requester: string }[];
  creativas: { id: string; brief: string | null; autor: string | null; enviado?: string | null }[];
  versiones: { id: string; enviado: Date | null; aprobado: Date | null; feedback: Date | null; handoff: Date | null; venceAutor?: Date | null; calidadId?: string | null }[];
  revisiones: { id: string; revisado: Date | null; aprobado: boolean | null; autor: Date | null; fase: number }[];
}
// Una acción exige coordinación propia. No contar espera aún en plazo ni ejecución del otro rol.
// Se comparte entre Home y Command Center; los gates de escritura siguen en cada workflow.
export function accionesEspecialista(p: ProyectoJefatura, hechos: HechosAtencion, actorId: string, ahora = new Date()): AccionEspecialista[] {
  if (!['en_proceso', 'retrasado', 'stand_by', 'pausado'].includes(p.estado)) return [];
  const acciones: AccionEspecialista[] = [];
  const agregar = (id: string, titulo: string, detalle: string, proceso: string, fecha: string | null = null, extra: Partial<AccionEspecialista> = {}) => acciones.push({ id: p.id+':'+id, proyectoId: p.id, titulo, detalle, proceso, fecha, prioridad: 'pendiente', ...extra });
  for (const d of hechos.decisiones.filter(d => d.status === 'informacion_solicitada' && d.requester === actorId))
    agregar(d.id, 'Responder a Jefatura', d.subject, 'correccion', null, { href: `/decisiones/${d.id}/responder` });
  for (const t of p.procesos.filter(t => t.vencido && !t.entregado))
    agregar('vence-'+t.id, 'Dar seguimiento a entrega vencida', t.nombre+' · '+(t.responsable ?? 'Responsable por confirmar'), t.tipo, t.vence, { prioridad: 'vencida' });
  // Títulos son condición creativa, no un pendiente genérico de todos los proyectos recién ingresados.
  if (hechos.creativas.length && (!hechos.titulo?.trim() || !hechos.subtitulo?.trim()))
    agregar('titulos', 'Cerrar títulos para Dirección creativa', 'Falta título o subtítulo definitivo', 'direccion_creativa', null, { editarContexto: true });
  // La intervención pendiente de Edición ya representa un Editor solicitado.
  // Su asignación espera a Jefatura de Edición; no volver a contar "solicitar".
  const porEnviar = hechos.capitulos.filter(c => c.entrega && !c.envio);
  if (porEnviar.length) agregar('cap-enviar', `Enviar ${porEnviar.length} ${porEnviar.length === 1 ? 'capítulo' : 'capítulos'} al autor`, 'Entregas disponibles: '+porEnviar.map(c => c.numero).join(', '), 'edicion');
  const vencidos = hechos.capitulos.filter(c => c.envio && !c.respuesta && c.vence && c.vence < diaCaracas(ahora));
  if (vencidos.length) agregar('cap-feedback', 'Solicitar feedback vencido al autor', 'Capítulos: '+vencidos.map(c => c.numero).join(', '), 'edicion', vencidos.map(c => c.vence!).sort()[0]!, { prioridad: 'vencida' });
  for (const t of p.procesos.filter(t => t.tipo === 'correccion' && t.estado === 'pendiente' && !t.responsable && !t.decisionId))
    agregar('corrector-'+t.id, 'Asignar Corrector', 'Solicitud pendiente de responsable; conserva revisión previa y contrato', 'correccion');
  for (const t of p.procesos.filter(t => t.tipo === 'correccion' && t.entregado && !t.decisionId))
    agregar('entrega-'+t.id, 'Revisar entrega de Corrección', 'Entrega registrada; coordinar validación y cierre de la intervención', 'correccion');
  for (const c of hechos.creativas.filter(c => c.brief && !c.autor && !c.enviado))
    agregar('brief-'+c.id, 'Coordinar aprobación del brief', 'Brief entregado; verificar envío y respuesta del autor', 'direccion_creativa', c.brief);
  for (const v of hechos.versiones.filter(v => !v.enviado && !v.feedback && !v.aprobado && !v.handoff))
    agregar('diseno-'+v.id, 'Coordinar revisión de Diseño', 'Versión entregada; consultar verificaciones internas antes del envío', 'diseno');
  for (const v of hechos.versiones.filter(v => v.enviado && !v.aprobado && !v.feedback && v.venceAutor && v.venceAutor < ahora))
    agregar('feedback-'+v.id, 'Solicitar respuesta vencida al autor', 'Versión de Diseño enviada; plazo de respuesta vencido', 'diseno', v.venceAutor!.toISOString(), {prioridad:'vencida'});
  for (const q of hechos.revisiones.filter(q => q.fase < 3 && q.revisado && q.aprobado && !q.autor && !hechos.versiones.some(v => v.calidadId === q.id && v.enviado)))
    agregar('calidad-'+q.id, 'Coordinar aprobación del autor', 'Revisión de Calidad aprobada; consultar envío y respuesta', 'calidad');
  return acciones.sort((a,b) => Number(b.prioridad === 'vencida')-Number(a.prioridad === 'vencida') || (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999') || a.id.localeCompare(b.id));
}
