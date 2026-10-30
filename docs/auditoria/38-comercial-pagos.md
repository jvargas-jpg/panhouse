# Comercial · Pagos — implementación y auditoría

Fecha: 30 de octubre de 2026. Repositorio: Panhouse, rama `main`.

La pantalla `/comercial/pagos` consulta proyectos reales y conserva el shell de Comercial. El modelo canónico sigue siendo `pagos`; no se creó otra tabla de abonos. Los importes contractuales se registran expresamente en el resumen de la ficha comercial. El porcentaje pagado nunca concede solvencia automáticamente.

## Decisiones basadas en la auditoría

El árbol estaba limpio y sincronizado con `origin/main`, HEAD `00e97b7`. Se ejecutaron `git status`, `git diff --stat`, `git diff` y `git log --oneline -n 20` antes de modificar código.

Existían el formulario `RegistrarPagoPage`, el historial por abono, el selector de proyectos activos, la tabla `pagos`, los endpoints de registro/listado/verificación y el panel de Cobranzas. Los pagos nacían en `Pendiente de verificación`. Cobranzas, Jefatura y Dirección podían verificar; Comercial no podía autoverificar. No se encontraron importes contractuales: `presupuestos` contiene categorías con nombre y `pagoCuota1..6` son booleanos. Los contratos de corrección pertenecen al circuito freelance y no son contratos de venta del proyecto. Las atestaciones de pago de pausas formales también son un concepto separado.

La aclaración posterior del negocio establece que **Comercial es la autoridad de pagos y solvencia durante esta etapa; Cobranzas no participa todavía**. Comercial registra pagos recibidos directamente como verificados, con su responsable y fecha de confirmación. También puede revisar pendientes anteriores y anular con motivo. Admin conserva la intervención justificada. No hay vendedor/propietario comercial por proyecto en el esquema actual; no se inventó un scope por usuario. Los demás roles operativos consumen el snapshot permitido, sin autoridad para dictaminar pagos.

La aplicabilidad global del gate financiero y un eventual umbral siguen pendientes de validación documental. Por eso los proyectos existentes NO se bloquearon masivamente: `gate_financiero_requerido=false` inicialmente. Comercial y Admin pueden registrar una decisión explícita, con motivo y control de revisión. Cuando se requiere solvencia, la entrega del paquete final y la publicación se rechazan en el backend hasta la aprobación manual. No hay regla porcentual, incluido el 80%.

La base local auditada contenía **138 proyectos, cero abonos y ningún monto contractual**. No se añadió dinero, comprobantes ni proyectos para decorar las capturas. Los datos de las pruebas automatizadas se mantienen separados.

La comprobación de cierre encontró un abono pendiente nuevo y todavía ningún importe contractual. Se conservó sin modificaciones. Los conteos iniciales y las capturas corresponden al momento de su ejecución; la aplicación sigue mostrando los cambios concurrentes de la base real.

## Matriz de entrega solicitada, A–BQ

| Punto | Resultado / evidencia |
|---|---|
| A. Estado previo | Formulario de abono + historial individual; sin resumen contractual ni solvencia central. |
| B. Componentes encontrados | `RegistrarPagoPage`, `SelectorProyecto`, `ComercialSidebarNav`, `QuickActions`, `CrmSidebarLayout`, `AuditoriaPagosPage`. |
| C. Endpoints existentes | `POST /api/pagos`, `GET /api/pagos`, `PATCH /api/pagos/:id/verificar`; se conservaron. |
| D. Modelo contractual | Firma y categorías de presupuesto; no había importe ni moneda contractual. Contratos freelance separados. |
| E. Campos financieros existentes | `pagos.monto numeric(12,2)`, moneda USD por defecto, fecha, método, referencia, comprobante URL y estado; cuotas booleanas no convertidas en dinero. |
| F. Comercial | Registra pagos recibidos como verificados, confirma pendientes anteriores, anula con motivo y decide la solvencia. Gestiona también el importe contractual. |
| G. Cobranzas | Fuera del circuito de esta etapa; sin registro, verificación ni decisión de solvencia. El rol histórico se conserva para un desarrollo futuro. |
| H. Capabilities actuales | Registro, confirmación, anulación y solvencia: Comercial/Admin. Lectura completa: Comercial/RRPP/Jefatura/Dirección/Admin. Contrato: Comercial/Dirección/Admin. Admin debe justificar sus intervenciones. |
| I. Modelo final | Ampliación aditiva de `pagos` y `proyectos`, proyección SQL financiera central y operaciones transaccionales. |
| J. Migraciones | `0096_elite_hercules.sql`, snapshot y journal. Aplicada en desarrollo y en la base aislada de tests. Se retiraron del SQL generado las operaciones ya aplicadas por migraciones manuales anteriores. |
| K. Payment entity | Misma tabla `pagos`: autores de registro/confirmación/anulación, fechas, motivo, notas, origen, ID externo, clave de idempotencia y huella de la solicitud. |
| L. Financial status | `getProjectFinancialStatus` y `FINANCIAL_CTE` en `estadoFinanciero.ts`; dinero y porcentaje derivados en Postgres. |
| M. Source/external ID | `INTERNAL_TEMPORARY` para nuevos registros; `MIGRATED` para históricos, sin inventar actores ni fechas de confirmación. Unique `(origen, external_payment_id)` para futuras entradas del portal. |
| N. Estados individuales | `Pendiente de verificación`, `Verificado`, `Rechazado` existentes; se agregó `Anulado`. |
| O. paymentStatus | `Sin monto contractual`, `Sin pagos`, `Parcial`, `Pagado`, `Sobrepago`, `Revisar moneda`, derivados del estado real. |
| P. solvencyStatus | `Pendiente`, `Solvente`, `No solvente`; aprobación humana independiente. Anular un abono confirmado o modificar el contrato exige revisar una solvencia aprobada. |
| Q. Financial gate | `gateRequired`, `gateSatisfied`, `financialGateStatus` y `gateAffectingWorkflow` separados. Usa la misma proyección en las escrituras de paquete final y Digital. |
| R. Regla 80% | No se implementó ningún umbral del 80% ni otra equivalencia porcentaje/solvencia. |
| S. contractAmount | `proyectos.monto_contractual` y `moneda_contractual`, capturados al crear el proyecto o desde Pagos → Definir/Editar monto total; también disponibles en Ficha comercial → Resumen. Se reutilizan los mismos campos y no se deducen del presupuesto ni de las cuotas. |
| T. confirmedPaid | SUM de `pagos.monto` con estado `Verificado`, moneda coherente. Pendientes/rechazados/anulados no suman. |
| U. pendingAmount | `greatest(contract-paid,0)` con numeric; null sin contrato o con monedas incompatibles. No existía un modelo de descuentos/ajustes separado. |
| V. paidPercentage | `round(paid/contract*100,2)` solamente con contrato positivo y moneda coherente. Se devuelve decimal como string; no hay división sin denominador. |
| W. Sobrepago | Saldo cero, porcentaje real conservado, barra limitada visualmente a 100%, aviso y notificación a Comercial. Los pagos no se alteran. |
| X. Cards | Saldo, solventes y bloqueados; la cuarta card de pendientes aparece solamente si hay abonos anteriores por revisar. Agregaciones del backend antes de paginar. |
| Y. Tabs | Todos, Con saldo, Por confirmar, Solventes, Bloqueados; pendientes significa abonos por verificar. |
| Z. Filtros | Autor/proyecto/código, servicio, estado de pago, rango de último pago confirmado, inclusión explícita de culminados/retirados y orden. |
| AA. List DTO | `FinancialProject` en `shared/pagos.ts`: identidad, servicio, estado, importes, moneda, porcentaje, pago, solvencia, gate, último pago y pendientes. |
| AB. Detail DTO | `FinancialDetail`: estado central + historial paginado, notas de solvencia, responsable/fecha, revisión y resumen de auditoría. Lazy al seleccionar. |
| AC. Registrar | Modal nativo; búsqueda server-side de proyectos accesibles, preselección desde detalle, importe, moneda, fecha, método, referencia, comprobante y notas. Queda verificado al declarar el pago recibido. |
| AD. Confirmación | Al registrar se auditan registro y confirmación por Comercial. El endpoint existente permite a Comercial/Admin resolver pendientes históricos, con locks y responsable/fecha. Los históricos no se confirman masivamente. |
| AE. Anulación | `POST /api/pagos/:id/anular`, motivo obligatorio; preserva monto, historial y confirmador anterior. No hay DELETE ni edición de importes. |
| AF. Receipts | URL opcional de archivo del Drive corporativo del proyecto; valida raíz/ascendencia, integración, archivo no eliminado, PDF/PNG/JPG y tamaño ≤5 MB. Apertura mediante endpoint autenticado que revalida pertenencia. Sin uploader ni URL arbitraria. |
| AG. Historial | Fecha del abono, monto/moneda, método, estado; desplegable con referencia, notas, origen, registro, confirmación y anulación. Veinte registros por página; anulado visible y tachado. |
| AH. Audit | Registro, confirmación, rechazo, anulación, cambio contractual, solvencia, gate y sobrepago. Misma transacción que la mutación. Actor, entidad, proyecto, fecha y before/after relevantes; sin datos bancarios. |
| AI. Notificaciones | Alertas de sobrepago y contrato a Comercial; resultado de revisión al registrador; cambio de gate a Comercial, especialista actual y Digital solo si tiene trabajo vigente. No se generan avisos dirigidos a Cobranzas. Reintentos idempotentes no duplican avisos. |
| AJ. Quick Action | `Registrar pago` de Inicio abre `/comercial/pagos?registrar=1` y el modal. Verificado en navegador real. |
| AK. Project | Deep link real `Ver proyecto`; el alta pide monto total y moneda. Los proyectos existentes tienen edición auditada directa en Pagos y un enlace desde su formulario. Se impide eliminar proyectos con abonos. |
| AL. Jefatura | Consume estado central y gate; conserva lectura de supervisión, pero la decisión de pagos/solvencia corresponde a Comercial. Sin rediseño de pantalla. |
| AM. Specialist | Snapshot mínimo y scope por asignación canónica; no recibe monto contractual privado en respuestas generales ni métodos/referencias/historial de pagos. |
| AN. Digital | Validación del gate al registrar activación, carga y cierre, en vías nuevas y heredadas. Datos documentales de publicación también protegidos. Sin cambios visuales en Digital. |
| AO. Admin | Lectura completa; acciones administrativas justificadas. El modo Ver como usuario conserva el bloqueo de escritura ya existente. |
| AP. RBAC | Guards server-side por capacidad; botones por permisos como ayuda visual. No se amplió el acceso de otras áreas a la pantalla. |
| AQ. IDOR | UUIDs validados, 404 para proyectos/pagos inexistentes, 403 para intervención ajena o comprobante de otro proyecto. Comercial mantiene su scope grupal existente, sin ownership comercial inventado. |
| AR. Field security | DTO mínimo en `/api/pagos/proyectos/:id/estado`; capa de serialización que retira campos contractuales privados de respuestas generales para otras áreas, incluidas respuestas anidadas. |
| AS. Concurrencia | Locks de proyecto y pago; comparación de revisión en contrato/solvencia; pagos avanzan revisión. Doble confirmación no produce dos eventos. |
| AT. Idempotencia | UUID estable por formulario, bloqueo inmediato de doble envío, advisory lock + unique por actor/clave y huella del contenido. Clave opcional para compatibilidad de clientes anteriores; la nueva UI siempre la envía. |
| AU. Decimal | Persistencia y cálculos `numeric`; normalización textual a dos decimales. JS solo da formato, no calcula estados financieros. |
| AV. Moneda | Se muestra por proyecto; validación ISO compatible con dos decimales, coherencia con contrato y abonos vigentes. Inconsistencias históricas muestran revisión sin sumar monedas. USD solo conserva el default legacy, con aviso al registrar sin contrato. |
| AW. N+1 | Lista/KPIs/filtros en una sentencia SQL, sin consulta por fila; detalle con número fijo de consultas y sin llamadas Drive al listar. Plan real registrado en `query-plan.json`. |
| AX. Índices | `(proyecto_id, estatus, fecha_pago)`, unique actor/idempotencia y origen/ID externo; se reutilizan índices existentes de work items y auditoría. |
| AY. Paginación | Lista server-side con orden estable y tamaño máximo 50; UI de ocho proyectos. Historial server-side de veinte. Endpoint legacy acotado a cien con `page`. |
| AZ. TanStack | `payments/projects/filters`, `payments/project/id/page`, selector; invalidación tras mutación, más las keys heredadas compartidas. Sin recargar la página. |
| BA. Estados UI | Carga, error con reintento, cero resultados, historial vacío, sin monto, incompatibilidad de moneda, sobrepago y mutación pendiente. |
| BB. QA 1440 | Captura real 1440×900: shell original, cuatro cards, filtros, varias filas, detalle, selección dorada; tabla sin overflow horizontal. |
| BC. QA 768 | Captura real 768×1024: cards 2×2, proyectos simplificados, detalle modal; no layout 75/25 apretado. |
| BD. QA 375 | Captura real 375×812: cards 2×2, proyectos en lista, detalle y registro a pantalla completa; sin overflow de documento. |
| BE. Correcciones visuales | Tabla convertida en lista en tablet; ajuste de densidad/tamaño de texto; eliminación de título/autor redundantes; tabs desplazables; foco y Escape; iconos SVG coherentes. |
| BF. Backend tests | Casos nuevos de dinero/estados, registro concurrente, auditoría, anulación, sobrepago, filtros/paginación, scope, receipt, gate y protección de BD. También suites existentes. |
| BG. Frontend tests | Script Playwright con respuestas controladas: carga, KPI del servidor, historial/roles, selección, sin contrato, sobrepago, registro/idempotencia, confirmación, anulación, solvencia, errores y tabs. No escribe datos financieros reales. |
| BH. Regresión | Ver sección de validación al final, con resultados y cualquier fallo identificado. |
| BI. Totales | Ver sección de validación al final; no se suman ejecuciones repetidas como pruebas distintas. |
| BJ. Typecheck | Backend y frontend ejecutados; ver resultados finales. |
| BK. Builds | Backend y frontend ejecutados; Vite conserva la advertencia de chunks grandes. |
| BL. Archivos tocados | Inventario final en `docs/evidencias/pagos/git-status.txt`; implementación, migración, tests, scripts y esta auditoría. |
| BM. Diff stat | Salida final de `git diff --stat` en `docs/evidencias/pagos/git-diff-stat.txt`; los nuevos archivos se identifican en el status. |
| BN. Git status | Cambios locales sin commit ni push, conservando `main`; estado inicial limpio. Inventario final adjunto. |
| BO. Gaps conocidos | Datos contractuales aún sin capturar; aplicabilidad global/umbral no validados; receipts reales no disponibles en la base local, validación positiva/negativa cubierta con Drive simulado. Sin devoluciones ni reconciliación ni portal externo. |
| BP. Reglas pendientes | `PENDIENTE_VALIDACION_DOCUMENTAL`: umbral si llegara a existir, alcance obligatorio del gate por servicio/etapa y catálogo definitivo de monedas. La autoridad actual sí está confirmada: Comercial. Cobranzas queda para una etapa futura. |
| BQ. Portal futuro | El portal podrá insertar el mismo modelo con origen externo e ID único; la proyección y la UI no dependen de la captura manual. No se implementaron webhooks, sincronización, pasarela, facturación ni contabilidad. |

## Endpoints finales

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/pagos/proyectos` | Proyectos agregados, filtros, paginación y KPIs. |
| GET | `/api/pagos/proyectos/:id?historyPage=1` | Detalle y veinte abonos. |
| GET | `/api/pagos/proyectos/:id/estado` | Solvencia/gate mínimo para roles operativos autorizados. |
| POST | `/api/pagos` | Pago recibido confirmado por Comercial, auditado e idempotente. |
| GET | `/api/pagos?proyectoId=…&page=1` | Historial legacy acotado. |
| PATCH | `/api/pagos/:id/verificar` | Verificar o rechazar pendiente. |
| POST | `/api/pagos/:id/anular` | Anulación con motivo. |
| GET | `/api/pagos/:id/comprobante` | Acceso autenticado y pertenencia revalidada. |
| PATCH | `/api/pagos/proyectos/:id/contrato` | Captura contractual explícita y auditada. |
| PATCH | `/api/pagos/proyectos/:id/solvencia` | Decisión administrativa y aplicabilidad del gate. |

## Evidencia visual y pruebas

Las capturas `desktop.png`, `tablet.png`, `mobile.png`, sus vistas de detalle/registro y `empty.png` se encuentran en `docs/evidencias/pagos/`. `real-ui-report.json` distingue las comprobaciones sobre la aplicación real; `frontend-states-report.json` contiene pruebas controladas del frontend, sin escribir en la API real. `query-plan.json` conserva EXPLAIN ANALYZE sobre datos locales: ejecución observada **1,657 ms** para la consulta inspeccionada; no es una garantía de rendimiento con volúmenes futuros.

Validacion final:

- Suite completa inicial: 121 archivos, 2.078 pruebas; 2.068 pasaron y se detectaron diez fallos en dos archivos. Los nueve errores de respuesta se corrigieron haciendo sincrona la proteccion de campos en Fastify, compatible con las rutas heredadas. Se conservo la etiqueta de solvencia pendiente en Jefatura y se verifico que la aprobacion manual si actualiza su valor.
- Regresion final relacionada: **16 archivos y 418 pruebas aprobadas, cero fallos**, incluidos los dos grupos que habian fallado. Incluye Pagos, estado financiero, contratos/ingreso comercial, trazabilidad, Jefatura, Digital, Admin, notificaciones, gates y RBAC. No se afirma que la suite completa inicial haya pasado sin incidencias.
- Se agregaron 25 casos de dominio financiero y tres de seguridad de campos. Se reforzo la prueba existente del centro del proyecto para comprobar la aprobacion manual.
- Aceptacion frontend controlada: **14 comprobaciones aprobadas**, sin errores JavaScript. Evidencia en frontend-states-report.json.
- UI real: desktop 1440x900, tablet 768x1024, mobile 375x812; seleccion, detalle, registro, Escape, Quick Action, busqueda, filtros y paginacion verificados; ninguna pantalla con overflow horizontal de documento o tabla visible.
- Typecheck backend y frontend: aprobados. Builds backend y frontend: aprobados (Vite advierte sobre tamanos de chunks, sin impedir el build).
- Migracion aplicada; db:generate final indica que no hay cambios de schema pendientes. git diff --check sin errores de whitespace.
- La consulta inspeccionada usa una sola sentencia, y el test compara uno y dieciseis proyectos sin aumentar el numero de consultas. El detalle es lazy y el historial se pagina.
- Los logs de las ejecuciones estan en archivos locales pagos-*.log, ignorados por git; la evidencia portable se conserva en docs/evidencias/pagos/validation-summary.json y los reportes del navegador.

Comandos reproducibles: npm test; npm run typecheck; npm run build; npm --prefix frontend run typecheck; npm --prefix frontend run build; node scripts/pagos-ui-states.mjs; npx tsx scripts/pagos-visual-qa.ts. Los scripts Playwright aceptan PANHOUSE_PLAYWRIGHT_MODULE para utilizar una instalacion disponible y PANHOUSE_QA_ORIGIN para otro servidor de desarrollo.

## Actualización: Comercial asume la autoridad de pagos

Por aclaración expresa del negocio, Cobranzas no participa en esta etapa. La matriz anterior refleja ya la política vigente. Las cifras de regresión de 418 pruebas corresponden a la implementación inicial; la actualización se verificó con **67 pruebas aprobadas en cuatro suites**, incluidas las nuevas restricciones de roles, confirmación al registrar, idempotencia, sobrepago y solvencia manual. Las **14 comprobaciones de frontend**, las **ocho comprobaciones sobre la UI real**, los tres tamaños de pantalla y ambos builds también pasaron.

No fue necesaria otra migración. Los pagos nuevos se insertan como `Verificado`, con registrado/confirmado por el mismo actor y eventos de auditoría separados. Los pendientes existentes conservan su estado y Comercial puede confirmarlos desde el historial. No se realizaron confirmaciones masivas ni cambios retroactivos sobre pagos reales. La solvencia sigue siendo una decisión administrativa explícita, independiente del porcentaje.

## Actualización: monto total desde el alta

El formulario de Nuevo proyecto exige monto total y moneda. Al crear se guarda el importe normalizado y su auditoría en la misma transacción. Por compatibilidad, los clientes anteriores de la API pueden omitir ambos campos; enviar solo uno se rechaza. Los contratos anteriores permanecen sin importe hasta su captura explícita: no se inventan precios ni ceros.

En Pagos, el detalle incorpora Definir monto total / Editar monto total. El editor reutiliza el endpoint contractual existente y su control de revisión. Al guardar se actualizan el detalle, la lista y los indicadores sin recargar la página. La edición desde la ficha comercial utiliza el mismo componente. El porcentaje se obtiene del cálculo decimal del servidor: 350 confirmados sobre 1.000 muestran 35%; cambiar el total a 2.000 conserva los abonos y muestra 17,50%.

La actualización pasó **195 pruebas en seis suites**: 56 de importe inicial/operaciones de pagos y 139 de regresión de proyectos/preparación/ingreso comercial. Pasaron también **15 comprobaciones controladas del frontend**, **seis comprobaciones del alta y editor reales** en escritorio, tablet y móvil, y **ocho comprobaciones de la pantalla real de Pagos**. Ambos builds pasaron. Las pruebas de interfaz interceptan el envío de creación; no guardan proyectos ni pagos de prueba en la base real. No se requiere una nueva migración.

Evidencias específicas: `project-total-report.json`, `project-total-*.png`, `frontend-states-report.json` y `real-ui-report.json`, dentro de `docs/evidencias/pagos/`. Comandos adicionales reproducibles: `npx vitest run tests/proyectoMontoContractual.routes.test.ts tests/pagosOperativos.test.ts tests/pagosProyecto.routes.test.ts`, `npx vitest run tests/proyectos.routes.test.ts tests/preparacionComercial.routes.test.ts tests/comercialHandoff.routes.test.ts` y `npx tsx scripts/proyecto-monto-qa.ts`.

