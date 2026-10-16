import type { ProjectWorkspaceSummary } from './projectWorkspace.js';
export interface PreparacionProyecto {
  workspace?:ProjectWorkspaceSummary;
  recibidoEn: string | null; expedienteRevisadoEn: string | null; primerContactoEn: string | null;
  primerContactoDueAt: string | null; reunionOperativaFecha: string | null; reunionOperativaRealizada: boolean;
  grabacionUrl: string | null; transcripcionUrl: string | null; minutaUrl: string | null; cronogramaUrl: string | null;
  driveCarpetaUrl: string | null; driveEstado: 'no_configurado' | 'pendiente' | 'configurado' | 'error';
  observaciones: string | null; estado: 'Pendiente' | 'En curso' | 'Completo'; editable: boolean;
}
export interface SolicitudAreaResumen {
  id: string; tipo: 'lanzamiento' | 'impresion'; estado: string; requestedAt: string; resolvedAt: string | null; outcome: string | null;
}
export interface ContextoActivacion {
  tipo: 'lanzamiento' | 'impresion'; gate: { desbloqueado: boolean; motivo: string };
  solicitud: SolicitudAreaResumen | null; activo: boolean; legacy: boolean;
  operadoPor?: string | null;
}
// Las capacidades y el owner se calculan en servidor, nunca por el diseño de la tarjeta.
export const PROCESOS_OPERATIVOS: Record<string, { nombre: string; ownerRole: string; ownerLabel: string; coordinacion: 'directa' | 'activacion' | 'consulta' }> = {
  preparacion_inicial: { nombre: 'Preparación inicial', ownerRole: 'especialista', ownerLabel: 'Especialista editorial', coordinacion: 'directa' },
  edicion: { nombre: 'Edición', ownerRole: 'editor', ownerLabel: 'Editor · asignado por Jefatura de Edición', coordinacion: 'directa' },
  correccion: { nombre: 'Corrección', ownerRole: 'corrector', ownerLabel: 'Corrector', coordinacion: 'directa' },
  direccion_creativa: { nombre: 'Dirección creativa', ownerRole: 'lider_creativo', ownerLabel: 'Líder Creativo', coordinacion: 'activacion' },
  diseno: { nombre: 'Diseño y diagramación', ownerRole: 'disenador', ownerLabel: 'Diseñador', coordinacion: 'directa' },
  revision_interna_cubierta: { nombre: 'Revisión de cubierta', ownerRole: 'jefe_edicion', ownerLabel: 'Jefatura de Edición', coordinacion: 'consulta' },
  calidad: { nombre: 'Calidad editorial', ownerRole: 'soporte_editorial', ownerLabel: 'Soporte Editorial / Validador', coordinacion: 'directa' },
  soporte_digital: { nombre: 'Soporte digital', ownerRole: 'soporte_digital', ownerLabel: 'Soporte Digital', coordinacion: 'activacion' },
  lanzamiento: { nombre: 'Lanzamiento y promoción', ownerRole: 'rrpp', ownerLabel: 'RRPP', coordinacion: 'activacion' },
  impresion: { nombre: 'Impresión', ownerRole: 'rrpp', ownerLabel: 'RRPP · coordinación', coordinacion: 'activacion' },
  distribucion: { nombre: 'Distribución', ownerRole: 'distribucion', ownerLabel: 'Distribución', coordinacion: 'consulta' },
};
