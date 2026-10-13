# Operación del Especialista y ownership de procesos

Fecha de auditoría e implementación: 13 de octubre de 2026.

La Operación comienza cuando Jefatura asigna formalmente el proyecto al Especialista. El centro compartido responde qué necesita coordinación ahora y quién ejecuta cada proceso. El ingreso RRPP y la asignación permanecen como contexto previo, expediente e historia; no son procesos de Operación.

## Auditoría inicial y fuentes

Antes de editar se revisaron `git status`, `git diff --stat`, `git diff` y los últimos 15 commits. La rama inicial era `main`, HEAD `ac111c8`. Los cambios previos eran `package.json`, `scripts/panhouse-datos-demo.ts` y `docs/demo/panhouse-datos-varios.json`; pertenecen a la petición anterior y quedan fuera del commit de este refactor.

Se contrastaron directamente estas fuentes locales:

- `Downloads/Proceso de adiestramiento - Especialista editorial (3).docx`: Fase 0, §1.1–1.6, Edición, Corrección, Creativa, Calidad, Paquete final, Amazon y recordatorios de solicitudes.
- `Desktop/Gestor de Proyectos Editoriales/IA Matriz Proyectos - Panhouse - PED-FOR-002.xlsx`: BDD y sus instructivos, responsables, ingreso y procesos. La variante exacta con sufijo `(1)` no está disponible en este equipo; no se afirma que ambos archivos sean idénticos.
- `Downloads/MIREYA JOSEFINA OLIVEROS SEQUERA - FICHA DE TRAZABILIDAD.xlsx`: proyecto, diseño/paquete final, lanzamiento, impresión e instructivos.
- `Downloads/MATRIZ DE LANZAMIENTOS, EVENTOS Y PUBLICACIONES (1).xlsx`: ingresos, asesorías, eventos, publicaciones, interés de impresión y sus responsables.
- `docs/arquitectura/` y `docs/auditoria/`: flujo, fuentes, contradicciones, diccionario, permisos, fichas, Seguimiento, Decisiones, Inicio, Mi trabajo y Solicitudes.
- Implementación de `work_items`, `project_assignments`, `audit_logs`, contratos/solicitudes nativas, decisiones, catálogo `fases/pasos/servicio_fases`, correcciones, capítulos, creativa, diseño, calidad, digital, RRPP e impresión.

El repositorio sigue siendo un monolito modular: Fastify 5, TypeScript, Drizzle/PostgreSQL, Redis/BullMQ; React, Vite y TanStack Query. No existe OAuth de Drive operativo; `googleDrive.service.ts` es un mock anterior sin consumidores en el backend. No se conecta a la nueva preparación.

La auditoría encontró que `obtenerCommandCenter` agrupaba todos los work items, incluidos ingreso y asignación. El modal de Lanzamiento montaba el control genérico editable por Especialista. Su hito creaba implícitamente planificación, aviso y una solicitud inferida. Impresión estaba reservada al rol `impresion`; Digital también permitía escribir su control agregado desde Especialista. Solicitudes era una proyección de fuentes nativas: no existía un request formal para estos dos handoffs de RRPP.

## Ownership y límites

| Proceso | Trigger/gate | Quién solicita o coordina | Owner operativo y edición | Consulta | Request |
| --- | --- | --- | --- | --- | --- |
| Preparación inicial | Asignación vigente | Especialista | Especialista asignado | Jefatura y RRPP, sin edición | No genera handoff |
| Edición | Servicio aplicable e intervención existente | Especialista solicita Editor y coordina | Jefatura de Edición asigna; Editor ejecuta | Especialista y Jefatura | Solicitud nativa de Editor |
| Corrección | Revisión previa de Jefatura si tripa supera 120 páginas; contrato freelance cuando aplica | Especialista coordina | Corrector ejecuta; Especialista registra coordinación y cierre | Jefatura supervisa | Contrato de Talento y decisión de revisión previa conservados |
| Dirección creativa | Títulos definitivos y momento del servicio; brief aprobado para conceptos | Especialista activa y coordina | Líder Creativo; RRPP mantiene checkpoint de conceptos | Especialista y Jefatura | Solicitud nativa de reunión |
| Diseño | Preparación, recursos, corrección y verificaciones existentes por tipo | Especialista coordina conforme a los comandos actuales | Diseñador ejecuta; revisión de cubierta por sus owners actuales | Especialista y Jefatura | Conserva versiones y work items nativos |
| Calidad | Versión y ronda de validación reales | Especialista coordina handoff/aprobación del autor | Soporte Editorial / Validador | Especialista y Jefatura | Validación nativa por versión y ronda |
| Soporte digital | Tripa diagramada en primera validación | Comando existente de handoff de Calidad del Especialista | Soporte Digital | Especialista y Jefatura, sin escritura del control Digital | Activación Amazon existente |
| Lanzamiento y promoción | EF/CR Capítulo: envío del capítulo 4 a feedback; CR Tripa: envío/feedback de tripa; SE: asignación de Diseño | Especialista solicita activación | RRPP recibe, activa y opera su módulo existente | Especialista y Jefatura, lectura | `solicitudes_area`, work item `lanzamiento/planificacion` |
| Impresión | Registro canónico `diseno.paqueteFinalCargado = true` | Especialista solicita coordinación | RRPP recibe y coordina; `impresion` conserva ejecución downstream | Especialista y Jefatura, lectura | `solicitudes_area`, work item `impresion/coordinacion` |
| Distribución | Interés/intervención existentes | Flujos actuales | Distribución | Consulta del centro compartido | Sin rediseño de este dominio |

El registro compartido `PROCESOS_OPERATIVOS` distingue coordinador, rol operativo y ejecutor concreto. El backend deriva la acción, los gates, el request y los permisos. La UI no decide el ownership ni compara servicios para habilitar Lanzamiento.

## Preparación inicial

`preparaciones_proyecto` es la fuente nueva para recepción, revisión del expediente, primer contacto, fecha y realización de reunión operativa, grabación, transcripción, minuta, cronograma, carpeta real de Drive y observaciones. Ninguno de estos registros reutiliza fechas de reuniones RRPP ni copia identidad/contacto del autor.

El SLA central de primer contacto es asignación vigente + 24 horas. El original §1.2 dice “máx. 24 horas”; documentos previos describían “laborables”, sin definir jornada o calendario. Se usa el plazo literal del original y queda pendiente confirmar un eventual calendario laboral. Las asignaciones legacy sin fecha auditada muestran plazo no calculable; no se inventan fechas. No hay un timer de React.

Una asignación abre el work item singleton de preparación. El backfill aditivo abre pendientes para asignaciones existentes, sin declarar que ya recibieron/contactaron al autor. Leer una página no crea ni completa registros. El guardado parcial mueve el trabajo a `en_progreso`; todos los hechos/documentos iniciales completos lo cierran. Se auditan los campos modificados. Una reunión realizada requiere fecha hasta hoy; una acción realizada no admite fecha futura.

Drive se registra manualmente mediante una URL HTTPS del proveedor. El contrato admite no configurado, pendiente, configurado y error; la modalidad actual únicamente deriva no configurado/configurado del enlace registrado. No simula conexión, creación de carpetas, errores de proveedor ni recepción de archivos.

## Hito, solicitud y proceso

Un hito habilitante no envía una solicitud. El antiguo helper de Lanzamiento mantiene una evaluación compatible del hito y deja de crear trabajo, auditoría o aviso implícitos. La regla compartida vive en `shared/gatesOperacion.ts`.

`solicitarProcesoArea` requiere Especialista vigente, proyecto abierto y gate real. Crea atómicamente request, work item, auditoría y notificación a RRPP. Los endpoints son comandos concretos de Lanzamiento e Impresión; no existe un `POST /requests` con destino o tipo arbitrarios.

`solicitudes_area` identifica `(proyecto, tipo, businessKey)`, no impone unicidad global de tipo. Estas dos solicitudes son la activación inicial; las rondas y versiones de Corrección, Calidad y contratos siguen sus fuentes repetibles existentes. Un rechazo conserva su motivo; no se reabre silenciosamente ni se fabrica una segunda activación inicial. Una política de reenvío después del rechazo deberá definirse si el negocio la necesita.

RRPP puede iniciar revisión, pedir información, aceptar o rechazar con motivo. El Especialista vigente puede responder la pregunta pendiente sobre la misma solicitud, que vuelve a revisión. Las respuestas usan ID de pregunta; las mutaciones soportan versión optimista y bloqueo transaccional del proyecto/solicitud. Aceptar dos veces no duplica actividad ni notificaciones.

La aceptación resuelve el request con `LANZAMIENTO_ACTIVADO` o `IMPRESION_ACTIVADA`. El work item operativo continúa `en_progreso`. Guardar planificación, reuniones, responsables, eventos o publicaciones RRPP también acepta la solicitud pendiente en la misma transacción; la falta de información o un rechazo bloquean la operación. Solicitud resuelta no significa libro publicado ni impresión terminada.

La coordinación de Impresión reutiliza los campos canónicos de la Ficha, sin otra matriz. Su estado y fechas se sincronizan con el work item de coordinación dentro de la misma transacción. No se infiere solvencia de abonos/cuotas. El gate habilita pedir coordinación: no equivale a autorización de imprimir o despachar archivos ni confirma solvencia administrativa. Esas autorizaciones no tienen todavía un modelo canónico completo en este repositorio.

## Lecturas, navegación y permisos

Operación excluye ingreso/asignación en el backend, incluidas las filas de catálogo administrativo. Presenta preparación y procesos paralelos, owners, acciones y estados actuales; prioriza preparación, acciones disponibles, procesos activos, esperas y áreas sin iniciar. No introduce porcentaje ni fase global. Resumen conserva contexto previo compacto, Ficha conserva el expediente y Actividad conserva los eventos humanos.

Lanzamiento e Impresión tienen detalles propios de seguimiento para Especialista y Jefatura. No montan formularios de control ni inputs operativos de RRPP. RRPP usa la bandeja compartida de Solicitudes recibidas; después opera Lanzamiento en su módulo ya existente e Impresión en el mismo contexto del proyecto. Se conserva el shell de Resumen, Operación, Equipo, Ficha y Actividad.

Mi trabajo recibe primer contacto, expediente, Drive, reunión/documentos, solicitud habilitada y respuesta pendiente. Al enviar desaparece la acción de solicitar; el tracking vive en Solicitudes. Inicio conserva su resumen de coordinación y añade las acciones nuevas desde la cola. Mis proyectos sigue enviando una fila por proyecto, con contexto y acciones agregadas.

El Especialista solamente lee/muta su asignación vigente. La asignación histórica prevalece sobre un FK obsoleto. Las bandejas globales de Jefatura siguen rechazando Especialista. Las acciones de requests se verifican nuevamente dentro de la transacción frente a reasignación. RRPP puede operar sus handoffs; Jefatura consulta/supervisa, sin suplantar ese rol. Se cierran las rutas antiguas de escritura de Control Digital y Lanzamiento para Especialista. Los campos documentales de Impresión admiten RRPP únicamente después de aceptación o en un proceso legacy ya activo.

TanStack Query invalida las proyecciones del proyecto, Ficha, actividad, Mi trabajo, cartera y solicitudes tras comandos pertinentes. Errores de detalle y formularios se muestran localmente con reintento. Los diálogos tienen ancho acotado y se adaptan a pantalla completa en móvil.

## Migración, compatibilidad y performance

`0080_far_greymalkin.sql` agrega tres tablas, índices, claves externas y checks de estado/tipo, más el backfill de preparación. No elimina ni reescribe columnas legacy de lanzamiento/impresión, ni inventa solicitantes o fechas para proyectos históricos. Una planificación legacy activa sigue siendo consultable/operable, sin aparecer como una nueva solicitud formal. Los procesos de RRPP siguen leyendo la Ficha y work items existentes.

Las fuentes de activación y preparación se consultan en lote. El centro entrega sus datos ya cargados a Mi trabajo para evitar consultas repetidas; no crece el número de SQL al aumentar intervenciones. En transacciones las consultas usan el mismo cliente de forma secuencial. Cartera mantiene DTO por proyecto, sin enviar ficha completa, archivos o historial. Los tests verifican número de consultas constante con 1/15 proyectos y con 40 intervenciones; sus límites se actualizaron por las fuentes nuevas, sin eliminar la verificación de constancia.

## Drive y brechas conservadas

`GoogleDriveAdapter` y `EntregaDocumental` definen almacenamiento, documentos, versión, entrega, actor y plazo. Una futura implementación guarda secretos/tokens del lado servidor y conserva el callback propuesto `GET /api/auth/google/callback`. Esta tarea no implementa OAuth ni llama a Google. La recepción/versionado y SLA de los procesos actuales permanecen en PanHouse; un archivo que aparezca en Drive no completa trabajos automáticamente.

Se conservan las contradicciones anteriores de plazo de Crudo Tripa, pesos provisionales, activación Digital y solvencia. La nueva decisión confirmada de RRPP como receptor/coordinador de Impresión prevalece sobre el reparto del instructivo antiguo. El rol `impresion` mantiene su capacidad downstream para preservar datos y operación existente; no se le atribuye esta labor al Especialista.

## Validación y evidencia

La validación inicial de Command Center, Solicitudes y RRPP pasó 101 pruebas en tres archivos. La primera suite completa identificó 10 expectativas obsoletas entre 1.263 pruebas: permisos anteriores, activación automática y conteos sin preparación. Se ajustaron fixtures para aislar procesos posteriores, se mantuvieron pruebas de IDOR/constancia y se agregaron pruebas de la preparación y de ambos handoffs. El reporte de entrega registra los resultados finales, builds, QA desktop/tablet/mobile, autocrítica visual, estado Git y commit.

El QA visual usa `panhouse_operacion_visual_qa`, con cinco proyectos/copias de fixtures existentes, sin crear autores o proyectos nuevos. Las sesiones QA usan una cookie distinta de desarrollo. Los cambios funcionales de QA no se aplican a la base de desarrollo. Al finalizar se detienen los servidores y se elimina exclusivamente esa base temporal.
