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

// Categoría comercial del cliente (autores.categoria) — cerrada a
// propósito, mismo criterio que el resto de este archivo: comercial
// filtra/prioriza por VIP en el directorio de Clientes, no tendría
// sentido dejarlo como texto libre con variantes de tipeo distintas.
export const CATEGORIAS_CLIENTE = ['Estándar', 'VIP'] as const;

export type CategoriaCliente = (typeof CATEGORIAS_CLIENTE)[number];

export const categoriaClienteEnum = pgEnum('categoria_cliente', CATEGORIAS_CLIENTE);

// Sección 1 (parte 3) — Datos de ingreso: velocidad de ejecución
// contratada (fichasTrazabilidad.ingresoServicioEjecucion). Cerrado a
// propósito — texto libre dejaba pasar variaciones de tipeo ("Rapido",
// "rápido", "urgente") que después rompían cualquier filtro por este
// campo. 'Express' (sin tilde, no "Exprés"): así lo pidió el negocio
// explícitamente en esta ronda — dispara el campo condicional
// ingresoTiempoExpresMeses (ver SeccionProyectoPerfil.tsx).
export const EJECUCIONES_SERVICIO = ['Normal', 'Express'] as const;

export type EjecucionServicio = (typeof EJECUCIONES_SERVICIO)[number];

export const ejecucionServicioEnum = pgEnum('ejecucion_servicio', EJECUCIONES_SERVICIO);

// PERFILES_SERVICIO/perfilServicioEnum (Estándar/VIP a nivel de
// PROYECTO) se eliminaron a pedido explícito del negocio: redundante con
// autores.categoria (CATEGORIAS_CLIENTE, más arriba), que ya captura el
// mismo estatus a nivel de Cliente — ver fichasTrazabilidad en
// trazabilidad.ts.

// Sección 1 (parte 3) — Datos de ingreso: nivel de presupuesto de la
// matriz de ingreso (fichasTrazabilidad.ingresoServicioPresupuesto).
// Mismas tres etiquetas que el catálogo real `presupuestos`
// (proyectos.presupuestoId) por coincidencia de nomenclatura del
// negocio, pero es un campo de texto de la matriz de ingreso, no una
// FK a ese catálogo — no se tocan mutuamente, ver el comentario de
// ingresoServicioPresupuesto en trazabilidad.ts.
export const PRESUPUESTOS_SERVICIO = ['Plata', 'Oro', 'Platinium'] as const;

export type PresupuestoServicio = (typeof PRESUPUESTOS_SERVICIO)[number];

export const presupuestoServicioEnum = pgEnum('presupuesto_servicio', PRESUPUESTOS_SERVICIO);

// Sección 1 (parte 3) — Datos de ingreso: subtipo del servicio 'Crudo'
// (fichasTrazabilidad.ingresoServicioSubtipoCrudo). Comercial, al crear
// el proyecto, solo elige la categoría general del servicio (Sello
// editorial / Escritura fantasma / Crudo — ver CODIGOS_SERVICIO_PERMITIDOS_EN_ALTA
// en helpers/proyectos.ts); si eligió Crudo, RRPP define después cuál
// de los dos subtipos es, acá — mientras tanto queda null a propósito
// ("pendiente de RRPP"), nunca con un default: forzar 'Capítulo' o
// 'Tripa' sin que RRPP lo haya decidido inventaría un dato. El cálculo
// de Fecha de Cierre (SeccionProyectoPerfil.tsx) depende de este valor
// para el caso Crudo — sin él, esa fecha se queda sin calcular.
export const SUBTIPOS_CRUDO = ['Capítulo', 'Tripa'] as const;

export type SubtipoCrudo = (typeof SUBTIPOS_CRUDO)[number];

export const subtipoCrudoEnum = pgEnum('subtipo_crudo', SUBTIPOS_CRUDO);

// Sección 1 — Proyecto (fichasTrazabilidad.condicionesEspeciales), junto
// a capitulosPactados/paginasPactadas — mismo dueño (comercial), misma
// promesa contractual. Cerrado a pedido explícito del negocio: antes era
// texto libre (ingresoCondicionesEspeciales, eliminado junto con
// "Parámetros Técnicos y Equipo" — ver el comentario en
// trazabilidad.ts), ahora selección múltiple estricta (chips, ver
// SelectorMultipleCondicionesEspeciales.tsx) para evitar variantes
// libres que no se puedan filtrar de forma confiable, mismo motivo que
// EJECUCIONES_SERVICIO más arriba. Sin 'Ninguna' a propósito — con
// selección múltiple, un array vacío ya representa "ninguna condición
// especial" sin necesitar una opción explícita para decirlo.
export const CONDICIONES_ESPECIALES = [
  'Ilustraciones',
  'Gráficos',
  'Diagramación especial',
  'Diagramación ultra especial',
] as const;

export type CondicionEspecial = (typeof CONDICIONES_ESPECIALES)[number];

export const condicionEspecialEnum = pgEnum('condicion_especial', CONDICIONES_ESPECIALES);

// Sección "Ficha Editorial" (fichasTrazabilidad.coleccionPanhouse) —
// dueño rrpp, no comercial (ver el comentario de la sección completa en
// trazabilidad.ts). Cerrado a pedido explícito del negocio, ocho
// colecciones reales de la editorial.
export const COLECCIONES_PANHOUSE = [
  'Crecimiento Espiritual',
  'Emprendimiento y Crecimiento Personal',
  'Literatura',
  'Salud y Bienestar',
  'Sin asignar',
  'Liderazgo',
  'Ciencias sociales',
  'PanHouse Kids',
] as const;

export type ColeccionPanhouse = (typeof COLECCIONES_PANHOUSE)[number];

export const coleccionPanhouseEnum = pgEnum('coleccion_panhouse', COLECCIONES_PANHOUSE);

// Sección "Ficha Editorial" (fichasTrazabilidad.publicoSexo) — a
// diferencia de publicoEdad/publicoPerfil (texto libre, con o sin
// <select> de sugerencias), este sí cerrado a pedido explícito del
// negocio: tres categorías, sin variantes de tipeo que filtrar.
export const PUBLICOS_SEXO = ['Masculino', 'Femenino', 'Mixto'] as const;

export type PublicoSexo = (typeof PUBLICOS_SEXO)[number];

export const publicoSexoEnum = pgEnum('publico_sexo', PUBLICOS_SEXO);

// "Matriz de Ingreso (RRPP)" (fichasTrazabilidad.matrizEstadoReunion) —
// dueño rrpp, cerrado a pedido explícito del negocio: las cuatro etapas
// de seguimiento de reuniones con el autor a lo largo de todo el
// proyecto, de ingreso a lanzamiento. No confundir con
// fichaLanzamientoReuniones (Sección 7): esa tabla son las reuniones de
// lanzamiento en sí (fecha/puntos tratados/acuerdos, una fila por
// reunión); esto es solo la etapa agregada en la que está el
// seguimiento comercial del proyecto.
export const ESTADOS_REUNION = [
  'Reunión de ingreso',
  'Revisión de objetivos',
  'Reunión creativa',
  'Reunión de promoción, lanzamiento y distribución',
] as const;

export type EstadoReunion = (typeof ESTADOS_REUNION)[number];

export const estadoReunionEnum = pgEnum('estado_reunion', ESTADOS_REUNION);

// "Matriz de Ingreso (RRPP)" (fichasTrazabilidad.matrizPropietario) —
// antes texto libre ("temporal", ver el comentario histórico en
// trazabilidad.ts), cerrado a pedido explícito del negocio: las dos
// únicas personas que hoy son dueñas de una cuenta en esta matriz.
export const PROPIETARIOS_MATRIZ_INGRESO = ['Paola Morales', 'Daniel Valente'] as const;

export type PropietarioMatrizIngreso = (typeof PROPIETARIOS_MATRIZ_INGRESO)[number];

export const propietarioMatrizIngresoEnum = pgEnum('propietario_matriz_ingreso', PROPIETARIOS_MATRIZ_INGRESO);

// "Proceso de Lanzamiento y Promoción" (Área exclusiva de RRPP, Fase 1
// — fichasTrazabilidad.lanzamientoPromocionParticipacionFerias). Tres
// valores explícitos dados por el negocio, cerrado a propósito — mismo
// criterio que el resto de este archivo.
export const PARTICIPACION_FERIAS = ['Sí', 'No', 'Pendiente'] as const;

export type ParticipacionFerias = (typeof PARTICIPACION_FERIAS)[number];

export const participacionFeriasEnum = pgEnum('participacion_ferias', PARTICIPACION_FERIAS);

// "Matriz de Asesorías con fechas" — módulo de RRPP, mismo lugar que
// "Matriz de Ingreso" (/proyectos/:id/ficha-trazabilidad, ver FichaTrazabilidadPage.tsx
// en el frontend y el comentario completo en schema/trazabilidad.ts).
// Prefijo `asesoria` en todas las columnas de esta matriz a propósito:
// varios nombres de campo pedidos por el negocio (nivelSatisfaccion,
// responsableImpresion, contratoRecibidoFirmado) chocaban o casi chocaban
// con columnas ya existentes en fichasTrazabilidad (nivelSatisfaccion de
// la Sección 7, impresionResponsable de la Sección 8, matrizContratoFirmado
// de la Matriz de Ingreso) — mismo criterio que matriz*/lanzamientoPromocion*
// más arriba.
export const ASESORIA_ESTADOS = ['Completado', 'Con fecha de lanzamiento', 'En proceso editorial', 'Finalizado'] as const;

export type AsesoriaEstado = (typeof ASESORIA_ESTADOS)[number];

export const asesoriaEstadoEnum = pgEnum('asesoria_estado', ASESORIA_ESTADOS);

export const ASESORIA_NIVELES_SATISFACCION = ['Bueno', 'Excelente', 'Regular'] as const;

export type AsesoriaNivelSatisfaccion = (typeof ASESORIA_NIVELES_SATISFACCION)[number];

export const asesoriaNivelSatisfaccionEnum = pgEnum('asesoria_nivel_satisfaccion', ASESORIA_NIVELES_SATISFACCION);

export const ASESORIA_FASES = ['En asesoramiento', 'Esperando fecha', 'En espera de lanzamiento', 'Culminado'] as const;

export type AsesoriaFase = (typeof ASESORIA_FASES)[number];

export const asesoriaFaseEnum = pgEnum('asesoria_fase', ASESORIA_FASES);

// Bogotá y Colombia quedan como dos opciones separadas tal como las dio
// el negocio (no es un error de tipeo evidente como guadalaja/guadalajara
// más abajo — se deja así hasta que confirmen si es una sola).
export const ASESORIA_FERIAS_PROYECTADAS = ['Bogotá', 'Colombia', 'Guadalajara', 'Panamá'] as const;

export type AsesoriaFeriaProyectada = (typeof ASESORIA_FERIAS_PROYECTADAS)[number];

export const asesoriaFeriaProyectadaEnum = pgEnum('asesoria_feria_proyectada', ASESORIA_FERIAS_PROYECTADAS);

export const ASESORIA_FUTURO_AUTOR = ['Desea ser publicado', 'No desea ser publicado aún', 'Publicado'] as const;

export type AsesoriaFuturoAutor = (typeof ASESORIA_FUTURO_AUTOR)[number];

export const asesoriaFuturoAutorEnum = pgEnum('asesoria_futuro_autor', ASESORIA_FUTURO_AUTOR);

// "guadalaja" del pedido original corregido a "Guadalajara" — mismo
// nombre real que ASESORIA_FERIAS_PROYECTADAS arriba, error de tipeo
// evidente (a diferencia de Bogotá/Colombia arriba, que se dejaron tal
// cual por no ser un caso claro).
export const ASESORIA_FERIAS_A_PARTICIPAR = ['Bogotá', 'Guadalajara', 'Panamá', 'Ambas'] as const;

export type AsesoriaFeriaAParticipar = (typeof ASESORIA_FERIAS_A_PARTICIPAR)[number];

export const asesoriaFeriaAParticiparEnum = pgEnum('asesoria_feria_a_participar', ASESORIA_FERIAS_A_PARTICIPAR);

export const ASESORIA_RESPONSABLES_IMPRESION = [
  'Barbara Carballo',
  'Impresiones PanHouse - Casa Editorial PanHouse',
  'Paola Morales',
  'Miranda Cedillo',
] as const;

export type AsesoriaResponsableImpresion = (typeof ASESORIA_RESPONSABLES_IMPRESION)[number];

export const asesoriaResponsableImpresionEnum = pgEnum('asesoria_responsable_impresion', ASESORIA_RESPONSABLES_IMPRESION);

export const ASESORIA_RESPONSABLES_DISTRIBUCION = ['Paola Morales', 'Distribución PanHouse'] as const;

export type AsesoriaResponsableDistribucion = (typeof ASESORIA_RESPONSABLES_DISTRIBUCION)[number];

export const asesoriaResponsableDistribucionEnum = pgEnum('asesoria_responsable_distribucion', ASESORIA_RESPONSABLES_DISTRIBUCION);

// Ciclo de aprobación de portada (Portal del Autor) — proyectos.portadaDecisionAutor
// es varchar en la base de datos, no un pgEnum, a pedido explícito del
// negocio; estos tres valores solo se validan en la capa de rutas (ver
// server/routes/proyectos.routes.ts y server/helpers/portalAutor.ts).
export const DECISIONES_PORTADA = ['pendiente', 'aprobada', 'rechazada'] as const;

export type DecisionPortada = (typeof DECISIONES_PORTADA)[number];
