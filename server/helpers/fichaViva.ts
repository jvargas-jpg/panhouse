import { nombreServicioProyecto, proyectarIngreso } from '../../shared/planificacion.js';
import { and, asc, count, desc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { auditLogs, autores, capitulos, correcciones, direccionesCreativas, disenos, disenoVersiones, fichaCalidadFases, fichaDisenoPropuestas, fichaDistribucionPaises, fichaDocumentalDatos, fichaLanzamientoReuniones, fichasTrazabilidad, presupuestos, projectAssignments, proyectos, proyectosAutores, rrppEventos, rrppPublicaciones, servicios, unidades, users, workItems, type Rol, type ValorDocumental } from '../db/schema/index.js';
import { CAMPOS_DOCUMENTALES } from './fichaDocumentalCatalogo.js';
import { evaluarPreparacionComercial } from './preparacionComercial.js';
import { obtenerEspecialistaActual } from './carga.js';
import { evaluarPreparacionRrpp } from './preparacionRrpp.js';
import { fechasLanzamientoCanonicas } from './rrppLanzamientoFicha.js';
import { preparacionesProyecto, solicitudesArea } from '../db/schema/index.js';
import { registrarEvento } from './auditLog.js';
import { criteriosDeFase } from './calidad.js';
import type { Tx } from './tx.js';
import { EVENTOS_PROYECTO_RRPP } from './rrppProyectoEventos.js';
import type { ActorFicha } from './intakeRrpp.js';
import type { AccionFicha, ActividadFicha, AreaFicha, AreaResumen, CampoFicha, EquipoFicha, EstadoArea, ExpedienteFicha, HistorialFicha, ResumenFichaViva } from '../../shared/fichaViva.js';
export const ROLES_FICHA_VIVA: Rol[] = ['comercial', 'rrpp', 'especialista', 'editor', 'jefe_edicion', 'corrector', 'disenador', 'lider_creativo', 'jefe_area', 'soporte_editorial', 'soporte_digital', 'impresion', 'distribucion', 'direccion'];
export const AREAS_FICHA: {
    id: AreaFicha;
    name: string;
    types: string[];
    prefix: string;
}[] = [
    { id: 'proyecto', name: 'Proyecto / Ingreso', types: ['intake_rrpp'], prefix: 'ingreso' },
    { id: 'edicion', name: 'Edición', types: ['edicion'], prefix: 'edicion' },
    { id: 'correccion', name: 'Corrección', types: ['correccion'], prefix: 'correccion' },
    { id: 'diseno', name: 'Diseño y diagramación', types: ['diseno', 'revision_interna_cubierta'], prefix: 'diseno' },
    { id: 'calidad', name: 'Calidad editorial', types: ['calidad'], prefix: 'calidad' },
    { id: 'digital', name: 'Soporte digital', types: ['soporte_digital'], prefix: 'digital' },
    { id: 'lanzamiento', name: 'Lanzamiento y promoción', types: ['lanzamiento'], prefix: 'lanzamiento' },
    { id: 'impresion', name: 'Impresión', types: ['impresion'], prefix: 'impresion' },
    { id: 'distribucion', name: 'Distribución', types: ['distribucion'], prefix: 'distribucion' },
];
export class ErrorFichaViva extends Error {
    readonly statusCode: number;
    constructor(public status: number, message: string) { super(message); this.statusCode = status; }
}
export async function verificarAccesoFichaViva(id: string, actor: ActorFicha, client: typeof db | Tx = db) {
    if (!ROLES_FICHA_VIVA.includes(actor.rol))
        throw new ErrorFichaViva(403, 'No autorizado para consultar el expediente interno');
    const [p] = await client.select().from(proyectos).where(eq(proyectos.id, id)).limit(1);
    if (!p)
        throw new ErrorFichaViva(404, 'Proyecto no encontrado');
    if (actor.rol === 'especialista') p.especialistaId = await obtenerEspecialistaActual(id, p.especialistaId, client);
    const assigned = actor.rol === 'especialista' ? p.especialistaId : actor.rol === 'editor' ? p.editorId : actor.rol === 'disenador' ? p.disenadorId : undefined;
    if (assigned !== undefined && assigned !== actor.id)
        throw new ErrorFichaViva(403, 'Proyecto asignado a otra persona');
    if (actor.rol === 'corrector' && p.correctorId !== actor.id) {
        const [a] = await client.select({ id: projectAssignments.id }).from(projectAssignments).where(and(eq(projectAssignments.proyectoId, id), eq(projectAssignments.usuarioId, actor.id), eq(projectAssignments.tipo, 'corrector'), isNull(projectAssignments.finalizadoEn))).limit(1);
        if (!a)
            throw new ErrorFichaViva(403, 'No tiene una intervención vigente en este proyecto');
    }
    return p;
}
const LABELS: Record<string, string> = { dueAt: 'Entrega pautada', solicitadoEn: 'Fecha de solicitud', iniciadoEn: 'Inicio registrado', entregadoEn: 'Entrega registrada', cerradoEn: 'Cierre registrado', feedbackEn: 'Fecha del feedback', enviadaAutorEn: 'Envío al autor', feedbackAutorDueAt: 'Respuesta pautada del autor', aprobadaAutorEn: 'Aprobación del autor', aprobadaInternaEn: 'Aprobación interna', handoffEn: 'Entrega a Calidad', numeroFase: 'Fase', pdfUrl: 'PDF revisado', pdfVersion: 'Versión del PDF', briefEnlace: 'Brief creativo', fuenteUrl: 'Archivo de origen', revisadoEn: 'Revisión registrada', entregadoPor: 'Entregado por', revisadoPor: 'Revisado por', redesSociales: 'Redes sociales', name: 'Nombre', category: 'Categoría del autor', numero: 'Número', ingresoFechaIngreso: 'Fecha de ingreso', ingresoFechaCierre: 'Cierre proyectado', ingresoServicioEjecucion: 'Ejecución del servicio', ingresoServicioAlianza: 'Alianza comercial', ingresoServicioPresupuesto: 'Presupuesto de ingreso', ingresoServicioSubtipoCrudo: 'Especificación de Crudo', ingresoTiempoExpresMeses: 'Tiempo exprés (meses)', ingresoObservaciones: 'Observaciones comerciales', capitulosPactados: 'Capítulos pactados', paginasPactadas: 'Páginas pactadas', criterioExtra: 'Criterio extra', condicionesEspeciales: 'Condiciones especiales', coleccionPanhouse: 'Colección PanHouse', posibleTituloLibro: 'Título tentativo', fechaDeseadaCulminacion: 'Culminación deseada', publicoSexo: 'Público · Sexo', publicoEdad: 'Público · Edad', publicoPerfil: 'Público · Perfil', objetivoComercial: 'Objetivos comerciales del libro', propositoSocial: 'Propósito social', temaGeneral: 'Tema general', tonoEstilo: 'Tono y estilo', matrizPropietario: 'Responsable RRPP (referencia histórica)', asesoriaEspecialistaResponsable: 'Especialista (referencia histórica)', nivelSatisfaccion: 'Nivel de satisfacción (histórico)', soporteDigitalCuentaAmazon: 'Cuenta Amazon (contenido protegido)' };
export function etiquetaCampo(key: string) { return LABELS[key] ?? key.replace(/^(ingreso|matriz|asesoria|lanzamientoPromocion|soporteDigital|edicion|correccion|diseno|calidad|digital|lanzamiento|impresion|distribucion)/, '').replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2').replace(/^./, c => c.toUpperCase()).replace(/Url\b/g, 'Documento').replace(/Id\b/g, 'Responsable'); }
const campo = (key: string, value: unknown, source: string, label = etiquetaCampo(key), group?: string): CampoFicha => ({ key, label, value, source, group });
const nombresRoles: Record<string, string> = { especialista: 'Especialista editorial', jefe_area: 'Jefatura', editor: 'Editor', corrector: 'Corrector', disenador: 'Diseñador', lider_creativo: 'Líder creativo', validador: 'Calidad editorial', rrpp: 'RRPP', lanzamiento: 'RRPP', soporte_digital: 'Soporte digital' };
const EVENTOS: Record<string, string> = { EDITOR_SOLICITADO:'El Especialista solicit? Editor a Jefatura de Edici?n', CONTRATO_CORRECCION_SOLICITADO:'El Especialista solicit? contrato de Correcci?n', CONTRATO_REVISION_INICIADA:'Talento inici? la revisi?n del contrato', CONTRATO_INFORMACION_SOLICITADA:'Talento solicit? informaci?n del contrato', CONTRATO_INFORMACION_RESPONDIDA:'El Especialista respondi? la informaci?n contractual', CONTRATO_CONFIRMADO:'Talento confirm? el contrato de Correcci?n', CONTRATO_RECHAZADO:'Talento rechaz? la solicitud contractual', PROYECTO_TITULOS_REGISTRADOS: 'El Especialista registró los títulos del libro', AMAZON_ACTIVACION_HABILITADA: 'Se habilitó la activación de Amazon en paralelo a Calidad', AMAZON_ACTIVACION_REGISTRADA: 'Soporte Digital registró la activación de Amazon', DECISION_CREADA: 'Se solicito revision de Jefatura', DECISION_REVISION_INICIADA: 'Jefatura inicio la revision', DECISION_INFORMACION_SOLICITADA: 'Jefatura solicito informacion adicional', DECISION_INFORMACION_RESPONDIDA: 'El solicitante respondio a Jefatura', DECISION_RESUELTA: 'Jefatura resolvio una decision', ESPECIALISTA_ASIGNADO: 'Se asignó especialista editorial', ESPECIALISTA_REASIGNADO: 'Se reasignó especialista editorial', EDITOR_ASIGNADO: 'Se asignó editor', EDITOR_REASIGNADO: 'Se reasignó editor', DISENADOR_ASIGNADO: 'Se asignó diseñador', DISENADOR_REASIGNADO: 'Se reasignó diseñador', RRPP_NOTIFICADO: 'Comercial envió el proyecto a RRPP', JEFATURA_NOTIFICADA: 'RRPP entregó el diagnóstico a Jefatura', INFORMACION_COMERCIAL_ACTUALIZADA: 'Comercial actualizó los datos de la venta', INTAKE_RRPP_INICIADO: 'RRPP inició el diagnóstico', DIAGNOSTICO_ACTUALIZADO: 'RRPP actualizó el diagnóstico', DIAGNOSTICO_COMPLETADO: 'RRPP completó el diagnóstico', PLANIFICACION_RRPP_CREADA: 'Se habilitó la planificación de lanzamiento', PLANIFICACION_RRPP_ACTUALIZADA: 'RRPP actualizó la planificación', FECHA_LANZAMIENTO_MODIFICADA: 'Se actualizó la fecha de lanzamiento', REUNION_LANZAMIENTO_REGISTRADA: 'Se registró una reunión de lanzamiento', CONCEPTO_APROBADO_RRPP: 'RRPP aprobó un concepto de portada', CONCEPTO_DEVUELTO_RRPP: 'RRPP solicitó ajustes de portada', CORRECCION_SOLICITADA: 'Se solicitó una intervención de corrección', CORRECTOR_ASIGNADO: 'Se asignó corrector', CORRECTOR_REASIGNADO: 'Se reasignó corrector', CORRECCION_ENTREGADA: 'Se entregó una corrección', CORRECCION_CERRADA: 'Se cerró una intervención de corrección', BRIEF_CREATIVO_GENERADO: 'Se entregó el brief creativo', BRIEF_CREATIVO_APROBADO: 'El autor aprobó el brief', CONCEPTOS_ENTREGADOS: 'Se entregaron conceptos de portada', CONCEPTO_APROBADO_AUTOR: 'El autor aprobó un concepto', DIRECCION_CREATIVA_SOLICITADA: 'Se solicitó dirección creativa', DISENO_VERSION_ENTREGADA: 'Diseño entregó una nueva versión', CALIDAD_REVISADA: 'Calidad registró una revisión', CALIDAD_APROBADA_AUTOR: 'El autor aprobó la versión revisada', FICHA_DOCUMENTAL_ACTUALIZADA: 'Se actualizaron datos documentales del área' };
function areaEvento(action: string) { if (/RRPP|DIAGNOSTICO|REUNION_LANZAMIENTO|FERIA|PUBLICACION|RUTA_PROMOCION|LANZAMIENTO/.test(action))
    return 'RRPP'; if (/CREATIV|BRIEF|CONCEPTO/.test(action))
    return 'Creativa'; if (/DISENO|CUBIERTA/.test(action))
    return 'Diseño'; if (/CORREC/.test(action))
    return 'Corrección'; if (/CALIDAD/.test(action))
    return 'Calidad'; if (/COMERCIAL/.test(action))
    return 'Comercial'; return 'Proyecto'; }
export function etiquetaEventoFicha(action: string, details: unknown): string {
    const operacion: Record<string,string> = {
        PROJECT_WORKSPACE_INICIADO:'Se inició la configuración del espacio documental',
        PROJECT_WORKSPACE_CONFIGURADO:'Se configuró el espacio documental del proyecto',
        PROJECT_WORKSPACE_REINTENTO_EXITOSO:'Se completó el espacio documental tras reintentar',
        PROJECT_WORKSPACE_FALLIDO:'No se pudo completar el espacio documental; se conservaron los avances',
        PROJECT_WORKSPACE_INCONSISTENCIA:'Se detectó una inconsistencia que impide configurar el espacio documental',
        PROJECT_WORKSPACE_RECUPERACION_SOLICITADA:'Se solicitó recuperar el espacio documental',
        PROJECT_WORKSPACE_ATENCION_REQUERIDA:'El espacio documental requiere intervención',
        OBJETIVO_CREADO: 'Se definió un objetivo mensual para el proyecto',
        OBJETIVO_AJUSTADO: 'Se ajustó un compromiso mensual del proyecto',
        OBJETIVO_CUMPLIDO: 'PanHouse verificó un objetivo mensual cumplido',
        OBJETIVO_NO_CUMPLIDO: 'Terminó el periodo de un objetivo mensual',
        OBJETIVO_CANCELADO: 'Se canceló un objetivo mensual con motivo',
        OBJETIVO_CANCELADO_REASIGNACION: 'Se canceló un objetivo mensual por reasignación',
      PREPARACION_INICIAL_ACTUALIZADA: 'El Especialista actualizó la preparación inicial',
      SOLICITUD_AREA_CREADA: 'El Especialista solicitó '+((details as {tipo?:string})?.tipo === 'impresion' ? 'coordinación de Impresión' : 'Lanzamiento y promoción'),
      SOLICITUD_AREA_ACTIVADA: 'RRPP inició '+((details as {tipo?:string})?.tipo === 'impresion' ? 'la coordinación de Impresión' : 'la planificación de Lanzamiento'),
      SOLICITUD_AREA_ACTUALIZADA: (details as {accion?:string})?.accion === 'responder' ? 'El Especialista respondió la información solicitada por RRPP' : (details as {accion?:string})?.accion === 'informacion' ? 'RRPP solicitó información adicional' : (details as {accion?:string})?.accion === 'rechazar' ? 'RRPP rechazó la solicitud con motivo' : 'RRPP inició la revisión de la solicitud',
      IMPRESION_COORDINACION_ACTUALIZADA: 'Se actualizó la coordinación de Impresión',
    };
    if(operacion[action])return operacion[action];
    const d = details as { texto?: unknown; anterior?: string; nuevo?: string; resolutionType?: string } | null;
    if (action === 'PROYECTO_AVANCE_REGISTRADO' && typeof d?.texto === 'string') return d.texto;
    const estados: Record<string,string> = {en_proceso:'En proceso',retrasado:'Retrasado',stand_by:'Stand-by',pausado:'Pausado',culminado:'Culminado',retirado:'Retirado'};
    if (action === 'PROYECTO_ESTADO_CAMBIADO' && d?.anterior && d.nuevo && estados[d.anterior] && estados[d.nuevo]) return `El proyecto cambió: ${estados[d.anterior]} → ${estados[d.nuevo]}`;
    if(action === 'DECISION_RESUELTA') return d?.resolutionType === 'approved' ? 'Jefatura aprobó el caso' : d?.resolutionType === 'rejected' ? 'Jefatura rechazó el caso' : 'Jefatura canceló el caso';
    return EVENTOS[action] ?? EVENTOS_PROYECTO_RRPP[action]?.titulo ?? `Se registró un avance de ${areaEvento(action).toLowerCase()}`;
}
export async function historialFicha(id: string, cursor?: string, limit = 20): Promise<HistorialFicha> {
    let before;
    if (cursor) {
        try {
            const c = z.object({ date: z.string().datetime(), id: z.string().uuid() }).parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
            before = or(lt(auditLogs.createdAt, new Date(c.date)), and(eq(auditLogs.createdAt, new Date(c.date)), lt(auditLogs.id, c.id)));
        }
        catch {
            throw new ErrorFichaViva(400, 'Página de historial inválida');
        }
    }
    const rows = await db.select({ id: auditLogs.id, date: auditLogs.createdAt, action: auditLogs.accion, details: auditLogs.detalles, name: users.nombre }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorId)).where(and(eq(auditLogs.proyectoId, id), before)).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(limit + 1);
    const ids = rows.filter(r => ['ESPECIALISTA_ASIGNADO','ESPECIALISTA_REASIGNADO'].includes(r.action)).flatMap(r => {
        const d = r.details as { anterior?: string; nuevo?: string } | null;
        return [d?.anterior, d?.nuevo].filter((v): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v));
    });
    const responsables = ids.length ? await db.select({id: users.id, nombre: users.nombre}).from(users).where(inArray(users.id, ids)) : [];
    const assignmentLabel = (r: typeof rows[number]) => {
        if (!['ESPECIALISTA_ASIGNADO','ESPECIALISTA_REASIGNADO'].includes(r.action)) return undefined;
        const d = r.details as { anterior?: string; nuevo?: string } | null;
        const nuevo = responsables.find(u => u.id === d?.nuevo)?.nombre;
        const anterior = responsables.find(u => u.id === d?.anterior)?.nombre;
        if (!nuevo) return undefined;
        return anterior ? `Jefatura reasignó: ${anterior} → ${nuevo}` : `Jefatura asignó a ${nuevo}`;
    };
    const items: ActividadFicha[] = rows.slice(0, limit).map(r => {
        const outcome = (r.details as { resolutionType?: string } | null)?.resolutionType;
        const decisionLabel = r.action === 'DECISION_RESUELTA'
            ? outcome === 'approved' ? 'Jefatura aprobó el caso' : outcome === 'rejected' ? 'Jefatura rechazó el caso' : 'Jefatura canceló el caso'
            : undefined;
        const avance = r.action === 'PROYECTO_AVANCE_REGISTRADO' && typeof (r.details as { texto?: unknown } | null)?.texto === 'string' ? (r.details as { texto: string }).texto : undefined;
        const cambio = r.details as {anterior?:string;nuevo?:string} | null;
        const estados: Record<string,string> = {en_proceso:'En proceso',retrasado:'Retrasado',stand_by:'Stand-by',pausado:'Pausado',culminado:'Culminado',retirado:'Retirado'};
        const macro = r.action === 'PROYECTO_ESTADO_CAMBIADO' && cambio?.anterior && cambio.nuevo && estados[cambio.anterior] && estados[cambio.nuevo] ? `El proyecto cambió: ${estados[cambio.anterior]} → ${estados[cambio.nuevo]}` : undefined;
        return { id: r.id, date: r.date.toISOString(), label: avance ?? macro ?? decisionLabel ?? assignmentLabel(r) ?? (r.action.startsWith('PROJECT_WORKSPACE_') || r.action.startsWith('OBJETIVO_') || r.action.startsWith('SOLICITUD_AREA') || r.action.startsWith('PREPARACION_INICIAL') || r.action==='IMPRESION_COORDINACION_ACTUALIZADA' ? etiquetaEventoFicha(r.action,r.details) : undefined) ?? EVENTOS[r.action] ?? EVENTOS_PROYECTO_RRPP[r.action]?.titulo ?? `Se registró un avance de ${areaEvento(r.action).toLowerCase()}`, actor: r.name ?? 'Sistema', area: areaEvento(r.action) };
    });
    const last = items.at(-1);
    return { items, nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ date: last.date, id: last.id })).toString('base64url') : null };
}
type Base = Awaited<ReturnType<typeof baseFicha>>;
async function baseFicha(id: string) { const [row] = await db.select({ p: proyectos, f: fichasTrazabilidad, service: servicios.codigo, plan: servicios, serviceName: servicios.nombre, unit: unidades.nombre, budget: presupuestos.nombre }).from(proyectos).innerJoin(fichasTrazabilidad, eq(fichasTrazabilidad.proyectoId, proyectos.id)).innerJoin(servicios, eq(servicios.id, proyectos.servicioId)).innerJoin(unidades, eq(unidades.id, proyectos.unidadId)).innerJoin(presupuestos, eq(presupuestos.id, proyectos.presupuestoId)).where(eq(proyectos.id, id)).limit(1); if (!row)
    throw new ErrorFichaViva(404, 'Ficha no encontrada'); row.f.ingresoFechaCierre = proyectarIngreso(row.plan, row.f)?.fechaFinComprometida.toISOString().slice(0, 10) ?? null; return row; }
async function autoresFicha(p: Base['p']) { const columns = { id: autores.id, name: autores.nombre, category: autores.categoria, nombreArtistico: autores.nombreArtistico, pais: autores.pais, nacionalidad: autores.nacionalidad, email: autores.email, telefono: autores.telefono, redesSociales: autores.redesSociales, fechaNacimiento: autores.fechaNacimiento, personalidad: autores.personalidad, ocupacion: autores.ocupacion }; const rows = await db.select(columns).from(proyectosAutores).innerJoin(autores, eq(autores.id, proyectosAutores.autorId)).where(eq(proyectosAutores.proyectoId, p.id)).orderBy(asc(autores.nombre)); return rows.length ? rows : db.select(columns).from(autores).where(eq(autores.id, p.autorId)); }
async function equipoFicha(p: Base['p'], history = false): Promise<EquipoFicha[]> {
    const rows = await db.select({ id: projectAssignments.id, userId: users.id, name: users.nombre, tipo: projectAssignments.tipo, scope: projectAssignments.workItemId, at: projectAssignments.asignadoEn, end: projectAssignments.finalizadoEn }).from(projectAssignments).innerJoin(users, eq(users.id, projectAssignments.usuarioId)).where(and(eq(projectAssignments.proyectoId, p.id), history ? undefined : isNull(projectAssignments.finalizadoEn))).orderBy(desc(projectAssignments.asignadoEn)).limit(history ? 200 : 100);
    const result: EquipoFicha[] = rows.map(r => ({ id: r.id, name: r.name, role: nombresRoles[r.tipo] ?? 'Responsable de área', scope: r.scope ? 'Intervención' : 'Proyecto', assignedAt: r.at.toISOString(), endedAt: r.end?.toISOString() ?? null }));
    if (!history) {
        const fallback = [['especialista', p.especialistaId], ['editor', p.editorId], ['corrector', p.correctorId], ['disenador', p.disenadorId], ['jefe_area', p.jefeAreaId]].filter((x): x is [
            string,
            string
        ] => !!x[1] && !rows.some(r => r.tipo === x[0] && !r.scope));
        if (fallback.length) {
            const names = await db.select({ id: users.id, name: users.nombre }).from(users).where(inArray(users.id, fallback.map(x => x[1])));
            for (const [role, uid] of fallback) {
                const n = names.find(n => n.id === uid);
                if (n)
                    result.push({ id: `fk-${role}-${uid}`, name: n.name, role: nombresRoles[role] ?? role, scope: 'Asignación vigente del proyecto', assignedAt: null });
            }
        }
        const external = await db.select({ id: correcciones.id, name: correcciones.correctorNombre }).from(correcciones).innerJoin(workItems, eq(workItems.id, correcciones.workItemId)).where(and(eq(correcciones.proyectoId, p.id), inArray(workItems.estado, ['pendiente', 'en_progreso', 'bloqueado']))).limit(50);
        for (const x of external)
            if (x.name)
                result.push({ id: x.id, name: x.name, role: 'Corrector externo', scope: 'Intervención', assignedAt: null });
    }
    return result;
}
type CountState = {
    tipo: string;
    estado: string;
    total: number;
};
export function estadoTrabajo(rows: CountState[], fallback: EstadoArea = 'No iniciado'): EstadoArea { if (!rows.length)
    return fallback; if (rows.some(r => r.estado === 'bloqueado'))
    return 'Bloqueado'; if (rows.some(r => r.estado === 'en_progreso'))
    return 'En curso'; if (rows.some(r => r.estado === 'pendiente'))
    return 'Pendiente'; if (rows.some(r => r.estado === 'completado'))
    return 'Completo'; return fallback; }
function workspace(area: AreaFicha, p: Base['p'], actor: ActorFicha, launchEnabled: boolean, hasProcess = false): AreaResumen['workspace'] {
    if (actor.rol === 'jefe_area') {
        if (area === 'proyecto') return p.notificadoJefatura && !p.especialistaId && ['en_proceso', 'retrasado', 'stand_by', 'pausado'].includes(p.estado)
            ? { label: 'Asignar Especialista', href: `/?vista=asignaciones&proyecto=${p.id}` }
            : { label: 'Supervisar proyecto', href: `/proyectos/${p.id}` };
        if (area === 'correccion' && hasProcess) return { label: 'Ver seguimiento de Corrección', href: '/?vista=seguimiento' };
        return;
    } if (area === 'proyecto' && actor.rol === 'comercial')
    return { label: 'Gestionar datos de la venta', href: `/proyectos/${p.id}/ingreso-comercial` }; if (area === 'proyecto' && actor.rol === 'rrpp' && p.notificadoRrpp)
    return { label: 'Abrir ingreso RRPP', href: `/rrpp/ingresos?proyecto=${p.id}` }; if (area === 'lanzamiento' && actor.rol === 'rrpp' && launchEnabled)
    return { label: 'Abrir planificación', href: `/rrpp/lanzamientos?proyecto=${p.id}` }; const owners: Record<AreaFicha, Rol[]> = { proyecto: ['comercial', 'especialista', 'jefe_area'], edicion: ['especialista', 'editor', 'jefe_edicion'], correccion: ['especialista', 'corrector', 'jefe_area'], diseno: ['especialista', 'disenador'], calidad: ['especialista', 'soporte_editorial'], digital: ['soporte_digital'], lanzamiento: [], impresion: ['rrpp','impresion'], distribucion: ['distribucion'] }; if (!owners[area].includes(actor.rol))
    return; return { label: area === 'proyecto' ? 'Abrir gestión del proyecto' : `Gestionar ${AREAS_FICHA.find(a => a.id === area)?.name.toLowerCase()}`, href: ['editor', 'corrector', 'disenador', 'soporte_editorial'].includes(actor.rol) ? '/' : `/proyectos/${p.id}#${area}` }; }
export async function resumenFichaViva(id: string, actor: ActorFicha): Promise<ResumenFichaViva> {
    const fichaColumns = {
        ingresoFechaIngreso: fichasTrazabilidad.ingresoFechaIngreso,
        ingresoFechaCierre: fichasTrazabilidad.ingresoFechaCierre,
        ingresoServicioEjecucion: fichasTrazabilidad.ingresoServicioEjecucion,
        ingresoServicioAlianza: fichasTrazabilidad.ingresoServicioAlianza,
        ingresoServicioPresupuesto: fichasTrazabilidad.ingresoServicioPresupuesto,
        ingresoTiempoExpresMeses: fichasTrazabilidad.ingresoTiempoExpresMeses,
        ingresoServicioSubtipoCrudo: fichasTrazabilidad.ingresoServicioSubtipoCrudo,
        capitulosPactados: fichasTrazabilidad.capitulosPactados,
        paginasPactadas: fichasTrazabilidad.paginasPactadas,
        coleccionPanhouse: fichasTrazabilidad.coleccionPanhouse,
        posibleTituloLibro: fichasTrazabilidad.posibleTituloLibro,
        matrizDiagnosticoGenerado: fichasTrazabilidad.matrizDiagnosticoGenerado,
        matrizIngresoGenerado: fichasTrazabilidad.matrizIngresoGenerado,
        asesoriaCotizacionImpresion: fichasTrazabilidad.asesoriaCotizacionImpresion,
        impresionDeseaCotizacion: fichasTrazabilidad.impresionDeseaCotizacion,
        impresionEstadoCotizacion: fichasTrazabilidad.impresionEstadoCotizacion,
        asesoriaVentaCruzada: fichasTrazabilidad.asesoriaVentaCruzada,
        asesoriaDistribucionAceptada: fichasTrazabilidad.asesoriaDistribucionAceptada,
        asesoriaFase: fichasTrazabilidad.asesoriaFase,
        lanzamientoPromocionFechaTentativa: fichasTrazabilidad.lanzamientoPromocionFechaTentativa,
        edicionEstatus: fichasTrazabilidad.edicionEstatus,
        correccionEstatus: fichasTrazabilidad.correccionEstatus,
        disenoEstatus: fichasTrazabilidad.disenoEstatus,
        calidadEstatus: fichasTrazabilidad.calidadEstatus,
        digitalEstatus: fichasTrazabilidad.digitalEstatus,
        lanzamientoEstatus: fichasTrazabilidad.lanzamientoEstatus,
        impresionEstatus: fichasTrazabilidad.impresionEstatus,
        distribucionEstatus: fichasTrazabilidad.distribucionEstatus,
        updatedAt: fichasTrazabilidad.updatedAt,
    };
    const [base] = await db.select({p:proyectos,f:fichaColumns,service:servicios.codigo,plan:servicios,serviceName:servicios.nombre,unit:unidades.nombre,budget:presupuestos.nombre})
        .from(proyectos).innerJoin(fichasTrazabilidad,eq(fichasTrazabilidad.proyectoId,proyectos.id))
        .innerJoin(servicios,eq(servicios.id,proyectos.servicioId)).innerJoin(unidades,eq(unidades.id,proyectos.unidadId))
        .innerJoin(presupuestos,eq(presupuestos.id,proyectos.presupuestoId)).where(eq(proyectos.id,id)).limit(1);
    if (!base) throw new ErrorFichaViva(404,'Ficha no encontrada');
    const { p, f, service } = base;
    f.ingresoFechaCierre = proyectarIngreso(base.plan, f)?.fechaFinComprometida.toISOString().slice(0, 10) ?? null;
    p.especialistaId = await obtenerEspecialistaActual(id, p.especialistaId);
    const authorColumns = {id:autores.id,name:autores.nombre,category:autores.categoria};
    let authors = await db.select(authorColumns).from(proyectosAutores).innerJoin(autores,eq(autores.id,proyectosAutores.autorId)).where(eq(proyectosAutores.proyectoId,id)).orderBy(asc(autores.nombre));
    if (!authors.length) authors = await db.select(authorColumns).from(autores).where(eq(autores.id,p.autorId));
    const errors: string[] = [];
    const results = await Promise.allSettled([
        db.select({ tipo: workItems.tipo, estado: workItems.estado, total: count() }).from(workItems).where(eq(workItems.proyectoId, id)).groupBy(workItems.tipo, workItems.estado),
        equipoFicha(p), historialFicha(id, undefined, 5),
        db.select({ state: workItems.estado }).from(workItems).where(and(eq(workItems.proyectoId, id), eq(workItems.tipo, 'lanzamiento'), eq(workItems.businessKey, 'planificacion'))).limit(1),
        db.select({ total: count(), delivered: sql<number>`count(*) filter (where ${capitulos.fechaEntregaEditor} is not null)`.mapWith(Number) }).from(capitulos).where(eq(capitulos.proyectoId, id)),
        db.select({ total: count() }).from(fichaDisenoPropuestas).innerJoin(direccionesCreativas, eq(direccionesCreativas.id, fichaDisenoPropuestas.direccionCreativaId)).innerJoin(workItems, eq(workItems.id, direccionesCreativas.workItemId)).where(and(eq(direccionesCreativas.proyectoId, id), isNull(direccionesCreativas.fechaCierre), isNull(fichaDisenoPropuestas.fechaAprobadaRrpp), or(isNull(fichaDisenoPropuestas.estado), ne(fichaDisenoPropuestas.estado, 'Devuelta por RRPP')), inArray(workItems.estado, ['pendiente', 'en_progreso', 'bloqueado']))),
    ]);
    function read<T>(index: number, name: string, fallback: T): T { const result = results[index]; if (result?.status === 'fulfilled')
        return result.value as T; errors.push(name); return fallback; }
    const states = read<CountState[]>(0, 'Estados operativos', []);
    const team = read<EquipoFicha[]>(1, 'Equipo', []);
    const activity = read<HistorialFicha>(2, 'Actividad', { items: [], nextCursor: null });
    const launch = read<{
        state: string;
    }[]>(3, 'Lanzamiento', [])[0];
    const chapters = read<{ total: number; delivered: number }[]>(4, 'Edición', []);
    const pendingConcepts = read<{
        total: number;
    }[]>(5, 'Conceptos', [])[0]?.total ?? 0;
    const commercial = evaluarPreparacionComercial({ ...p, ...f, autores: authors });
    const rrpp = evaluarPreparacionRrpp(f, service);
    const commercialState = commercial.listoParaRrpp ? 'Completo' : 'Pendiente';
    const rrppState = p.notificadoJefatura ? rrpp.listoParaJefatura ? 'Completo' : 'LEGACY / DATO INCOMPLETO' : !p.notificadoRrpp ? 'Aún no habilitado' : rrpp.listoParaJefatura ? 'Listo para Jefatura' : 'En diagnóstico';
    const countOf = (statuses: string[]) => errors.includes('Estados operativos') ? null : states.filter(r => statuses.includes(r.estado)).reduce((n, r) => n + r.total, 0);
    const title = p.tituloDefinitivo ?? f.posibleTituloLibro ?? p.titulo ?? 'Título por definir';
    const printingInterest = f.asesoriaCotizacionImpresion || f.impresionDeseaCotizacion === true;
    const distributionInterest = f.asesoriaVentaCruzada?.includes('Distribución') || f.asesoriaDistribucionAceptada;
    const traceability: AreaResumen[] = AREAS_FICHA.map(area => {
        const own = states.filter(r => area.types.includes(r.tipo));
        let state = estadoTrabajo(own);
        let detail = own.length ? `${own.reduce((n, r) => n + r.total, 0)} intervenciones registradas` : 'Sin procesos operativos registrados';
        const macro = (f as unknown as Record<string, unknown>)[`${area.prefix}Estatus`];
        if (!own.length && typeof macro === 'string' && macro.trim()) {
            const normalized = macro.trim().toLowerCase();
            state = /^(completo|completado|culminado|finalizado)$/.test(normalized) ? 'Completo' : /^(en curso|en proceso|en progreso)$/.test(normalized) ? 'En curso' : normalized === 'bloqueado' ? 'Bloqueado' : normalized === 'no aplica' ? 'No aplica' : normalized === 'no iniciado' ? 'No iniciado' : 'Pendiente';
            detail = `Registro de área: ${macro}`;
        }
        if (area.id === 'proyecto') {
            state = p.notificadoJefatura && rrpp.listoParaJefatura ? 'Completo' : p.notificadoRrpp ? 'En curso' : 'Pendiente';
            detail = `Comercial: ${commercialState.toLowerCase()} · RRPP: ${rrppState.toLowerCase()}`;
        }
        if (area.id === 'edicion') {
            if (service === 'SE' && !own.length) {
                state = 'No aplica';
                detail = 'Servicio Sello editorial';
            }
            else if ((chapters[0]?.total ?? 0) > 0) {
                const {total,delivered} = chapters[0]!;
                detail = `${delivered} de ${total} capítulos entregados por Edición`;
                if (!own.length)
                    state = delivered === total ? 'Completo' : 'En curso';
            }
        }
        if (area.id === 'lanzamiento') {
            state = launch ? estadoTrabajo([{ tipo: 'lanzamiento', estado: launch.state, total: 1 }]) : 'Aún no habilitado';
            detail = launch ? `Planificación ${f.asesoriaFase?.toLowerCase() ?? 'pendiente'}` : 'El hito editorial aún no ha creado la planificación';
        }
        if (area.id === 'impresion' && !printingInterest && !own.length && !macro) {
            state = f.impresionDeseaCotizacion === false ? 'No aplica' : 'No iniciado';
            detail = 'Sin solicitud de impresión registrada';
        }
        else if (area.id === 'impresion' && !own.length && !macro) {
            state = 'Pendiente';
            detail = f.impresionEstadoCotizacion ?? 'Interés derivado a Impresión';
        }
        if (area.id === 'distribucion' && !distributionInterest && !own.length && !macro) {
            state = 'No iniciado';
            detail = 'Sin interés de distribución registrado';
        }
        else if (area.id === 'distribucion' && !own.length && !macro) {
            state = 'Pendiente';
            detail = 'Interés derivado a Distribución';
        }
        if (errors.includes('Estados operativos') && area.id !== 'proyecto' && area.id !== 'lanzamiento') {
            state = 'Pendiente';
            detail = 'No se pudieron consultar los procesos del área';
        }
        if (area.id === 'lanzamiento' && errors.includes('Lanzamiento')) {
            state = 'Pendiente';
            detail = 'No se pudo consultar la habilitación de lanzamiento';
        }
        return { id: area.id, name: area.name, state, detail, workspace: state === 'No aplica' ? undefined : workspace(area.id, p, actor, !!launch, own.length > 0 && !errors.includes('Estados operativos')) };
    });
    const myActions: AccionFicha[] = [];
    if (actor.rol === 'rrpp') {
        if (p.notificadoRrpp)
            myActions.push({ label: p.notificadoJefatura ? 'Consultar diagnóstico' : 'Gestionar ingreso RRPP', description: p.notificadoRrpp ? 'Diagnóstico, colección y documentos del libro.' : 'Consultar contexto; Comercial aún no ha enviado el proyecto.', href: `/rrpp/ingresos?proyecto=${id}`, primary: true });
        if (launch)
            myActions.push({ label: 'Gestionar lanzamiento', description: 'Reuniones, fechas, eventos y publicaciones del plan habilitado.', href: `/rrpp/lanzamientos?proyecto=${id}` });
        if (pendingConcepts > 0 && ['en_proceso', 'retrasado'].includes(p.estado))
            myActions.push({ label: 'Revisar conceptos de portada', description: 'Consultar conceptos y su aprobación interna RRPP.', href: '/' });
    }
    else if (actor.rol === 'jefe_area') {
        const activo = ['en_proceso', 'retrasado', 'stand_by', 'pausado'].includes(p.estado);
        if (!errors.includes('Equipo') && p.notificadoJefatura && !p.especialistaId && activo) {
            myActions.push({ label: 'Asignar Especialista', description: 'El proyecto completó Comercial y RRPP y está esperando distribución dentro del equipo editorial.', href: `/?vista=asignaciones&proyecto=${id}`, primary: true });
        } else {
            myActions.push({ label: 'Supervisar proyecto', description: p.especialistaId ? 'Consulta al responsable actual y la situación del proyecto.' : 'Consulta el estado y las entregas pendientes del proyecto.', href: `/proyectos/${id}`, primary: true });
        }
        if (p.notificadoRrpp) myActions.push({ label: 'Ver diagnóstico', description: 'Revisar ingreso RRPP en la ficha, sin editarlo.', href: `/proyectos/${id}/ficha-trazabilidad?modo=completa#proyecto` });
        if (!errors.includes('Estados operativos') && states.some(s => s.tipo === 'correccion' && ['pendiente', 'en_progreso', 'bloqueado'].includes(s.estado))) myActions.push({ label: 'Ver seguimiento de Corrección', description: 'Supervisa la intervención vigente sin actuar como Corrector.', href: '/?vista=seguimiento' });
        if (activo && p.especialistaId) myActions.push({ label: 'Revisar solicitudes', description: 'Solicitudes operativas del equipo editorial.', href: '/?vista=solicitudes' });
    }
    else {
        for (const area of traceability.filter(a => a.workspace)) {
            myActions.push({ label: area.workspace!.label, description: area.detail, href: area.workspace!.href, primary: myActions.length === 0 });
        }
        if (actor.rol === 'lider_creativo')
            myActions.push({ label: 'Abrir Dirección creativa', description: 'Brief, conceptos, recursos y verificaciones de cubierta.', href: '/', primary: true });
    }
    const overview = [campo('budget', base.budget, 'proyectos.presupuestoId', 'Presupuesto inicial'), campo('ingresoServicioPresupuesto', f.ingresoServicioPresupuesto, 'fichas_trazabilidad', 'Presupuesto del servicio'), campo('ingresoFechaIngreso', f.ingresoFechaIngreso, 'fichas_trazabilidad'), campo('ingresoFechaCierre', f.ingresoFechaCierre, 'fichas_trazabilidad'), campo('ingresoServicioEjecucion', f.ingresoServicioEjecucion, 'fichas_trazabilidad'), campo('ingresoServicioAlianza', f.ingresoServicioAlianza, 'fichas_trazabilidad'), ...(f.ingresoServicioEjecucion === 'Express' ? [campo('ingresoTiempoExpresMeses', f.ingresoTiempoExpresMeses, 'fichas_trazabilidad')] : []), campo('capitulosPactados', f.capitulosPactados, 'fichas_trazabilidad'), campo('paginasPactadas', f.paginasPactadas, 'fichas_trazabilidad'), campo('coleccionPanhouse', f.coleccionPanhouse, 'fichas_trazabilidad')].filter(c => c.value !== null && c.value !== undefined && c.value !== '');
    const creativeState = estadoTrabajo(states.filter(s => s.tipo === 'direccion_creativa'));
    return { project: { id, code: p.codigo, title, service: `${service} ${service === 'CR' ? '—' : '·'} ${nombreServicioProyecto(base.service, base.serviceName, base.f.ingresoServicioSubtipoCrudo)}`, unit: base.unit, macroState: p.estado, updatedAt: new Date(Math.max(p.updatedAt.getTime(), f.updatedAt.getTime(), activity.items[0] ? Date.parse(activity.items[0].date) : 0)).toISOString() }, authors: authors.map(a => ({ id: a.id, name: a.name, category: a.category })), overview, summary: { active: countOf(['en_progreso']), completed: countOf(['completado']), pending: countOf(['pendiente']), blocked: countOf(['bloqueado']), commercial: commercialState, commercialMissing: commercial.faltantesComercial.map(etiquetaCampo), rrpp: rrppState, rrppMissing: rrpp.faltantes.map(x => x.etiqueta), launchEnabled: !!launch, launchPhase: launch ? f.asesoriaFase : null, launch: traceability[6]!.state, launchDate: launch ? f.lanzamientoPromocionFechaTentativa : null }, team, traceability, myActions, recentActivity: activity.items, secondaryErrors: errors, relatedProcesses: [{ name: 'Dirección creativa', state: creativeState, detail: 'Brief, conceptos y aprobación interna RRPP.', href: creativeState !== 'No iniciado' && (actor.rol === 'lider_creativo' || actor.rol === 'rrpp') ? '/' : undefined }, { name: 'Jefatura', state: p.especialistaId ? 'Especialista asignado' : p.notificadoJefatura ? 'Pendiente de asignación' : 'Aún no recibido', detail: 'Asignaciones y coordinación editorial.', href: actor.rol === 'jefe_area' ? `/?vista=asignaciones&proyecto=${id}` : undefined }] };
}
export const datosDocumentalesSchema = z.object({ datos: z.record(z.union([z.string().max(5000), z.number().finite(), z.boolean(), z.null()])) }).strict();

// Assignment to one correction intervention does not authorize other scopes.
async function alcancesCorrector(id: string, actor: ActorFicha, client: typeof db | Tx = db) {
    if (actor.rol !== 'corrector') return null;
    const rows = await client.select({ alcance: correcciones.alcance }).from(correcciones)
        .innerJoin(workItems, eq(workItems.id, correcciones.workItemId))
        .where(and(eq(correcciones.proyectoId, id), eq(correcciones.correctorId, actor.id), inArray(workItems.estado, ['pendiente', 'en_progreso', 'bloqueado'])));
    const prefixes: Record<string, string> = { tripa_completa: 'tripa_', preliminares: 'preliminares_', cubierta_extendida: 'cubierta_' };
    return rows.map(r => prefixes[r.alcance]).filter((p): p is string => !!p);
}
// Only the documentary endpoint loads repeated records. The summary never
// fetches chapter bodies, checklists, versions or the complete audit trail.
export async function expedienteFichaViva(id: string, actor: ActorFicha): Promise<ExpedienteFicha> {
    const base = await baseFicha(id);
    const { p, f } = base;
    const correctionScopes = await alcancesCorrector(id, actor);
    const errors: string[] = [];
    const areas: AreaResumen[] = AREAS_FICHA.map(a => ({
        id: a.id, name: a.name, state: 'No iniciado', detail: 'Expediente documental',
        workspace: workspace(a.id, p, actor, false), fields: [],
    }));
    const byArea = (area: AreaFicha) => areas.find(a => a.id === area)!;
    const add = (area: AreaFicha, key: string, value: unknown, source: string, label?: string, group?: string, legacy = false) => {
        byArea(area).fields!.push({ ...campo(key, value, source, label, group), legacy });
    };
    const canonical = fechasLanzamientoCanonicas(f);
    const printAliases = ['asesoriaResponsableImpresion', 'asesoriaFechaCotizacionSolicitada', 'asesoriaFechaCotizacionEnviada', 'asesoriaCotizacionAceptada'];
    const distributionAliases = ['asesoriaDistribucionAceptada', 'asesoriaResponsableDistribucion', 'asesoriaNotaDistribucion', 'asesoriaFechaContratoEnviado', 'asesoriaContratoRecibidoFirmado'];
    for (const [key, value] of Object.entries(canonical)) {
        if (['id', 'proyectoId', 'createdAt', 'updatedAt', 'soporteDigitalCuentaAmazon', 'asesoriaFechaPrimeraReunion', 'asesoriaFechaSegundaReunion'].includes(key))
            continue;
        if (key === 'ingresoTiempoExpresMeses' && f.ingresoServicioEjecucion !== 'Express')
            continue;
        if (key === 'ingresoServicioSubtipoCrudo' && base.service !== 'CR' && value == null)
            continue;
        let area: AreaFicha = 'proyecto';
        if (printAliases.includes(key))
            area = 'impresion';
        else if (distributionAliases.includes(key))
            area = 'distribucion';
        else if (/^asesoria|^lanzamiento|^nivelSatisfaccion/.test(key))
            area = 'lanzamiento';
        else if (/^soporteDigital|^digital/.test(key))
            area = 'digital';
        else {
            const descriptor = AREAS_FICHA.find(a => a.id !== 'proyecto' && key.startsWith(a.prefix));
            if (descriptor)
                area = descriptor.id;
        }
        // UUIDs are resolved below; no internal foreign keys are shown as names.
        if (key.endsWith('ResponsableId'))
            continue;
        const legacy = ['matrizPropietario', 'asesoriaEspecialistaResponsable', 'nivelSatisfaccion', 'disenoBriefCreativo'].includes(key);
        const group = legacy ? 'Referencias históricas' : key.startsWith('matriz') ? 'Diagnóstico RRPP' : area === 'proyecto' && /^(ingreso|capitulosPactados|paginasPactadas|criterioExtra|condicionesEspeciales)/.test(key) ? 'Contrato y venta' : area === 'proyecto' ? 'Ficha editorial' : 'Registro del área';
        add(area, key, value, 'fichas_trazabilidad', undefined, group, legacy);
    }
    // Preserve divergent old dates without turning them into a second source.
    for (const key of ['asesoriaFechaPrimeraReunion', 'asesoriaFechaSegundaReunion'] as const) {
        if (f[key] && f[key] !== canonical[key])
            add('lanzamiento', key + 'Historica', f[key], 'fichas_trazabilidad', etiquetaCampo(key) + ' · histórico', 'Referencias históricas', true);
    }
    add('digital', 'cuentaAmazonRegistrada', !!f.soporteDigitalCuentaAmazon, 'fichas_trazabilidad', 'Cuenta Amazon registrada', 'Cuenta y publicación');
    const projectFields = ['codigo', 'tituloDefinitivo', 'subtituloDefinitivo', 'manuscritoUrl', 'estado', 'categoriaStandBy', 'fechaProgramadaInicio', 'fechaRealInicio', 'fechaDeseadaAutor', 'fechaFinProyectada', 'fechaProcesoIngreso', 'fechaExtraccionContenido', 'fechaCreacionContenido', 'fechaFeedbackTripa', 'fechaAsignacionCorreccion', 'fechaAsignacionDiseno', 'fechaTripaDiagramada', 'fechaAprobacionFinal', 'contratoFirmado', 'propuestaPortadaUrl', 'portadaDecisionAutor', 'portadaFeedback'] as const;
    for (const key of projectFields)
        add('proyecto', 'proyecto.' + key, p[key], 'proyectos', etiquetaCampo(key), 'Datos generales y hitos');
    if (p.titulo)
        add('proyecto', 'tituloHistorico', p.titulo, 'proyectos', 'Título histórico', 'Referencias históricas', true);
    for (const [key, value] of [['Servicio', nombreServicioProyecto(base.service, base.serviceName, base.f.ingresoServicioSubtipoCrudo)], ['Unidad editorial', base.unit], ['Presupuesto inicial', base.budget]])
        add('proyecto', String(key), value, 'catálogos', String(key), 'Contrato y venta');
    const jobs = [
        { name: 'Campos documentales', run: () => db.select().from(fichaDocumentalDatos).where(eq(fichaDocumentalDatos.proyectoId, id)) },
        { name: 'Autores', run: () => autoresFicha(p) },
        { name: 'Capítulos', run: () => db.select().from(capitulos).where(eq(capitulos.proyectoId, id)).orderBy(asc(capitulos.numero)).limit(501) },
        { name: 'Corrección', run: () => db.select({ record: correcciones, name: users.nombre, state: workItems.estado }).from(correcciones).innerJoin(workItems, eq(workItems.id, correcciones.workItemId)).leftJoin(users, eq(users.id, correcciones.correctorId)).where(eq(correcciones.proyectoId, id)).orderBy(asc(correcciones.createdAt)).limit(501) },
        { name: 'Creativa', run: () => db.select().from(direccionesCreativas).where(eq(direccionesCreativas.proyectoId, id)).orderBy(asc(direccionesCreativas.createdAt)).limit(501) },
        { name: 'Conceptos', run: () => db.select().from(fichaDisenoPropuestas).where(eq(fichaDisenoPropuestas.fichaId, f.id)).orderBy(asc(fichaDisenoPropuestas.createdAt)).limit(501) },
        { name: 'Diseño', run: () => db.select().from(disenos).where(eq(disenos.proyectoId, id)).orderBy(asc(disenos.solicitadoEn)).limit(501) },
        { name: 'Versiones', run: () => db.select({ record: disenoVersiones, tipo: disenos.tipo, name: users.nombre }).from(disenoVersiones).innerJoin(disenos, eq(disenos.id, disenoVersiones.disenoId)).leftJoin(users, eq(users.id, disenoVersiones.entregadoPorId)).where(eq(disenos.proyectoId, id)).orderBy(asc(disenoVersiones.entregadoEn)).limit(501) },
        { name: 'Calidad', run: () => db.select({ record: fichaCalidadFases, name: users.nombre }).from(fichaCalidadFases).leftJoin(users, eq(users.id, fichaCalidadFases.revisadoPorId)).where(eq(fichaCalidadFases.fichaId, f.id)).orderBy(asc(fichaCalidadFases.numeroFase), asc(fichaCalidadFases.ronda)).limit(501) },
        { name: 'Reuniones', run: () => db.select({ record: fichaLanzamientoReuniones, name: users.nombre }).from(fichaLanzamientoReuniones).leftJoin(users, eq(users.id, fichaLanzamientoReuniones.responsableId)).where(eq(fichaLanzamientoReuniones.fichaId, f.id)).orderBy(asc(fichaLanzamientoReuniones.createdAt)).limit(501) },
        { name: 'Países de distribución', run: () => db.select().from(fichaDistribucionPaises).where(eq(fichaDistribucionPaises.fichaId, f.id)).orderBy(asc(fichaDistribucionPaises.pais)).limit(501) },
        { name: 'Eventos', run: () => db.select({ record: rrppEventos, name: users.nombre }).from(rrppEventos).leftJoin(users, eq(users.id, rrppEventos.responsableId)).where(eq(rrppEventos.proyectoId, id)).orderBy(asc(rrppEventos.fecha)).limit(501) },
        { name: 'Publicaciones', run: () => db.select({ record: rrppPublicaciones, name: users.nombre }).from(rrppPublicaciones).leftJoin(users, eq(users.id, rrppPublicaciones.responsableId)).where(eq(rrppPublicaciones.proyectoId, id)).orderBy(asc(rrppPublicaciones.createdAt)).limit(501) },
        { name: 'Historial de asignaciones', run: () => equipoFicha(p, true) },
        { name: 'Responsables de reuniones', run: () => db.select({ id: users.id, name: users.nombre }).from(users).where(inArray(users.id, [f.lanzamientoPromocionPrimeraResponsableId, f.lanzamientoPromocionSegundaResponsableId].filter((v): v is string => !!v))) },
        { name: 'Lanzamiento', run: () => db.select({ id: workItems.id }).from(workItems).where(and(eq(workItems.proyectoId, id), eq(workItems.tipo, 'lanzamiento'), eq(workItems.businessKey, 'planificacion'))).limit(1) },
    ];
    const results = await Promise.allSettled(jobs.map(j => j.run()));
    function read<T>(index: number, fallback: T): T { const result = results[index]; if (result?.status === 'fulfilled') {
        const value = result.value;
        if (Array.isArray(value) && value.length > 500) {
            errors.push(jobs[index]!.name + ': se muestran las primeras 500 filas; consulta la bandeja del área');
            return value.slice(0, 500) as T;
        }
        return value as T;
    } errors.push(jobs[index]!.name); return fallback; }
    const supplemental = read<typeof fichaDocumentalDatos.$inferSelect[]>(0, []);
    const [printingRequest] = actor.rol==='rrpp' ? await db.select({estado:solicitudesArea.estado}).from(solicitudesArea).where(and(eq(solicitudesArea.proyectoId,id),eq(solicitudesArea.tipo,'impresion'))).limit(1) : [];
    const printingEditable = actor.rol!=='rrpp' || printingRequest?.estado==='resuelta' || !printingRequest && !!(f.impresionFechaInicio || f.impresionEstatus);
    const [preparacion] = await db.select().from(preparacionesProyecto).where(eq(preparacionesProyecto.proyectoId,id));
    if(preparacion) for(const [key,value] of Object.entries(preparacion)) {
      if(['proyectoId','updatedAt'].includes(key))continue;
      add('proyecto','preparacion.'+key,value instanceof Date?value.toISOString():value,'preparaciones_proyecto',etiquetaCampo(key),'Preparación inicial · Especialista');
    }
    for (const def of CAMPOS_DOCUMENTALES) {
        const value = supplemental.find(r => r.seccion === def.area)?.datos[def.key] ?? null;
        const group = def.area === 'correccion' ? def.label.split(' · ')[0] : 'Campos de la ficha original';
        byArea(def.area as AreaFicha).fields!.push({ key: def.key, label: def.label, value, source: 'ficha_documental_datos', type: def.type, editable: def.roles.includes(actor.rol) && (def.area!=='impresion'||printingEditable) && (correctionScopes === null || correctionScopes.some(prefix => def.key.startsWith(prefix))), group });
    }
    const contactsAllowed = ['comercial', 'rrpp', 'especialista', 'jefe_area', 'direccion'].includes(actor.rol);
    for (const a of read<Awaited<ReturnType<typeof autoresFicha>>>(1, [])) {
        for (const [key, value] of Object.entries(a)) {
            if (key === 'id' || (!contactsAllowed && ['email', 'telefono', 'fechaNacimiento', 'personalidad'].includes(key)))
                continue;
            add('proyecto', a.id + '.' + key, value, 'autores', key === 'category' ? 'Categoría del autor' : key === 'name' ? 'Nombre completo' : etiquetaCampo(key), 'Autor · ' + a.name);
        }
    }
    function record(area: AreaFicha, row: Record<string, unknown>, source: string, group: string) {
        for (const [key, value] of Object.entries(row)) {
            if (key === 'id' || key.endsWith('Id') || ['createdAt', 'updatedAt', 'clientKey', 'solicitudKey', 'entregaKey', 'checklist'].includes(key))
                continue;
            // Structured chapter links are flattened into individually labelled documents.
            if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
                for (const [sub, v] of Object.entries(value))
                    if (typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number')
                        add(area, group + '.' + key + '.' + sub, v, source, etiquetaCampo(key) + ' · ' + etiquetaCampo(sub), group);
            }
            else
                add(area, String(row.id ?? group) + '.' + key, value instanceof Date ? value.toISOString() : value, source, etiquetaCampo(key), group);
        }
    }
    for (const r of read<typeof capitulos.$inferSelect[]>(2, []))
        record('edicion', r, 'capitulos', 'Capítulo ' + r.numero);
    for (const r of read<{
        record: typeof correcciones.$inferSelect;
        name: string | null;
        state: string;
    }[]>(3, [])) {
        const group = 'Corrección · ' + r.record.alcance.replaceAll('_', ' ') + ' · ' + (r.record.fechaAsignada ?? 'Sin asignar');
        record('correccion', { ...r.record, responsable: r.name ?? r.record.correctorNombre, estado: r.state }, 'correcciones / work_items', group);
    }
    for (const [i, r] of read<typeof direccionesCreativas.$inferSelect[]>(4, []).entries())
        record('diseno', r, 'direcciones_creativas', 'Dirección creativa · ' + (i + 1));
    for (const [i, r] of read<typeof fichaDisenoPropuestas.$inferSelect[]>(5, []).entries())
        record('diseno', r, 'ficha_diseno_propuestas', 'Concepto de portada · ' + (i + 1));
    for (const [i, r] of read<typeof disenos.$inferSelect[]>(6, []).entries())
        record('diseno', r, 'disenos', 'Diseño · ' + r.tipo.replaceAll('_', ' ') + ' · ' + (i + 1));
    for (const [i, r] of read<{
        record: typeof disenoVersiones.$inferSelect;
        tipo: string;
        name: string | null;
    }[]>(7, []).entries())
        record('diseno', { ...r.record, entregadoPor: r.name }, 'diseno_versiones', 'Versión ' + r.record.numero + ' · ' + r.tipo.replaceAll('_', ' ') + ' · entrega ' + (i + 1));
    for (const r of read<{
        record: typeof fichaCalidadFases.$inferSelect;
        name: string | null;
    }[]>(8, [])) {
        const group = 'Calidad · Fase ' + r.record.numeroFase + ' · Ronda ' + r.record.ronda;
        record('calidad', { ...r.record, revisadoPor: r.name }, 'ficha_calidad_fases', group);
        for (const key of criteriosDeFase(r.record.numeroFase)) {
            const result = r.record.checklist?.[key];
            add('calidad', group + '.' + key, result?.cumple ?? null, 'ficha_calidad_fases.checklist', etiquetaCampo(key.replaceAll('_', ' ')), group + ' · Criterios');
            if (result?.observaciones)
                add('calidad', group + '.' + key + '.observaciones', result.observaciones, 'ficha_calidad_fases.checklist', 'Observaciones · ' + etiquetaCampo(key.replaceAll('_', ' ')), group + ' · Criterios');
        }
    }
    for (const [i, r] of read<{
        record: typeof fichaLanzamientoReuniones.$inferSelect;
        name: string | null;
    }[]>(9, []).entries())
        record('lanzamiento', { ...r.record, responsable: r.name }, 'ficha_lanzamiento_reuniones', 'Reunión · ' + (i + 1));
    for (const r of read<typeof fichaDistribucionPaises.$inferSelect[]>(10, []))
        record('distribucion', r, 'ficha_distribucion_paises', 'Distribución · ' + r.pais);
    for (const [i, r] of read<{
        record: typeof rrppEventos.$inferSelect;
        name: string | null;
    }[]>(11, []).entries())
        record('lanzamiento', { ...r.record, responsable: r.name }, 'rrpp_eventos', 'Evento · ' + (i + 1));
    for (const [i, r] of read<{
        record: typeof rrppPublicaciones.$inferSelect;
        name: string | null;
    }[]>(12, []).entries())
        record('lanzamiento', { ...r.record, responsable: r.name }, 'rrpp_publicaciones', 'Publicación · ' + (i + 1));
    const names = read<{
        id: string;
        name: string;
    }[]>(14, []);
    for (const key of ['lanzamientoPromocionPrimeraResponsableId', 'lanzamientoPromocionSegundaResponsableId'] as const)
        add('lanzamiento', key, names.find(n => n.id === f[key])?.name ?? null, 'usuarios', etiquetaCampo(key), 'Registro del área');
    const launchEnabled = read<{
        id: string;
    }[]>(15, []).length > 0;
    byArea('lanzamiento').workspace = workspace('lanzamiento', p, actor, launchEnabled);
    return { areas, teamHistory: read<EquipoFicha[]>(13, []), references: ['Perfil contractual Estándar/VIP: pendiente de definición; no se deriva de la categoría del autor.', 'Las referencias históricas se conservan como consulta y no sustituyen las asignaciones vigentes.', 'Las credenciales de Amazon no forman parte del expediente.'], secondaryErrors: errors };
}
export async function guardarDatosDocumentales(id: string, area: string, input: Record<string, ValorDocumental>, actor: ActorFicha) {
    await verificarAccesoFichaViva(id, actor);
    const fields = CAMPOS_DOCUMENTALES.filter(f => f.area === area);
    const keys = Object.keys(input);
    if (!keys.length)
        throw new ErrorFichaViva(400, 'Indica al menos un cambio');
    for (const key of keys) {
        const def = fields.find(f => f.key === key);
        if (!def)
            throw new ErrorFichaViva(400, 'Campo documental no reconocido');
        if (!def.roles.includes(actor.rol))
            throw new ErrorFichaViva(403, 'Este campo pertenece a otra área');
        const v = input[key];
        if (v === null)
            continue;
        if (def.type === 'booleano' && typeof v !== 'boolean')
            throw new ErrorFichaViva(400, 'Valor de selección inválido');
        if (def.type === 'numero' && (typeof v !== 'number' || v < 0 || !Number.isInteger(v)))
            throw new ErrorFichaViva(400, 'Debe indicar una cantidad entera');
        if (['texto', 'fecha', 'enlace'].includes(def.type) && typeof v !== 'string')
            throw new ErrorFichaViva(400, 'Valor de texto inválido');
        if (def.type === 'fecha' && typeof v === 'string' && !z.string().date().safeParse(v).success)
            throw new ErrorFichaViva(400, 'Fecha inválida');
        if (def.type === 'enlace' && typeof v === 'string') {
            try {
                const u = new URL(v);
                if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password)
                    throw new Error();
            }
            catch {
                throw new ErrorFichaViva(400, 'Usa un enlace HTTP o HTTPS sin credenciales');
            }
        }
    }
    await db.transaction(async tx => {
        await tx.select({ id: proyectos.id }).from(proyectos).where(eq(proyectos.id, id)).for('update');
        const [before] = await tx.select().from(fichaDocumentalDatos).where(and(eq(fichaDocumentalDatos.proyectoId, id), eq(fichaDocumentalDatos.seccion, area)));
        await verificarAccesoFichaViva(id, actor, tx);
        if(area==='impresion'&&actor.rol==='rrpp') {
          const {verificarOperacionImpresion}=await import('./solicitudesArea.js');
          await verificarOperacionImpresion(tx,id,actor);
        }
        const scopes = await alcancesCorrector(id, actor, tx);
        if (scopes !== null && keys.some(key => !scopes.some(prefix => key.startsWith(prefix))))
            throw new ErrorFichaViva(403, 'Este criterio corresponde a otra intervención de corrección');
        const changed = keys.filter(k => JSON.stringify(before?.datos[k] ?? null) !== JSON.stringify(input[k]));
        if (!changed.length) return;
        await tx.insert(fichaDocumentalDatos).values({ proyectoId: id, seccion: area, datos: { ...before?.datos, ...input } }).onConflictDoUpdate({
            target: [fichaDocumentalDatos.proyectoId, fichaDocumentalDatos.seccion],
            set: { datos: { ...before?.datos, ...input }, updatedAt: new Date() }
        });
        await registrarEvento(tx, { actorId: actor.id, accion: 'FICHA_DOCUMENTAL_ACTUALIZADA', entityType: 'proyecto', entityId: id, proyectoId: id, detalles: { area, campos: changed } });
    });
    return { ok: true };
}
