# Soporte Digital · Mi trabajo · continuación

Fecha: 28 de octubre de 2026. Alcance: únicamente la pantalla `/?vista=mi-trabajo` del rol `soporte_digital` y sus servicios de lectura/escritura. No se rediseñaron otras pantallas ni se modificaron credenciales o datos de desarrollo.

La implementación utiliza los hitos existentes. La especificación completa incluye procesos que el dominio todavía no define: rechazo de pruebas, solicitudes digitales, revisión externa, publicación formal y Author Central. Esas operaciones no se simulan. La aceptación visual tampoco está cerrada: Computer Use detuvo la inspección porque no pudo determinar con suficiente confianza la URL de Chrome. Las imágenes que ya existían en `docs/evidencias/soporte-digital-mi-trabajo` pertenecen a una ejecución anterior y no prueban esta continuación.

| Punto requerido | Resultado y evidencia |
| --- | --- |
| A. Estado previo | El commit `43e6662` ya contenía Inicio y Mi trabajo. Mi trabajo tenía lista/detalle, búsqueda, filtro por proyecto y acciones mediante escrituras genéricas por proyecto. Paginaba en memoria; no revalidaba la revisión de la tarea al escribir. |
| B. Rutas/componentes | `frontend/src/soporteDigital/SoporteDigitalMiTrabajo.tsx`, `soporteDigitalWorkApi.ts`, `server/routes/soporteDigitalWork.routes.ts`, helpers `soporteDigitalWork`, `soporteDigitalActions`, `soporteDigitalDrive`; ruta de interfaz `/?vista=mi-trabajo&workItem=<uuid>`. |
| C. Rol | `soporte_digital`, validado en servidor mediante sesión y rol. El dominio retiró la asignación individual `digitalId`: la bandeja es compartida por rol. No se inventó un dueño individual. |
| D. Tipos reales | `work_items.tipo='soporte_digital'`. Activación explícita con `business_key='activacion_amazon'`; compatibilidad con `default`. Otros work items conservan su fila y nombre de paso, pero no heredan escrituras de activación/carga si no hay una operación definida para ellos. |
| E. Etapas | Proyecciones existentes: `preparation`, `testing`, `loaded`, `completed`. No se añadieron estados de workflow para construir tabs. |
| F. Estados | Persistidos: pendiente, en progreso, bloqueado, completado, cancelado. Se conservó que completar el work item de activación no completa todo el control digital. Filtros operativos derivados: pendiente, en curso, bloqueo, espera de material, pausa y cierre interno. |
| G. Waiting | Cuenta activada sin paquete final: espera de Diseño/Calidad, sin vencimiento accionable. No existe un estado de espera de Amazon confirmado por el modelo. |
| H. Activación | `habilitarActivacionAmazon` crea idempotentemente la tarea al habilitar la primera validación, en paralelo a Calidad. Formulario y activación se registran antes del paquete final. |
| I. Paquete final | Declaración real `ficha_documental_datos.seccion='diseno'`, campos `paqueteFinalCargado`, `paqueteFinalEntrega`, `paqueteFinalArchivos`. La existencia de archivos o de una carpeta no reemplaza este hito. |
| J. Gates | El endpoint operativo revalida pausa/cierre/retiro, bloqueo de work item, activación, paquete final y prueba previa bajo lock. No se encontró un gate independiente confirmado de cierre de Calidad para esta operación; no se inventó. |
| K. Solvencia | Respeta `gate_bloqueante`; si identifica una condición financiera, muestra únicamente «Bloqueado por solvencia». No consulta ni devuelve montos. No se creó un nuevo motor financiero. |
| L. Amazon | No se encontró OAuth/API/SDK/webhook/polling/scraping/automatización de KDP. Los eventos son registros manuales del equipo. |
| M. Publicación | Existen fechas de prueba/carga y un control digital interno. `digitalEstatus='Completado'` no prueba que el libro se haya publicado. No hay registro formal de publicación Amazon en este modelo. |
| N. Row DTO | `DigitalWorkRow`: workItemId, projectId, título, autores, código, portada real/placeholder, etapa, tarea, deadline, deadlineState, estado, bloqueo, accionabilidad, paquete y última actividad. Ninguna fila contiene archivos de Drive ni historial completo. |
| O. Detail DTO | `DigitalWorkDetail`: resumen, revisión de concurrencia, inicio, permisos de inicio/edición, cargas vigentes por formato, Especialista, fechas de formulario/activación, catálogo real, dependencia y eventos. Se carga al seleccionar la tarea. Cuenta Amazon siempre protegida. |
| P. Tabs | Todas, En preparación, Para pruebas KDP, Cargas registradas, Digital completado. Se mantuvieron etiquetas consistentes con el dominio y con Inicio. |
| Q. Counts | Agregados SQL del conjunto filtrado completo, antes de paginar. No se cuentan únicamente las filas visibles. |
| R. Search | Debounce de 300 ms y búsqueda en servidor por título, autores, código, tarea y etiqueta de etapa. Se usa búsqueda literal, sin tratar `%` o `_` como comodines. |
| S. Filters | Estado, etapa, vencimiento accionable, proyecto y bloqueo. La espera de material no se considera vencida. Valores validados por Zod. |
| T. Pagination | `LIMIT/OFFSET` en PostgreSQL, tamaños 10/25/50, total completo y ajuste de páginas fuera del rango. Materiales utiliza paginación de Drive con «Ver más archivos». |
| U. Sorting | Prioridad operativa, deadline o actualización reciente. Empates estables por título e id. Orden reciente contempla cambios de work item, ficha y documentos. |
| V. Selected row | Selección por workItemId, resaltado suave, teclado Enter/Espacio, cierre del panel y estado en URL. Seleccionar no escribe ni inicia la tarea. |
| W. Detalle | Proyecto, autor, etapa y tarea separadas, fecha límite, estado, Especialista, creación/inicio y siguiente acción o dependencia real. Sin Jefe de Edición ni checklist universal. |
| X. Materiales | Consulta diferida de archivos de KDP; error recuperable, carpeta vacía, paginación y enlace a esa carpeta concreta. Preparación no simula formularios en Drive si no hay asociaciones documentales. |
| Y. FolderKeys | Únicamente `FINAL_PACKAGE_KDP`, resuelto por workspace/folder persistidos en estado READY. No se buscan nombres ni se provisionan carpetas desde la pantalla. |
| Z. Amazon/KDP | Datos manuales del catálogo, agrupados por formulario/cuenta, criterios, pruebas/carga e inducción. Edición de campos existentes validada en backend. Texto que distingue carga de publicación. |
| AA. Campos implementados | Formulario enviado, activación, inicio real, prueba de archivos, fechas KDP/Kindle, estatus/entrega del control y los campos reales del catálogo: recepción, creación de cuenta, observaciones, reunión/grabación de criterios, tapa, portada, papel, precios acordados, lanzamiento acordado, inducción/grabación. |
| AB. No inventados | Sin contraseñas, 2FA, recovery codes, ASIN, territorios, categorías, DRM, royalties, sync, fecha formal de publicación ni estados automáticos de Amazon. `lanzamientoAmazon` es una fecha acordada del catálogo, no una confirmación de publicación. |
| AC. Próximos pasos | Se muestra una acción derivada de hitos reales, más la posibilidad de registrar la carga del formato pendiente. Sin listas universales ni porcentajes ficticios. |
| AD. Start task | Inicio explícito: `fechaInicioReal`, estado `en_progreso`, actor y audit en una transacción. La lectura mantiene la tarea intacta. |
| AE. Test result | Se registra la fecha de la prueba de archivos que existe en el catálogo; requiere activación y paquete final. No se inventó un enum de aprobación/rechazo. |
| AF. Error flow | Un bloqueo ya registrado impide operar. El modelo actual no define resultado fallido de KDP ni circuito digital de devolución. No se creó un ticket genérico ni se reutilizó el circuito exclusivo de Editor. Pendiente de definición de dominio. |
| AG. Nueva versión | Los registros nuevos de prueba/carga guardan la huella del manifiesto documental del paquete. Un cambio declarado del paquete vuelve a requerir prueba/carga y conserva fechas/huellas anteriores en audit. Esto no detecta modificaciones directas en Drive que no actualicen el manifiesto, ni inventa una versión verificable para fechas legacy sin procedencia. |
| AH. Upload registration | Registro manual de KDP y/o Kindle, atómico, con gates, revisión y audit. Se puede registrar Kindle después de KDP. No se sobrescribe una carga del mismo manifiesto mediante la acción operativa. |
| AI. External review | No modelada; no se simula espera, recepción automática ni rechazo de Amazon. |
| AJ. Publication registration | No modelada formalmente; no se añadió un botón «Publicar» ni un estado publicado derivado de una fecha de carga. |
| AK. Closure | Cierre explícito del control interno después de una carga vigente. Una nueva lectura de un control completado no vuelve a ofrecer la prueba. No equivale a publicación ni crea tareas Author Central inexistentes. |
| AL. Blocker/request | Bloqueos existentes de proceso se respetan y se presentan sin detalles financieros. No existe lifecycle de solicitud digital confirmado; no se implementó Mis solicitudes ni se modificaron gates manualmente. |
| AM. Audit | Inicio, datos, formulario, activación, pruebas, cargas y cierre registran actor, work item, proyecto, acción, fecha, requestId y huella de operación; pruebas/cargas nuevas incluyen procedencia del manifiesto. Eventos dentro de la misma transacción. No se auditan tabs, búsqueda o vistas. |
| AN. Notifications | Notificación al Especialista vigente al registrar activación o cierre interno, con enlace al proyecto. El reintento idempotente no vuelve a notificar. No se generan notificaciones para cada edición menor. |
| AO. TanStack invalidation | Tras mutaciones se invalidan lista/detalle/materiales de Mi trabajo y el Inicio digital. Sin `window.location.reload()`. Las cargas de materiales y los errores del detalle son independientes de la lista. |
| AP. Idempotency | requestId UUID, huella del payload y consulta de audit bajo lock de proyecto. Reintentos idénticos responden sin repetir eventos; reutilización del identificador con otros datos devuelve 409. Bloqueo inmediato del submit en frontend. |
| AQ. Concurrency | Lock de proyecto/work item y relectura de estado/gates. Revisión normalizada entre pg y Drizzle, con huellas del catálogo/manifiesto. Una operación obsoleta devuelve 409. No hay reasignación individual digital en el dominio para simular esa carrera. |
| AR. RBAC | Sesión y rol requeridos para lista, detalle, materiales y acciones. Las acciones no reciben projectId arbitrario y los datos del catálogo deben pertenecer a digital. |
| AS. IDOR | Se rechazan work items de otra área, cancelados, retirados e inexistentes. Dos usuarios digitales pueden consultar la misma tarea porque la bandeja es compartida. Se probaron roles ajenos y falta de sesión. |
| AT. Drive security | El servidor comprueba tipo/estado del work item, proyecto, declaración del paquete, workspace READY, folderKey y conexión/integration/storageContext. La consulta limita el parentFolderId a KDP; no expone raíz de Drive ni incorpora un endpoint de archivos arbitrarios. |
| AU. Performance | Conteos/opciones, página SQL y actividad en lote: dos o tres consultas para la lista, independientemente del número de tareas. Sin descargar el conjunto completo al proceso Node para paginar. |
| AV. N+1 | Sin consulta por fila a proyecto, autor, Especialista, historial o Drive. Las pruebas de procedencia se agregan en SQL; el detalle se consulta únicamente para la selección. No se realizó un benchmark de volumen de producción. |
| AW. Tests | Ver sección de validación al final. Se añadieron pruebas de flujo real, payloads, gates, idempotencia concurrente, races, IDOR, varios work items, filtros/paginación y versiones declaradas. Las pruebas de interfaz renderizan React con cache; no reemplazan QA de navegador. |
| AX. Typecheck | Ver sección de validación al final. |
| AY. Builds | Ver sección de validación al final. |
| AZ. QA 1440 | Pendiente: no se obtuvo una captura nueva. Computer Use bloqueó la inspección por no poder determinar la URL de Chrome. |
| BA. QA 768 | Pendiente por el mismo bloqueo. Se conservaron los patrones de drawer existentes y se limitaron los cambios CSS a `.sd-work`. |
| BB. QA 375 | Pendiente por el mismo bloqueo. El CSS define tarjetas sin tabla horizontal y detalle móvil, pero no se declara validación visual completada. |
| BC. Correcciones visuales | Etapa/tarea separadas, columnas adaptadas a la densidad, lista/detalle con proporción aproximada 62/38, tabs compactas, controles y portada neutral/real. Son ajustes de código; no correcciones verificadas contra capturas nuevas. Shell y logo oficial se reutilizan. |
| BD. Archivos tocados | Ver inventario al final. El script de reset de contraseña preexistente permanece intacto. |
| BE. git diff --stat | Ver inventario al final; no se creó commit. |
| BF. git status | Ver inventario al final; no se revirtió trabajo previo del usuario. |

## Límites que requieren una siguiente definición

El dominio guarda las fechas digitales en la ficha/documento del proyecto, no en un registro completo de ejecución por cada work item. La lista conserva work items independientes y no fusiona filas; no se fabricaron ejecutores para tipos/pasos sin operación definida. Los registros antiguos de prueba/carga carecen de procedencia del manifiesto.

Las rutas genéricas históricas de ficha y documental no fueron reemplazadas en esta iteración. Las garantías de revisión, idempotencia y gates descritas arriba corresponden al nuevo endpoint operativo de Mi trabajo. Una revisión global de esas escrituras históricas pertenece a un cambio aparte y no se presenta aquí como resuelta.

## Validación

Comprobaciones sobre la base aislada de tests (`NODE_ENV=test`, base con sufijo `_test`). No se sembraron ni modificaron proyectos de desarrollo.

- Typecheck backend: `npm run typecheck`, aprobado, código de salida 0.
- Typecheck frontend: `npm run typecheck` desde `frontend`, aprobado, código de salida 0.
- Build backend: `npm run build`, aprobado, código de salida 0.
- Build frontend: `npm run build` desde `frontend`, aprobado también después del último ajuste, código de salida 0. Vite mostró un aviso de chunks superiores a 500 kB; no hubo error de compilación y no se amplió esta iteración a reorganizar el empaquetado global.
- Suite digital de cuatro archivos: 70 escenarios. En la ejecución principal pasaron 68; dos hooks de preparación fallaron por un timeout durante una interrupción prolongada del entorno y `ECONNRESET` al limpiar PostgreSQL. Esos dos casos se repitieron de forma aislada y ambos pasaron (salida 0). No se ocultaron mediante cambios de configuración ni se modificó el esquema de tests.
- Los 27 escenarios backend de Mi trabajo incluyen flujo de preparación/prueba/carga/cierre, carga posterior de Kindle, cambio de manifiesto, solicitudes duplicadas simultáneas, bloqueo/cancelación concurrentes, roles, IDOR, dependencia documental, filtros y paginación. Los otros archivos cubren 16 escenarios backend de Inicio, 16 de interfaz de Mi trabajo y 11 de interfaz de Inicio.
- Después del último ajuste que oculta la carga adicional para tareas no accionables, se repitió `soporteDigitalMiTrabajo.test.tsx`: 16/16 aprobados, salida 0.
- El comando de la ejecución principal fue `npm test -- tests/soporteDigitalWork.test.ts tests/soporteDigitalHome.test.ts frontend/src/soporteDigital/soporteDigitalMiTrabajo.test.tsx frontend/src/soporteDigital/soporteDigitalHome.test.tsx --hookTimeout=120000 --testTimeout=120000 --reporter=dot`. Los dos casos afectados por el entorno se verificaron con `npm test -- tests/soporteDigitalWork.test.ts -t 'filtra por etapa|filtra por proyecto' --hookTimeout=120000 --testTimeout=120000 --reporter=dot`.
- Las ejecuciones intermedias detectaron una diferencia de representación de timestamps entre pg y Drizzle que rechazaba operaciones válidas. Se corrigió normalizando la revisión y todos los escenarios operativos nuevos pasaron después de esa corrección.
- La API y el frontend locales ya estaban levantados. El intento de acceso con la credencial demo histórica devolvió 401; no se cambió la contraseña ni se ejecutó el script de reset existente. El login y las operaciones por rol sí se verificaron en la base aislada mediante `app.inject`.
- QA de navegador y nuevas capturas 1440×900, 768×1024 y 375×812: pendientes. No se presentan las capturas antiguas como evidencia actual. El cambio no se declara visualmente terminado.

## Inventario final

`git diff --check`: sin errores de espacios al momento de la revisión.

`git diff --stat` (archivos previamente versionados): 11 archivos, 517 inserciones y 107 eliminaciones. Se agregaron además `server/helpers/soporteDigitalActions.ts` y este informe, aún sin seguimiento. Git no incluye esos dos archivos nuevos en `git diff --stat` hasta agregarlos al índice; no se modificó el índice.

Archivos modificados:

- `frontend/src/soporteDigital/SoporteDigitalMiTrabajo.tsx`
- `frontend/src/soporteDigital/soporteDigitalMiTrabajo.css`
- `frontend/src/soporteDigital/soporteDigitalMiTrabajo.test.tsx`
- `frontend/src/soporteDigital/soporteDigitalWorkApi.ts`
- `server/helpers/auditLog.ts`
- `server/helpers/soporteDigitalDrive.ts`
- `server/helpers/soporteDigitalHome.ts`
- `server/helpers/soporteDigitalWork.ts`
- `server/routes/soporteDigitalWork.routes.ts`
- `shared/soporteDigitalWork.ts`
- `tests/soporteDigitalWork.test.ts`

Nuevos: `server/helpers/soporteDigitalActions.ts` y `docs/reportes/soporte-digital-mi-trabajo-continuacion.md`.

`git status --short` mantiene esos 11 archivos como modificados y los dos nuevos como no rastreados. También muestra `?? scripts/reset-soporte-digital-password.ts`: era el único cambio preexistente, se dejó intacto y no se ejecutó. Rama `main`, sin commits creados en esta continuación. No se editaron `.env` ni los archivos de Docker Compose.
