# Entrega · Objetivos mensuales

Fecha: 16 de octubre de 2026. Rama: `main`. Base limpia: `05f69f8`.

Se implementó planificación mensual compartida para Especialista y Jefatura, con origen explícito, resultados automáticos verificables, ownership, auditoría, notificaciones y consulta histórica. La referencia visual define composición y jerarquía; sus nombres, proyectos, portadas y métricas no se incorporaron al producto.

## Reporte solicitado A–AS

| Punto | Resultado |
|---|---|
| A · Estado anterior | Sidebar de Especialista apuntaba a un placeholder; no había entidad ni API de objetivos. Árbol Git limpio antes de trabajar. |
| B · Infraestructura | Fastify, Drizzle/PostgreSQL, React Query/Router, shell CRM y navegación por rol. Se reutilizan `project_assignments`, `work_items`, eventos de cierre de proyecto, `audit_logs`, campana y notificaciones dirigidas. Riesgo, pausas, servicio y Express leen los helpers canónicos. |
| C · Modelo final | Una tabla `monthly_goals`, 24 columnas, FK a destinatario/creador/proyecto/hito, periodo numérico, origen, meta, fecha, tipo, referencias, estado base, evidencia, resultado, cancelación e idempotencia. Tres índices y checks de integridad. |
| D · Migración | `0081_needy_ultron.sql` generada por Drizzle, snapshot y journal incluidos. Aditiva, aplicada en desarrollo local y bases de pruebas. No borra ni importa objetivos de Excel. |
| E · Origen | `JEFATURA` / `ESPECIALISTA` persistidos; sesión impone creador y origen. No se infieren del rol histórico ni se admiten en body. |
| F · Tipos | GENERAL, CIERRE_PROYECTO, ALCANZAR_PROCESO, ALCANZAR_HITO. Catálogo servido por API; procesos corresponden a tipos operativos existentes. |
| G · Periodo | Año y mes numéricos, clave de consulta `YYYY-MM`; calendario de Caracas y navegación mensual. Periodo del objetivo inmutable. |
| H · Proyecto | FK opcional; la asignación canónica actual se valida también en servidor. Hitos se verifican contra ese mismo proyecto. Objetivos no modifican plazos contractuales, gates ni workflows. |
| I · Especialista | Lee sus compromisos; crea/ajusta/cancela únicamente los propios. No cambia objetivos de Jefatura ni metas de otras personas. |
| J · Jefatura | Ve Especialistas y sus objetivos; asigna/ajusta/cancela el origen JEFATURA. Los propios del Especialista son de consulta. Ámbito actual global, igual a la infraestructura existente. |
| K · UI Especialista | Header, mes, seis KPIs, tabs, lista compacta, dos badges de origen, fecha, contexto, riesgo, resultado y CTA real al Command Center. Sidebar y footer conservados. Inicio consume el resumen del mismo dominio. |
| L · UI Jefatura | Subvista `/?vista=seguimiento&subvista=objetivos`, accesible por sidebar y navegación de Seguimiento. Mantiene las seis entradas principales. |
| M · Resumen del equipo | Personas activas reales, incluso con cero metas, en orden alfabético. Total/asignados/propios/en curso/en riesgo/completados, sin puntuación ni ranking. |
| N · Detalle | Selección contextual, consulta diferida del Especialista, filtros por origen/estado y detalle amplio. En móvil ocupa la pantalla completa. |
| O · Asignación | Primero se elige Especialista; formulario contextual sin repetir selector de persona. Proyectos exclusivamente asignados a ese destinatario; admite meta general. |
| P · Meta propia | «Nuevo objetivo», formulario compacto, origen propio impuesto por sesión. Edición/cancelación solo cuando `canEdit` es verdadero y backend lo autoriza. |
| Q · Cumplimiento | Cierre por evento auditado y responsable del cierre; proceso por apertura de work item; hito por finalización de la instancia concreta. Guarda fecha/evidencia y audita una vez. Reapertura posterior no borra el resultado. |
| R · Riesgo | Derivado en dominio: fecha excedida, bloqueo, pausa/stand-by, retraso y riesgo operativo central. En curso y en riesgo son excluyentes. No hay porcentaje ni selector manual de riesgo. |
| S · Reasignación | Evalúa primero resultados acreditados; cancela metas todavía activas del responsable anterior con motivo «Proyecto reasignado». Conserva historial y no las transfiere. Cubre asignación central y edición/retirada de equipo. |
| T · Historia mensual | Meses anteriores son read-only; al terminar el periodo las metas no alcanzadas pasan a NO_CUMPLIDO. Un hecho del mes siguiente no rescata el periodo anterior. Resultados/contexto terminales se conservan. |
| U · Auditoría | Creación, ajustes con diff y motivo, cumplimiento, periodo terminado, cancelación y reasignación. Reutiliza `audit_logs` y se integra al timeline del proyecto. La evaluación aplica control de versión para no acreditar una meta editada concurrentemente. |
| V · Notificaciones | Asignación/ajuste/cancelación de Jefatura notifican a la persona destinataria dentro de la misma transacción. Reintentos y lecturas no duplican avisos. |
| W · RBAC | Guardias de sesión y rol en todos los endpoints. Matriz de capacidades actualizada. Los demás roles no acceden a este módulo. |
| X · IDOR | Validación en listado, catálogo, lectura por ID, historial, edición y cancelación. Un ID ajeno devuelve 404; solicitudes de otro destinatario/proyecto se rechazan con 403. |
| Y · Rendimiento | Lecturas acotadas al periodo; relaciones agrupadas por lotes y paginación en servidor. Medición real QA: 8 SELECT para un proyecto, 8 para múltiples y 8 para resumen de equipo. Prueba adicional conserva conteo al pasar de 1 a 12 Especialistas. |
| Z · Tests nuevos | 45 tests de dominio/API/seguridad/integridad/concurrencia en `tests/monthlyGoals.test.ts`. Actualizadas dos expectativas antiguas de «módulo no disponible». |
| AA · Tests totales | 68 archivos, 1312 tests aprobados, cero fallidos y cero omitidos. Incluye los 45 tests nuevos de objetivos. |
| AB · Regresión completa | Dos corridas completas terminadas. Primera: 1309/1309. Final sobre fuentes congeladas: 1312/1312, 68/68 archivos, duración 457,75 s. Ninguna suite queda ejecutándose. |
| AC · Typecheck | Backend y frontend aprobados con `npm run typecheck`. |
| AD · Build backend | `npm run build` aprobado. |
| AE · Build frontend | `npm run build` aprobado. Vite mantiene el aviso de chunks grandes; no impide el build. |
| AF · QA Especialista inicial | Se distinguían ambos orígenes, metas, fechas y contexto; no había porcentaje falso. Se observó recorte de cuenta en móvil. |
| AG · Problemas visuales | Cuenta demasiado ancha en 375 px; detalle de Jefatura demasiado bajo; tabla necesitaba adaptación real en tablet. Las fixtures iniciales además tenían una fecha futura y no incluían ficha para el enlace a Command Center. |
| AH · Correcciones | Cuenta compactada sin recortes; tarjetas/tabla/resumen ajustados; fuentes y tokens globales conservados. Fixtures reparadas únicamente en la base QA aislada. |
| AI · QA Especialista final | Capturas 1440×900, 768×1024 y 375×812 revisadas; formulario móvil a pantalla completa, tabs desplazables, KPI en dos columnas y cards verticales. Funciones de creación/edición/cancelación/historial verificadas en navegador. |
| AJ · QA Jefatura inicial | Tabla y detalle mostraban el mismo dominio y permitían asignación; exceso de espacio antes de la lista y selección móvil poco directa. |
| AK · Correcciones | Tabla/resumen compactados, cards de equipo en tablet/móvil y detalle de Especialista a pantalla completa en móvil, con cierre, Escape y manejo de foco. |
| AL · QA Jefatura final | Capturas desktop/tablet/móvil revisadas. Se verificaron asignación, consulta de propios sin edición y acceso a personas con cero objetivos. |
| AM · Comparación visual | Se conservan navy, off-white, blanco, dorado, badges suaves azules/teal, jerarquía compacta y panel contextual. La imagen no aporta datos al código. Portadas solo reales aprobadas; placeholders editoriales cuando faltan. |
| AN · Tablet | 768×1024, sin tabla comprimida; cards de equipo y formularios adaptados, sin overflow horizontal. |
| AO · Móvil | 375×812, KPI de dos columnas, tabs con scroll, objetivos verticales, formularios completos y detalle Jefatura a pantalla completa. Sin controles recortados en la revisión final. |
| AP · Gaps de negocio | PENDIENTE_VALIDACION_DOCUMENTAL: acreditación manual de metas generales, responsable del cierre formal, catálogo empresarial definitivo, override administrativo de meses pasados y futuras membresías de equipo. No se inventan reglas de aprobación. Importar el Excel histórico exige resolver identidades y evidencia antes de hacer backfill. |
| AQ · Diff | `git diff --cached --stat`: 72 archivos, 8586 inserciones y 25 eliminaciones. Incluye snapshot Drizzle, pruebas, documentación y capturas. `git diff --cached --check` aprobado. |
| AR · Estado Git | Base limpia al iniciar. Solo cambios de esta implementación; estado final limpio después del commit, ver comprobación de entrega. |
| AS · Commit | Commit de entrega: `feat: implement monthly editorial goals for specialists and management`. Se informa su hash en la respuesta final. |

## Verificación final

Las fuentes se congelaron antes de la regresión final; `source-manifest.json` permite verificar sus SHA256. Ninguna fixture QA se agrega a los datos de desarrollo. Se aplicó únicamente la migración de esquema al entorno local de trabajo y se verificó que la API real protege el endpoint con 401 sin sesión.

- Regresión final: 68 archivos aprobados, 1312 tests aprobados, 0 fallidos, 0 omitidos; comando `npm test -- --reporter=default --reporter=json --outputFile=docs/evidencias/objetivos-mensuales/full-regression.json`, exit code 0.
- QA funcional Chromium: 37 comprobaciones aprobadas, cero errores JavaScript.
- Revisión final Chromium: 22 comprobaciones aprobadas, cero errores JavaScript.
- Los errores provocados para probar reintento de lista/resumen son intencionales; ambos bloques se recuperan y conservan el otro bloque válido.
- Fixtures aisladas: `panhouse_goals_qa_20261016`. Sesiones y claves permanecen exclusivamente en archivos temporales, fuera de Git.

El primer recorrido de navegador detectó fixtures incompletas y luego un selector ambiguo del propio script (dos CTA válidas en el estado vacío). Se corrigieron y el recorrido completo posterior terminó aprobado. Los artefactos `inicial` registran ese recorrido funcional repetido y `final` la revisión visual final; los hallazgos de la primera inspección quedan descritos arriba.

## Evidencia

- [Arquitectura y reglas](../arquitectura/24-objetivos-mensuales.md)
- [Regresión completa final](../evidencias/objetivos-mensuales/full-regression.json)
- [QA funcional](../evidencias/objetivos-mensuales/browser-inicial.json)
- [QA visual final](../evidencias/objetivos-mensuales/browser-final.json)
- [Conteo SQL](../evidencias/objetivos-mensuales/query-counts.json)
- [Especialista desktop](../evidencias/objetivos-mensuales/especialista-1440-final.png)
- [Jefatura desktop](../evidencias/objetivos-mensuales/jefatura-1440-final.png)
- [Especialista móvil](../evidencias/objetivos-mensuales/especialista-mobile-final.png)
- [Detalle Jefatura móvil](../evidencias/objetivos-mensuales/jefatura-mobile-final.png)
- [Equipo Jefatura móvil](../evidencias/objetivos-mensuales/jefatura-equipo-mobile-final.png)
- [Formulario Especialista móvil](../evidencias/objetivos-mensuales/especialista-formulario-mobile-final.png)
- [Formulario Jefatura tablet](../evidencias/objetivos-mensuales/jefatura-formulario-tablet-final.png)

No hay suite unitaria frontend instalada. Los flujos de UI se verificaron con Chromium real y Playwright contra Fastify/PostgreSQL aislados, sin sustituir los datos del dominio por mocks; las interceptaciones HTTP solo simulan errores de disponibilidad.
