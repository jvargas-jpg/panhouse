# Entrega · Inicio del Especialista y Project Command Center

La primera pantalla del Especialista ahora reúne acciones de coordinación, entregas pautadas y cartera real. El detalle abre un centro único del proyecto para Especialista y Jefatura, con procesos paralelos, Ficha integrada, responsables y actividad. Los formularios conservan sus APIs y autorizaciones nativas.

La entrega también incorpora los Indicadores de Jefatura y los 60 escenarios DEMO solicitados previamente. Son registros ficticios identificados como DEMO; los 30 proyectos originales se preservaron y se verificaron antes/después. No se importaron datos de autores, pagos ni objetivos desde la matriz.

## Fuentes y documentación

- Manual exacto `(3)` localizado en Descargas y leído completo: SHA256 `c9d2ee6ff5b21fd30b7b513cce390d048adf59042c53144a1cb00b232418af19`. Copia local ignorada en `fuentes-negocio/`.
- Matriz IA, versión sin `(1)` confirmada por el usuario: SHA256 `812480fe35cd87d83858e47cd863751697eafbc84e6c1611eca0ad57e4b95072`. 25 hojas, 56 columnas de BDD-IA, hojas ocultas y 724 reglas de formato revisadas.
- [Mapa Matriz → PanHouse y Manual → workflows](../arquitectura/18-project-command-center.md).
- [Arquitectura Inicio](../arquitectura/19-especialista-inicio.md), [Indicadores](../arquitectura/18-jefatura-indicadores.md), [auditoría de matriz](../auditoria/command-center-matriz-ia.json).

## Reporte del Command Center · A–AR

| Punto solicitado | Resultado |
|---|---|
| A · Estado anterior | Detalle con diez pestañas interpretadas como fases, progreso basado en navegación y Ficha independiente. HEAD de auditoría `5d4f2e4`. |
| B · Archivos | `ProyectoCommandCenterPage`, `CommandCenterContexto/Edicion/Proceso`, dispatcher y detalle legacy, navegación/shell, Ficha, `projectCommandCenter` helper/rutas/contrato, activación Amazon y tests. Inventario completo en Git y manifiesto congelado. |
| C · Matriz | 56 columnas mapeadas individualmente en arquitectura: identidad, fechas, responsables, procesos, estados, administración, avances y compromisos mensuales. Sin importación automática. |
| D · Manual | F1–F7, anexos, ownership, triggers, entregables, plazos y solvencia contrastados con código. Amazon F1 y Lanzamiento por hito confirmados. |
| E · Arquitectura | Proyección común y ligera, APIs nativas para operar, expediente e historial diferidos; ámbito antes de detalles. |
| F · Shell | Sidebar 224 px, logo 176 px, una cuenta, breadcrumb con retorno, una identidad de proyecto. |
| G · Tabs | Resumen, Operación, Equipo, Ficha y Actividad, con rutas propias. |
| H · Paralelismo | Grupos de work items, múltiples instancias/versiones y responsables; Edición y Creativa pueden estar activas junto a Corrección pendiente. |
| I · Fase 1/10 | Eliminada para Especialista/Jefatura. Seleccionar una vista no significa completar una fase. |
| J · Porcentaje | Eliminado; no existe denominador formal de avance. |
| K · Resumen | Contexto, estado, Express, margen, conteos de intervenciones, atención, actividad y administración. |
| L · Atención | Clasificación compartida con Inicio: coordinación propia; feedback aún en plazo no se cuenta como acción. Jefatura conserva revisión/asignación propias. |
| M · Operación | Procesos reales con instancias, fechas, responsable, gate y decisiones; selección abre formulario nativo diferido. |
| N · Equipo | Assignments vigentes y FK como fallback; no asignación genérica de todos los roles. |
| O · Ficha | Nueve áreas del expediente existente dentro del proyecto; permisos por campo y editor documental conservados. |
| P · Actividad | Historial inmutable, paginación estable fecha+UUID; avance del Especialista auditado, sin sobrescribir eventos anteriores. |
| Q · Administración | Consulta de contrato/abonos/presupuesto; Comercial/Cobranzas mantienen ownership. Sin deducir solvencia o seis cuotas obligatorias. |
| R · Objetivos | No existe registro/propietario confirmado. Consulta de la brecha desde la Home, sin metas o porcentajes inventados. |
| S · Work items | Fuente de estado operativo, repetibilidad y trazabilidad; consulta no fabrica fases; nueva activación Amazon idempotente en handoff F1. |
| T · Assignments | La asignación activa de proyecto prevalece sobre FK obsoleto. Alcances de intervención permanecen independientes. |
| U · Gates | APIs originales; >120 páginas de Tripa requiere Decisiones, RRPP aprueba conceptos antes del autor, versiones/rondas de Calidad preservadas. |
| V · Especialista | Solo cartera propia; coordina capítulos/títulos/avance y usa sus operaciones originales. No ejecuta tareas del Editor o Corrector desde una API nueva. |
| W · Jefatura | Misma verdad del proyecto; supervisa y usa asignaciones/decisiones propias. No puede registrar avance del Especialista. |
| X · Campo | Catálogo cerrado del expediente y schemas estrictos: campos administrativos o financieros ajenos rechazados. Credenciales Amazon fuera del expediente. |
| Y · Navegación | `volver` interno conserva filtros; enlaces del expediente abren el proceso dentro del shell; hashes/ruta Ficha legacy adaptados. |
| Z · Sidebar | Navegación global de cada rol; Especialista tiene cinco destinos consistentes con Inicio y detalle. |
| AA · Backend | GET Command Center, PATCH títulos y POST avance; reusan Ficha/snapshot/gates. Amazon se habilita desde el handoff nativo y se completa por Digital. |
| AB · Rendimiento | 30 SQL acotadas en una carga de Command Center, constantes al aumentar intervenciones; expediente e historial no se consultan por tarjeta. Inicio reemplaza lista + una Ficha HTTP por proyecto. |
| AC · Tests nuevos | 18 pruebas Command Center: ámbito, RBAC, asignación, paralelismo, configuración, administración, títulos/avance, historia, consultas constantes y Amazon. |
| AD · Tests totales | Ver validación integral final debajo; los resultados provisionales previos se conservan identificados como tales. |
| AE · Build/typecheck | Ver validación final debajo. |
| AF · Primera captura | `project-command-center/especialista-desktop-inicial.png`, conservada para comparación. |
| AG · Hallazgos | Decimales excesivos, atención genérica, doble franja de layout/branding y feedback por capítulo sin agrupar. |
| AH · Correcciones | Redondeo visual, atención desde hechos nativos, layout único, logo uniforme, feedback agrupado y retorno del expediente corregido. |
| AI · Final Especialista | Desktop con DEMO `1093A0`, coordinación real y escritura de avance validada. |
| AJ · Final Jefatura | Mismo DEMO `1093A0`; procesos/salud/administración iguales, supervisión y acciones propias. |
| AK · Permisos | Jefatura POST avance 403; Especialista ajeno 403; permisos documentales originales preservados. |
| AL · Ficha QA | Nueve áreas, misma identidad y datos, links al proceso, Escape/foco en diálogos y tres viewports. |
| AM · Seguimiento QA | Seguimiento → mismo Command Center → retorno con búsqueda; Quick View de Proyectos también validado. |
| AN · Tablet | 768×1024, Resumen y Ficha sin desborde. |
| AO · Móvil | 375×812, navegación global y formularios/expediente accesibles. |
| AP · Brechas | Registro mensual, solvencia formal, timer estructurado de primer contacto y controversia CR Tripa 90/150 días; no se cambiaron reglas sin definición. |
| AQ · Git | Cambios propios revisados y conservados; originales de negocio ignorados. Estado final registrado al cerrar validación. |
| AR · Commit | Commit de entrega realizado después de regresión, compilaciones y revisión final. Véase cierre de validación. |

## Reporte de Inicio · A–AC

| Punto solicitado | Resultado |
|---|---|
| A · Anterior | Especialista entraba al Kanban con fase inferida única; lista de 15 proyectos ejecutaba 32 SQL y luego 15 Fichas HTTP. |
| B · Archivos | `HomePage`, `EspecialistaInicioPage`, CSS, `RoleProjectNavigation`, `AppLayout`, helper de atención compartido, helper/rutas/contrato de Inicio, helper Jefatura acotado, pruebas y scripts QA. |
| C · Arquitectura | Snapshot canónico por lotes más hechos operativos y actividad independiente. Recuperación por bloque, sin ceros ficticios ante fallos. |
| D · Sidebar | Inicio, Mis proyectos, Mi trabajo, Solicitudes, Objetivos del mes. Tabla y listas funcionales; Métricas conserva URL. |
| E · KPIs | Activos asignados, acciones de coordinación, hitos próximos 24 h, Express confirmado y cierres auditados del mes/responsable al cierre. |
| F · Atención | 3–5 prioritarios cuando existen; proyecto, autor, proceso, motivo y fecha. Ver todas y apertura al contexto nativo. No relleno DEMO en React. |
| G · Estado | Donut de estados macro activos excluyentes; riesgo es atributo adicional. No se inventa "En revisión" como estado de proyecto. |
| H · Objetivos | Consulta explícita de ausencia del registro habilitado; sin targets, edición o cumplimiento inventados. |
| I · Vencimientos | Work items abiertos no entregados, feedback de capítulos y respuesta de versiones. DATE y timestamp conservan precisión; día de Caracas para ordenar. |
| J · Actividad | Últimos 30 eventos propios, preview 4, actor/fecha/texto humano, lista completa de consulta. No determina el estado actual. |
| K · Solicitudes | Work items operativos y Decisiones abiertas con destino/estado/fecha; campana separada. |
| L · Proyectos | Preview y tabla filtrable/paginada, título definitivo, autores, servicio/subtipo, macroestado/riesgo, procesos paralelos, objetivo y margen. |
| M · Carga | Suma de pesos nativos; pausados/stand-by incluidos. Sin multiplicador Express o máximo/porcentaje inventado. |
| N · Datos | Sesión, asignaciones vigentes, proyectos, servicios, autores, pausas, capítulos, intervenciones/versiones y audit logs. |
| O · Omitidos | Comparación mensual no acreditada, porcentaje de capacidad, timer 24 h sin intervención, solvencia por cuotas y objetivos sin modelo. |
| P · Backend | Dos endpoints de lectura; 15 SQL para cartera y hechos con consulta fija, 1 de actividad. Sin GET Ficha por proyecto. |
| Q · RBAC/IDOR | Auth+rol, ámbito en SQL por sesión, selector ajeno ignorado, historial propio y precedencia de assignment verificados. |
| R · Nuevos tests | 19: 0/1/15, identidad, estados/carga, Express, espera de autor, capítulos, fechas, cierres, historia, fallo parcial, coherencia con CC y ausencia de N+1. |
| S · Total | Ver validación final. |
| T · Compilación | Ver validación final. |
| U · Primera captura | `especialista-inicio/desktop-inicial.png`, mismo usuario de comparación final. |
| V · Problemas | Cuenta fuera del header, card mensual alta, texto pequeño, mezcla de orden UTC/día, chips repetidos. |
| W · Ajustes | Cuenta estática en header, copy breve, tipografía más legible, orden local conservando precisión, agrupación de chips. |
| X · Desktop final | 1440×900; captura de comparación y de cartera 15. Acciones arriba, 5 KPIs, contexto y preview de proyectos. |
| Y · Tablet | 768×1024, navegación móvil visible y sin desborde. |
| Z · Móvil | 375×812, prioridad atención → vencimientos → solicitudes → actividad → proyectos; tabla con scroll interno. |
| AA · Brechas | Objetivos sin registro/owner definido; no importación de hojas mensuales, cierres legacy sin evento explícitamente identificados. |
| AB · Git | Revisión de diff y manifiesto de código congelado comprobado antes de commit. |
| AC · Commit | Entrega junto al Command Center y cambios anteriores completos; véase validación final. |

## Validación final

Estado de cierre: **regresión integral y compilaciones en ejecución**. No se afirma aún aprobación integral.

- Dirigidas: **37/37** (19 Inicio + 18 Command Center).
- Navegador: **39/39 Inicio** y **43/43 Command Center**, cero errores JavaScript; DB aislada, login real y tres viewports.
- Código congelado: 545 archivos; SHA256 de manifiesto `af2a6f2c9fed4295cc6e2231dc1d9421adbb01ef34b622ac168803bad1637efb`.
- Resultados: `docs/evidencias/especialista-inicio/regresion/`, capturas y JSON de navegador en ambas carpetas de evidencia.
- Regresión previa provisional: 1150/1152, luego 18/18 focalizadas. Se conserva para trazabilidad y no sustituye la ejecución integral final.

## Brechas conocidas y alcance

El manual no identifica al creador/propietario de metas mensuales. No hay tabla de objetivos ni fecha canónica de cumplimiento de ese compromiso, así que no se construye una escritura especulativa. Los cierres auditados se consultan como hechos, separados de cumplimiento de metas.

La referencia CR Tripa 150 días del manual contradice el plazo nativo provisional de 90. SE conserva referencia comercial 90 e interna 60. La entrega no sustituye estos valores ni importa excepciones manuales de filas de Excel. Los distintos plazos de Calidad de los anexos permanecen referencias diferenciadas; no se convierten en un único SLA nuevo.

La confirmación formal de Cobranzas y el timer de primer contacto no están modelados como estados/intervenciones nativas. No se deduce solvencia de abonos ni se crea un reloj de contacto aislado. La publicación final conserva gates existentes; Amazon paralelo no libera el paquete.

Los documentos originales se mantuvieron locales y fuera de Git. La QA usa bases/cuentas/contraseñas temporales independientes; la cuenta local de Especialista conserva la clave que pidió el usuario y no se incorpora a código o evidencia.
