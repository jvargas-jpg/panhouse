# 26 · Espacios documentales de proyectos

## Asignación automática · decisión vigente (19 de octubre de 2026)

NEW ASSIGNMENT → auto provisioning. Jefatura confirma la asignación mediante el flujo existente (`asignarEspecialista`, evento `ESPECIALISTA_ASIGNADO` / `ESPECIALISTA_REASIGNADO`). La transacción conserva puntero, historial, audit, notificación de asignación y work items; `asignarConHistorial` agrega una intención única por proyecto en `project_workspace_requests`. Tras el COMMIT, `dispatchProjectWorkspace` publica sin esperar a Redis ni a Google. El camino consolidado de Equipo usa el mismo historial e intención.

Google nunca participa en la transacción de negocio: una indisponibilidad externa no debe revocar la responsabilidad editorial ya confirmada. Incluso si el proceso muere entre COMMIT y enqueue, la intención queda en PostgreSQL. El worker revisa cada 15 segundos únicamente solicitudes PENDING/PROVISIONING; no recorre proyectos ni asignaciones legacy. Redis caído conserva la intención y no rompe la respuesta HTTP de asignación.

BullMQ: queue `project-drive-workspaces`, job `provision-project-drive-workspace`, payload `{ projectId }`. Business key: `project-drive-workspace-<projectId>` (guiones porque BullMQ no admite `:` en IDs personalizados; [documentación oficial](https://docs.bullmq.io/guide/jobs/job-ids)). Hay cuatro intentos con backoff exponencial de 5 segundos. Si un job terminado/fallido permanece retenido, un recovery explícito lo reactiva con `retry(state)`; un job activo/esperando/demorado no se duplica. Un lock PostgreSQL por proyecto cubre entregas concurrentes o stalled; el lock corporativo existente sigue protegiendo cuenta/configuración. READY es un no-op sin consultar Google.

La solicitud tiene PENDING → PROVISIONING → READY / ERROR. El workspace existente conserva PROVISIONING / READY / ERROR. Antes de disponer de integración, raíz o template válidos puede no haber workspace físico: la solicitud conserva el error y el DTO igualmente expone ERROR con una razón humana. Los fallos transitorios con retry BullMQ pendiente se proyectan PENDING para mantener el polling hasta el resultado final. El estado viene de PostgreSQL mediante una sola consulta por lote; abrir proyectos nunca llama Google.

LEGACY → manual provisioning. La ausencia de solicitud y workspace, con Especialista vigente, identifica el caso legacy sin fechas. Solo ese caso ofrece «Configurar espacio». No existe backfill automático al arrancar. ERROR → retry: `POST /proyectos/:id/workspace/retry` responde 202 y encola recuperación sobre el mismo proyecto; el endpoint anterior es un alias compatible del mismo comando. No recibe nombres, IDs, árbol ni template. El Especialista solo puede reintentar errores transitorios recuperables; Dirección puede recuperar fallos administrativos. Jefatura lee. OAuth/raíz/cambio de cuenta se derivan a Dirección; Crudo sin subtipo, a Jefatura, sin inventarlo. Las alertas son notificaciones internas; no se envían correos ni WhatsApp.

La UI muestra «Preparando automáticamente…» sin bloquear el proyecto; READY muestra nombre, fecha, enlace persistido y estructura real en modal. Resumen y Ficha tienen un acceso compacto de solo consulta a la misma URL. Jefatura no administra el árbol. El Especialista no recibe una tarea normal de crear carpetas; un error administrativo figura en Esperando, sin CTA de reparación. TanStack Query consulta cada 1,5 segundos únicamente durante PENDING/PROVISIONING e invalida operación/resumen, actividad y Mi trabajo al cambiar el estado. Se detiene en READY/ERROR.

La saga conserva IDs reservados y avances parciales; no borra carpetas al fallar ni crea otra raíz al reintentar o reasignar. Antes de READY compara el plan completo contra folders persistidos READY con URL y verificación. Los templates EF, CR_CHAPTER, CR_FULL y SE siguen resolviéndose en backend. Sharing continúa `PENDING_VALIDATION`: no se ejecutan permisos no validados, no se amplían scopes y no se define silenciosamente una política de revocación.

QA real: proyecto `FC13FD`, asignado desde Jefatura sin creación manual previa; respuesta 200 en 120 ms. BullMQ completó el provisioning en aproximadamente 38 segundos. Workspace `f33e5965-4169-4e92-9728-0ac543b3407a`, template EF con Ilustraciones/Gráficos: 30 esperadas, 30 persistidas, 30 verificadas en Google, missing=0. [Abrir carpeta QA](https://drive.google.com/drive/folders/1YDK6tKTDgSpFcAWuQNq2mfRA9rx9i5rl). Se conserva para validación humana; no se ha eliminado. Evidencia: `docs/evidencias/project-workspace-assignment/`.

## Fuente y auditoría

Base `a0e798c`, árbol limpio. Se reutilizan OAuth, scope drive.file, AES-GCM, integración singleton y GoogleDriveAdapter de fase 1. No se repite OAuth ni se conoce el correo técnico desde proyectos. Se leyó completo `Proceso de adiestramiento - Especialista editorial (3).docx` (364 párrafos, 331 con texto; no contiene imágenes); se preservó la profundidad de sus listas OOXML al extraer el árbol de §1.3. También se revisaron Edición, Corrección, Diseño, Calidad, Paquete final y actualizaciones del manual.

El catálogo activo usa EF, CR y SE; EEC/EET se mantienen inactivos por proyectos históricos. RRPP determina `fichas_trazabilidad.ingresoServicioSubtipoCrudo`: Capítulo o Tripa. No se agregan servicios legacy. `preparaciones_proyecto.drive_carpeta_url` era un enlace manual, sin IDs ni adapter; no demuestra workspace creado. Command Center y Mi trabajo proyectaban ese enlace como configuración. Se reemplaza esa edición por una acción de dominio y se conserva el dato histórico separado.

## Mapa del manual

| Servicio actual | Template | Código documental del manual | Edición | Condiciones |
|---|---|---|---|---|
| EF · Escritura fantasma | EF | EF | Editado, extracciones, tripa completa, kit | Extracciones únicamente EF |
| CR + Capítulo | CR_CHAPTER | EEC | Editado, para editar, tripa completa, kit | Equivalencia documental con edición por capítulo |
| CR + Tripa | CR_FULL | EET | Editado, para editar, tripa completa, kit | Equivalencia documental con edición por tripa |
| SE · Sello editorial | SE | SE | No aplica (§2.3) | Corrección y Diseño comunes |

Los proyectos históricos EEC/EET resuelven el template equivalente sin convertirlos en servicios activos. CR sin subtipo bloquea antes de llamar a Google y deja inconsistencia auditada. Un template versionado guarda su plan y nombres al primer intento; cambios posteriores de autor, servicio o catálogo no mutan espacios ya creados ni reescriben sus planes de recuperación.

Árbol de §1.3 (cada nombre de carpeta lleva « – Nombre del autor»):

```text
Nombre del autor – código documental – #código del proyecto
  Edición                                      [EF / CR Capítulo / CR Tripa]
    Editado
      Con feedback
      Con feedback aplicado
    Extracciones de contenido                  [solo EF]
    Para editar                                [solo CR Capítulo / CR Tripa]
    Tripa completa
      Con feedback
      Con feedback aplicado
    Kit editorial
      Con feedback
      Con feedback aplicado
  Corrección
    Para corregir
    Corregido
  Diseño
    Tripa para diagramar
    Tripa para muestra
    Versiones_para_corregir
    Tripa con comentarios                      [§5.1, padre confirmado por usuario]
    ISBN
    Paquete final
      KDP
      Artes finales
        Tripa
        Cubierta
          Editables cubierta
      Editables tripa
  Ilustraciones                                [condición canónica Ilustraciones]
  Gráficos                                     [condición canónica Gráficos]
```

«Editables tripa» tiene nivel de lista 2 en el manual y pertenece a Paquete final, no a Artes finales. Mockup y Tapa en jpg están expresamente identificados como archivos; no se crean carpetas ni documentos vacíos para ellos. Cronograma, diagnóstico, minuta y ficha son futuros archivos en raíz, no placeholders. No se inventa una carpeta Calidad a partir de los ejemplos del prompt.

§5.1/§5.4 nombran «Tripa con comentarios» pero no fijan su padre en §1.3: el usuario confirmó explícitamente Diseño, junto a Versiones_para_corregir, durante esta implementación. Ilustraciones/Gráficos tienen fuente canónica `condicionesEspeciales`; Imágenes, Fotos del autor y Tablas no tienen indicador canónico y quedan DATA GAP / PENDIENTE_VALIDACION_DOCUMENTAL, sin inferirlos de texto libre. No bloquean el resto del workspace.

## Persistencia y recuperación

La integración conserva su raíz DEV y un contexto opaco de almacenamiento. El contexto cambia al cambiar cuenta/cliente OAuth; no usa correos en proyectos. Un workspace referencia integración y contexto, una raíz de proyectos y un template/versión/plan inmutable. Un UNIQUE por proyecto impide segundas raíces por doble click o reasignación. Cada carpeta guarda key estable, padre, nombre, ID de Drive, URL y estado; UNIQUE workspace/key.

La operación es una saga corta, sin transacción PostgreSQL abierta durante todas las llamadas Google. Un advisory lock de sesión no bloqueante sobre la integración serializa provisioning/configuración con desconexión y callback de fase 1. Una segunda solicitud en curso obtiene conflicto y consulta el estado persistido. Cada ID se obtiene con `files.generateIds`, se guarda antes de `files.create` y se reutiliza al recuperar: incluso un timeout o crash después de crear en Google no obliga a buscar por nombre ni a duplicar. Las carpetas creadas se verifican por ID, MIME y padre. Cada avance se confirma en su propia transacción.

Estados del workspace: PROVISIONING, READY, ERROR. Ausencia de workspace y de solicitud = NOT_CONFIGURED; una solicitud pendiente o fallida mantiene su estado aunque aún no exista workspace físico. El plan sobrevive fallos parciales. Retry crea solo faltantes y no borra carpetas automáticamente. READY se publica únicamente con todos los IDs verificados/persistidos. No hay polling a Google al abrir Command Center: el frontend consulta PostgreSQL y solo durante una operación en curso consulta estado local.

Raíz administrativa de desarrollo: `PANHOUSE - PROYECTOS EDITORIALES - DEV`, creada una sola vez por Dirección con el mismo mecanismo de ID reservado. Los proyectos nunca caen directamente en Mi unidad, ni bajo raíces smoke/manual de fase 1. Si la raíz falta, el Especialista recibe error administrativo claro. Cambiar a otra cuenta invalida la raíz configurada; workspaces de otro contexto conservan su historial y requieren recuperación administrativa, sin crear sustitutos automáticamente. La migración real de archivos/Shared Drives es una operación posterior explícita.

## Preparación, acceso y actividad

El Especialista actualmente asignado puede configurar proyectos legacy o reintentar errores recuperables; Dirección dispone de recuperación administrativa. Lectura para los roles autorizados del workspace con acceso al proyecto, incluida Jefatura. No se expone un endpoint genérico para crear carpetas ni se aceptan IDs/nombres del frontend. Códigos/nombres y padres provienen del proyecto y del plan.

READY completa la subacción documental de Preparación inicial y la retira de Mi trabajo. El work item de Preparación completa al cumplir además recepción, contacto, reunión y documentos: no se simula que esas acciones ocurrieron al crear Drive. Se auditan inicio, configuración, fallo, retry y bloqueo por inconsistencia; Actividad muestra actor y mensaje humano. El enlace persistido se abre con noopener/noreferrer. No se migra un enlace histórico automáticamente.

El dominio no conoce OAuth ni el correo de la integración. No se deriva el estado editorial de un listado Drive. No se crean entregables, uploads, versiones, Picker, portal externo ni watchers.

## Sharing y reasignación

La documentación oficial admite permissions.create con drive.file para archivos accesibles a la app. El adapter queda preparado con writer en la raíz, nunca owner, sin notificación por correo; subcarpetas heredan según Drive. El usuario confirmó que no dispone ahora de otro correo corporativo y ordenó dejar sharing PENDIENTE_VALIDACION: no se ejecuta smoke de permisos ni se habilita sharing automático. La creación completa continúa. El modelo conserva campos mínimos de permiso/destinatario para la validación futura, sin cambiar la identidad del workspace ni inventar correos. La capacidad técnica no se presenta como validación real ya realizada.

No se decide una política silenciosa de revocación al reasignar. El workspace pertenece al proyecto y no se duplica; si cambia el Especialista, el acceso previo se conserva y la UI requiere revisión administrativa. Automatizar revocación/concesión requiere confirmación de negocio. Tampoco se presupone que un enlace concede permisos a Jefatura.

## Validación

Tests ordinarios usan un provider fake, nunca Google real: cuatro árboles, condiciones canónicas, Crudo indefinido, nombres, RBAC/IDOR, ausencia de integración/raíz, doble click, reintentos, fallo entre create y persistencia, cambio de contexto, audit y subacción de Preparación/Mi trabajo. QA real crea un proyecto expresamente ficticio bajo raíz DEV, compara carpetas esperadas/actuales por jerarquía y deja el workspace visible hasta orden humana de eliminación. Desktop, 768×1024 y 375×812.

Referencias oficiales: [IDs reservados y retries sin duplicar](https://developers.google.com/workspace/drive/api/guides/create-file), [generateIds y drive.file](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds), [permissions.create](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create).
