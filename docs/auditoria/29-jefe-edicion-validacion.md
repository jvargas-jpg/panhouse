# Validación y reporte · Jefe de Edición

Fecha: 23 de octubre de 2026. Implementación real en Panhouse. El entorno visual de prueba usa exclusivamente la base local desechable `panhouse_edicion_preview`; no se modificaron credenciales ni filas de desarrollo.

## Reporte solicitado

| Ref. | Resultado |
| --- | --- |
| A | `jefe_edicion` ya existía en PostgreSQL, RBAC, sesiones y branching de Home; no se duplicó el rol. |
| B | Encontrados Jefe Edición Demo (`jefeedicion.demo@panhouse.test`) y Editor Demo (`editor.demo@panhouse.test`), activos. |
| C | Matriz encontrada: `fuentes-negocio/Editores Matriz Proyectos - Panhouse (1).xlsx`; cuatro hojas leídas. |
| D | Autor/ficha/colección/servicio, asignación, responsables, fases C1–C6/partes/tripa, páginas, inicio/entrega, feedback, estatus, descripción, causa de retraso, GAP y ejecución. Mapeo detallado en arquitectura 29. |
| E | Solicitar → asignar por Jefe → Editor trabaja capítulo → entrega → Especialista coordina autor → feedback → Editor aplica. Se reutilizó el dominio existente. |
| F | SLA normal existente: tres días hábiles desde inicio registrado, sin feriados configurados. Regla central en `edicionSla.ts`. |
| G | Espera del autor y del Especialista fuera de vencidas/riesgo/carga accionable del Editor. Feedback reabre trabajo sin reutilizar su deadline antiguo. |
| H | Request nativa de Editor = work item de Edición y `EDITOR_SOLICITADO`; resolución por historial de asignación posterior. No se creó una segunda entidad. |
| I | `project_assignments` + `asignarConHistorial`; puntero de proyecto sincronizado y motivo de reasignación conservado. |
| J | `/api/editores/inicio`: dos lecturas por lotes; actividad independiente. Fuentes PostgreSQL, sin Drive al renderizar. |
| K | Por asignar sólo cuenta pedidos explícitos no resueltos, con intervención vigente y sin Editor actual. |
| L | Vencidas = fecha exigible anterior al día Caracas e intervención accionable del Editor; excluye esperas. |
| M | En riesgo = entrega exigible hoy, regla central objetiva y documentada; sin umbral de tres días en React. |
| N | Solicitudes = pendientes nativas dirigidas al Jefe; actualmente sólo existe solicitud de asignación de Editor. |
| O | Equipo activo y métricas de intervenciones, no pesos de proyectos ni porcentajes de capacidad. Prueba con dos y catorce Editores: mismas dos consultas. |
| P | Cada intervención se cuenta una vez; el contenedor inicial no duplica capítulos/instancias específicas. Distribución de trabajo, no progreso global. |
| Q | Máximo seis entregas accionables no vencidas, fecha ascendente. “Ver todas” abre Seguimiento filtrado. |
| R | Atención: asignación, vencidas, riesgo de hoy, bloqueos y feedback accionable. Esperar al autor no genera alarma. |
| S | Cuatro solicitudes pendientes en Inicio; revisión reutiliza el drawer de decisión. La bandeja tiene filtro y paginación. |
| T | Actividad desde `audit_logs`, lista permitida de eventos de Edición. No contiene pagos ni cambios de otras áreas. |
| U | Sidebar navy, acento gold y seis destinos funcionales del área. |
| V | Área de Edición / Inicio / subtítulo; fecha real Caracas, shell de cuenta y notificaciones reutilizados. Sin buscador global ni selector de mes ficticios. |
| W | Cuatro KPI: Por asignar, Entregas vencidas, En riesgo, Solicitudes pendientes. |
| X | Carga por Editor: activas, vencen esta semana, vencidas; drawer añade esperas, fechas y últimas entregas. |
| Y | Donut contextual de intervenciones con leyenda y descripción accesible. |
| Z | Tabla densa con proyecto/autor, intervención, servicio canónico, situación, Editor, fecha y CTA específico. En móvil son tarjetas. |
| AA | Rail derecho con próximas entregas y actividad. Sin calendario inexistente ni portadas de demostración. |
| AB | Solicitudes recientes visibles en el ancho principal. Vacío real después de asignar. |
| AC | “Historias que conectan.” es pie institucional: sin ruta, icono ni estado activo. |
| AD | Un único `AsignarEditorCard`/decision drawer para Inicio, Asignaciones y Solicitudes; no navega a Ficha para asignar. |
| AE | Bloqueo de proyecto, historial, puntero, work item, auditoría y avisos transaccionales. Retry idéntico no duplica; decisión obsoleta distinta se rechaza. Fallo de notificación revierte la operación completa. |
| AF | Guards reales: sólo Jefe supervisa/asigna; sólo Editor registra entregas propias; el Especialista coordina el lado autor. Sin capacidades nuevas de administración global. |
| AG | UUID de otro dominio, usuario no Editor/inactivo y trabajo de otro Editor rechazados; propiedad revalidada bajo bloqueo al escribir. |
| AH | Sin N+1 ni lecturas externas: dos queries del dashboard y una de actividad. DTO acotado; filtros y paginación en servidor. Agrupaciones finales operativas en Node, CTE de fuentes y joins en PostgreSQL. |
| AI | Nueve pruebas backend nuevas y siete frontend: 16 nuevas. Cubren lifecycle, esperas, distribución, concurrencia, rollback, historial/FK, RBAC/IDOR, query count, cuatro KPI, vacíos, skeleton y error parcial. |
| AJ | Suite completa: 83 archivos y 1.537 pruebas, todos aprobados. |
| AK | Regresión completa esperada hasta resultado final; log local `editorial-final-regression.log`. Cierre enfocado adicional de Chief/Command Center/UI: 34 pruebas aprobadas; comprobación posterior de dominio/Command Center: 27 aprobadas. |
| AL | Typecheck backend/frontend y build backend/frontend ejecutados hasta finalizar. Sin errores. Vite conserva el aviso de tamaño de chunks del proyecto. |
| AM | Flujo de navegador ejecutado con cuentas aisladas de Jefe, Editor y Especialista: asignación → creación/inicio de capítulo → entrega → envío al autor → respuesta → aplicación de feedback. Reasignación con motivo probada en otra intervención esperando autor. Verificación posterior de PostgreSQL en `flujo-verificado.json`. |
| AN | Captura inicial 1440 × 900 y comparación directa con la imagen solicitada. |
| AO | Se subió la actividad al rail, se aumentó la tipografía de tabla y se corrigió el corte de palabras de CTA. Se conservó la marca real del proyecto. |
| AP | `desktop-final.png`: sidebar, header, cuatro KPI, carga, estado, atención, entregas, actividad y cabecera de solicitudes visibles a 1440 × 900. |
| AQ | 768 × 1024: KPI 2 × 2, paneles inferiores y ancho del documento igual al viewport. |
| AR | 375 × 812: sin scroll horizontal; atención, entregas, carga, solicitudes, estado y actividad en ese orden; menú móvil operativo. |
| AS | No se inventaron capacidad máxima, SLA de feedback, feriados, tipos de requests de apoyo/reasignación, división automática de tripas ni históricos de Indicadores. Pausas parciales/reprogramación conservan las reglas previas del proyecto; esta fase no añade otro calendario. Detalle de cobertura en arquitectura 29. |
| AT | Arquitectura 29 creada; matriz de capacidades actualizada; evidencia funcional/visual en `docs/evidencias/jefe-edicion`. |
| AU | Diff revisado con `git diff`, `git diff --check` y estadística del conjunto preparado para commit: 46 archivos, 927 inserciones y 341 eliminaciones. El commit de entrega conserva la estadística completa en `git show --stat`. |
| AV | Árbol inicial limpio; revisión final de `git status` después del commit. Logs locales y fuentes internas siguen ignorados. |
| AW | Commit local solicitado; hash exacto informado en la entrega. No se hizo push remoto. |

## Evidencia

- [Escritorio inicial](../evidencias/jefe-edicion/desktop-inicial.png)
- [Escritorio final](../evidencias/jefe-edicion/desktop-final.png)
- [Decisión de asignación](../evidencias/jefe-edicion/drawer-asignacion.png)
- [Entrega del Editor](../evidencias/jefe-edicion/editor-entrega.png)
- [Feedback aplicado](../evidencias/jefe-edicion/editor-feedback-aplicado.png)
- [Espera del autor sin atraso del Editor](../evidencias/jefe-edicion/esperando-autor.png)
- [Tablet](../evidencias/jefe-edicion/tablet-768.png) y [mediciones responsive](../evidencias/jefe-edicion/responsive.json)
- [Móvil](../evidencias/jefe-edicion/mobile-375.png)
- [Paneles inferiores en móvil](../evidencias/jefe-edicion/mobile-inferior.png)
- [Menú móvil](../evidencias/jefe-edicion/mobile-navegacion.png)
- [Verificación del flujo, eventos y asignaciones](../evidencias/jefe-edicion/flujo-verificado.json)

Para reproducir la UI aislada: `npx tsx scripts/editorial-preview.ts` y Vite en 5176 con `VITE_API_PROXY_TARGET=http://127.0.0.1:3006`. Las cuentas de prueba y su clave sólo pertenecen a esa base de QA. `npx tsx scripts/editorial-verify.ts` comprueba en modo lectura el flujo después de ejecutarlo desde la interfaz.

## Correcciones de regresión

La primera corrida completa detectó tres fallos: dos fixtures de Indicadores Creativos tenían un corte fijo anterior a las entregas creadas durante la prueba; ahora usan el día Caracas del escenario. La evaluación de objetivos podía correr unos milisegundos antes del timestamp persistido por PostgreSQL; la creación de work item evalúa al menos en el instante de su evento. También se completó el campo `nota` faltante en fixtures frontend preexistentes. No se modificaron las reglas de Indicadores para acomodar las pruebas.

El cierre de compilación detectó y permitió corregir un bloque agregado fuera de su scope en Command Center. La prueba de reasignación comprueba ahora tanto la etiqueta de la intervención como el estado agregado **Esperando autor**, sin vencimiento ni deadline atribuido al Editor.
