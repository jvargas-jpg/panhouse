import { EVENTOS_LANZAMIENTO_RRPP } from './rrppLanzamientoCatalogos.js';
// Proyección pública explícita: jamás se devuelve detalles/entityId/actorId del audit.
export const EVENTOS_PROYECTO_RRPP: Record<
  string,
  { titulo: string; area: string; etapa?: string }
> = {
  ...Object.fromEntries(Object.entries(EVENTOS_LANZAMIENTO_RRPP).map(([accion, titulo]) => [accion, { titulo, area: 'RRPP', etapa: 'lanzamiento' }])),
  RRPP_NOTIFICADO: {
    titulo: 'Comercial entregó el proyecto a RRPP',
    area: 'Comercial',
    etapa: 'ingreso',
  },
  INFORMACION_COMERCIAL_ACTUALIZADA: {
    titulo: 'Comercial actualizó información',
    area: 'Comercial',
  },
  INTAKE_RRPP_INICIADO: {
    titulo: 'RRPP inició el diagnóstico',
    area: 'RRPP',
    etapa: 'ingreso',
  },
  DIAGNOSTICO_ACTUALIZADO: {
    titulo: 'RRPP actualizó el diagnóstico',
    area: 'RRPP',
    etapa: 'ingreso',
  },
  DIAGNOSTICO_COMPLETADO: {
    titulo: 'RRPP completó el diagnóstico',
    area: 'RRPP',
    etapa: 'ingreso',
  },
  JEFATURA_NOTIFICADA: {
    titulo: 'RRPP envió el proyecto a Jefatura',
    area: 'RRPP',
    etapa: 'jefatura',
  },
  ESPECIALISTA_ASIGNADO: {
    titulo: 'Jefatura asignó especialista',
    area: 'Jefatura',
    etapa: 'jefatura',
  },
  ESPECIALISTA_REASIGNADO: {
    titulo: 'Jefatura reasignó especialista',
    area: 'Jefatura',
    etapa: 'jefatura',
  },
  EDITOR_SOLICITADO: {
    titulo: 'Especialista solicitó Edición',
    area: 'Producción',
    etapa: 'edicion',
  },
  EDITOR_ASIGNADO: {
    titulo: 'Edición asignó editor',
    area: 'Producción',
    etapa: 'edicion',
  },
  EDITOR_REASIGNADO: {
    titulo: 'Edición reasignó editor',
    area: 'Producción',
    etapa: 'edicion',
  },
  FEEDBACK_TRIPA_REGISTRADO: {
    titulo: 'Especialista registró el feedback de tripa',
    area: 'Producción',
    etapa: 'edicion',
  },
  CORRECCION_SOLICITADA: {
    titulo: 'Especialista solicitó Corrección',
    area: 'Producción',
    etapa: 'correccion',
  },
  CORRECTOR_ASIGNADO: {
    titulo: 'Corrección asignó corrector',
    area: 'Producción',
    etapa: 'correccion',
  },
  CORRECTOR_REASIGNADO: {
    titulo: 'Corrección reasignó corrector',
    area: 'Producción',
    etapa: 'correccion',
  },
  CORRECCION_INICIADA: {
    titulo: 'Corrección inició su trabajo',
    area: 'Producción',
    etapa: 'correccion',
  },
  CORRECCION_ENTREGADA: {
    titulo: 'Corrección entregó su trabajo',
    area: 'Producción',
    etapa: 'correccion',
  },
  CORRECCION_CERRADA: {
    titulo: 'Especialista cerró la intervención de Corrección',
    area: 'Producción',
    etapa: 'correccion',
  },
  DIRECCION_CREATIVA_SOLICITADA: {
    titulo: 'Especialista solicitó Dirección Creativa',
    area: 'Creativa',
    etapa: 'creativa',
  },
  LIDER_CREATIVO_ASIGNADO: {
    titulo: 'Líder Creativo asignado',
    area: 'Creativa',
    etapa: 'creativa',
  },
  REUNION_CREATIVA_REGISTRADA: {
    titulo: 'Reunión creativa registrada',
    area: 'Creativa',
    etapa: 'creativa',
  },
  BRIEF_CREATIVO_GENERADO: {
    titulo: 'Creativa entregó el brief',
    area: 'Creativa',
    etapa: 'creativa',
  },
  BRIEF_CREATIVO_APROBADO: {
    titulo: 'Autor aprobó el brief creativo',
    area: 'Creativa',
    etapa: 'creativa',
  },
  CONCEPTOS_ENTREGADOS: {
    titulo: 'Creativa entregó conceptos de portada',
    area: 'Creativa',
    etapa: 'creativa',
  },
  CONCEPTO_APROBADO_RRPP: {
    titulo: 'RRPP aprobó un concepto de portada',
    area: 'RRPP',
    etapa: 'creativa',
  },
  CONCEPTO_DEVUELTO_RRPP: {
    titulo: 'RRPP devolvió un concepto a Creativa',
    area: 'RRPP',
    etapa: 'creativa',
  },
  CONCEPTO_APROBADO_AUTOR: {
    titulo: 'Autor aprobó un concepto de portada',
    area: 'Creativa',
    etapa: 'creativa',
  },
  RECURSOS_CREATIVOS_ENTREGADOS: {
    titulo: 'Creativa entregó recursos de portada',
    area: 'Creativa',
    etapa: 'creativa',
  },
  DIRECCION_CREATIVA_CERRADA: {
    titulo: 'Dirección Creativa cerró su intervención',
    area: 'Creativa',
    etapa: 'creativa',
  },
  DISENO_SOLICITADO: {
    titulo: 'Especialista solicitó Diseño',
    area: 'Producción',
    etapa: 'diseno',
  },
  DISENADOR_ASIGNADO: {
    titulo: 'Diseñador asignado',
    area: 'Producción',
    etapa: 'diseno',
  },
  DISENADOR_REASIGNADO: {
    titulo: 'Diseñador reasignado',
    area: 'Producción',
    etapa: 'diseno',
  },
  DISENO_VERSION_ENTREGADA: {
    titulo: 'Diseño entregó una versión',
    area: 'Producción',
    etapa: 'diseno',
  },
  REVISION_CUBIERTA_SOLICITADA: {
    titulo: 'Diseño solicitó revisión de cubierta',
    area: 'Producción',
    etapa: 'diseno',
  },
  DISENO_ENVIAR_AUTOR: {
    titulo: 'Diseño enviado al autor',
    area: 'Producción',
    etapa: 'diseno',
  },
  DISENO_FEEDBACK: {
    titulo: 'Feedback de diseño registrado',
    area: 'Producción',
    etapa: 'diseno',
  },
  DISENO_APROBAR_AUTOR: {
    titulo: 'Autor aprobó el diseño',
    area: 'Producción',
    etapa: 'diseno',
  },
  DISENO_HANDOFF_CALIDAD: {
    titulo: 'Diseño entregó el proyecto a Calidad',
    area: 'Producción',
    etapa: 'calidad',
  },
  CUBIERTA_REVISION_INTERNA: {
    titulo: 'Revisión interna de cubierta registrada',
    area: 'Producción',
    etapa: 'diseno',
  },
  CUBIERTA_REVISION_CREATIVA: {
    titulo: 'Creativa revisó la cubierta',
    area: 'Creativa',
    etapa: 'creativa',
  },
  CALIDAD_INICIADA: {
    titulo: 'Calidad inició su revisión',
    area: 'Producción',
    etapa: 'calidad',
  },
  CALIDAD_REVISADA: {
    titulo: 'Calidad completó su revisión',
    area: 'Producción',
    etapa: 'calidad',
  },
  CALIDAD_ENVIADA_AUTOR: {
    titulo: 'Calidad envió la revisión al autor',
    area: 'Producción',
    etapa: 'calidad',
  },
  CALIDAD_FEEDBACK_AUTOR: {
    titulo: 'Feedback del autor registrado en Calidad',
    area: 'Producción',
    etapa: 'calidad',
  },
  CALIDAD_APROBADA_AUTOR: {
    titulo: 'Autor aprobó la revisión de Calidad',
    area: 'Producción',
    etapa: 'calidad',
  },
  CALIDAD_REVISION_FINAL_SOLICITADA: {
    titulo: 'Revisión final de Calidad solicitada',
    area: 'Producción',
    etapa: 'calidad',
  },
};
