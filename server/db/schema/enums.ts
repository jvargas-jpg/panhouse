import { pgEnum } from 'drizzle-orm/pg-core';

export const ROLES = [
  'comercial',
  'rrpp',
  'jefe_area',
  'especialista',
  'jefe_edicion',
  'editor',
  'lider_creativo',
  'disenador',
  'soporte_editorial',
  'soporte_digital',
  'impresion',
  'cobranzas',
  'talento_humano',
  'direccion',
  'autor',
] as const;

export type Rol = (typeof ROLES)[number];

export const rolEnum = pgEnum('rol', ROLES);

export const ESTADOS_PROYECTO = [
  'en_proceso',
  'retrasado',
  'stand_by',
  'pausado',
  'culminado',
  'retirado',
] as const;

export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number];

export const estadoProyectoEnum = pgEnum('estado_proyecto', ESTADOS_PROYECTO);

// Las dos causas representan siempre algo externo al desempeño del
// especialista (ver server/helpers/performance.ts). No existen más
// categorías válidas de retraso que estas dos.
export const CAUSAS_PAUSA = ['autor', 'otro_departamento'] as const;

export type CausaPausa = (typeof CAUSAS_PAUSA)[number];

export const causaPausaEnum = pgEnum('causa_pausa', CAUSAS_PAUSA);

// Motivo por el que un proyecto entra en STAND-BY. Se guarda como
// categoría cerrada (nunca texto libre con detalle personal): el
// retorno es breve, o existe una exoneración contractual.
export const CATEGORIAS_STAND_BY = ['retorno_breve', 'exoneracion_contractual'] as const;

export type CategoriaStandBy = (typeof CATEGORIAS_STAND_BY)[number];

export const categoriaStandByEnum = pgEnum('categoria_stand_by', CATEGORIAS_STAND_BY);

// Cómo se confirmó que un proyecto está pagado en su totalidad antes de
// pausarlo: hoy siempre a mano; cuando exista el portal de pagos podrá
// llegar por webhook sin cambiar el resto del flujo.
export const ORIGENES_CONFIRMACION_PAGO = ['manual', 'webhook_pagos'] as const;

export type OrigenConfirmacionPago = (typeof ORIGENES_CONFIRMACION_PAGO)[number];

export const origenConfirmacionPagoEnum = pgEnum('origen_confirmacion_pago', ORIGENES_CONFIRMACION_PAGO);

// Sección 4 — Diseño: tipo de portada acordado en el brief. Categoría
// cerrada confirmada contra la matriz real de Dirección Creativa.
export const TIPOS_PORTADA = ['tipografica', 'fotografica', 'ilustrada'] as const;

export type TipoPortada = (typeof TIPOS_PORTADA)[number];

export const tipoPortadaEnum = pgEnum('tipo_portada', TIPOS_PORTADA);

// Sección 8 — Impresión: estado de la cotización solicitada.
export const ESTADOS_COTIZACION_IMPRESION = ['solicitada', 'enviada', 'aceptada', 'rechazada'] as const;

export type EstadoCotizacionImpresion = (typeof ESTADOS_COTIZACION_IMPRESION)[number];

export const estadoCotizacionImpresionEnum = pgEnum('estado_cotizacion_impresion', ESTADOS_COTIZACION_IMPRESION);

// Ciclo de aprobación de portada (Portal del Autor) — proyectos.portadaDecisionAutor
// es varchar en la base de datos, no un pgEnum, a pedido explícito del
// negocio; estos tres valores solo se validan en la capa de rutas (ver
// server/routes/proyectos.routes.ts y server/helpers/portalAutor.ts).
export const DECISIONES_PORTADA = ['pendiente', 'aprobada', 'rechazada'] as const;

export type DecisionPortada = (typeof DECISIONES_PORTADA)[number];
