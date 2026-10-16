# 26 · Espacios documentales de proyectos

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

Estados del workspace: PROVISIONING, READY, ERROR; ausencia de fila = NOT_CONFIGURED. El plan sobrevive fallos parciales. Retry crea solo faltantes y no borra carpetas automáticamente. READY se publica únicamente con todos los IDs verificados/persistidos. No hay polling a Google al abrir Command Center: el frontend consulta PostgreSQL y solo durante una operación en curso consulta estado local.

Raíz administrativa de desarrollo: `PANHOUSE - PROYECTOS EDITORIALES - DEV`, creada una sola vez por Dirección con el mismo mecanismo de ID reservado. Los proyectos nunca caen directamente en Mi unidad, ni bajo raíces smoke/manual de fase 1. Si la raíz falta, el Especialista recibe error administrativo claro. Cambiar a otra cuenta invalida la raíz configurada; workspaces de otro contexto conservan su historial y requieren recuperación administrativa, sin crear sustitutos automáticamente. La migración real de archivos/Shared Drives es una operación posterior explícita.

## Preparación, acceso y actividad

El Especialista actualmente asignado puede crear/reintentar; Dirección dispone de recuperación administrativa. Lectura para roles con acceso al proyecto, incluida Jefatura. No se expone un endpoint genérico para crear carpetas ni se aceptan IDs/nombres del frontend. Códigos/nombres y padres provienen del proyecto y del plan.

READY completa la subacción documental de Preparación inicial y la retira de Mi trabajo. El work item de Preparación completa al cumplir además recepción, contacto, reunión y documentos: no se simula que esas acciones ocurrieron al crear Drive. Se auditan inicio, configuración, fallo, retry y bloqueo por inconsistencia; Actividad muestra actor y mensaje humano. El enlace persistido se abre con noopener/noreferrer. No se migra un enlace histórico automáticamente.

El dominio no conoce OAuth ni el correo de la integración. No se deriva el estado editorial de un listado Drive. No se crean entregables, uploads, versiones, Picker, portal externo ni watchers.

## Sharing y reasignación

La documentación oficial admite permissions.create con drive.file para archivos accesibles a la app. El adapter queda preparado con writer en la raíz, nunca owner, sin notificación por correo; subcarpetas heredan según Drive. El usuario confirmó que no dispone ahora de otro correo corporativo y ordenó dejar sharing PENDIENTE_VALIDACION: no se ejecuta smoke de permisos ni se habilita sharing automático. La creación completa continúa. El modelo conserva campos mínimos de permiso/destinatario para la validación futura, sin cambiar la identidad del workspace ni inventar correos. La capacidad técnica no se presenta como validación real ya realizada.

No se decide una política silenciosa de revocación al reasignar. El workspace pertenece al proyecto y no se duplica; si cambia el Especialista, el acceso previo se conserva y la UI requiere revisión administrativa. Automatizar revocación/concesión requiere confirmación de negocio. Tampoco se presupone que un enlace concede permisos a Jefatura.

## Validación

Tests ordinarios usan un provider fake, nunca Google real: cuatro árboles, condiciones canónicas, Crudo indefinido, nombres, RBAC/IDOR, ausencia de integración/raíz, doble click, reintentos, fallo entre create y persistencia, cambio de contexto, audit y subacción de Preparación/Mi trabajo. QA real crea un proyecto expresamente ficticio bajo raíz DEV, compara carpetas esperadas/actuales por jerarquía y deja el workspace visible hasta orden humana de eliminación. Desktop, 768×1024 y 375×812.

Referencias oficiales: [IDs reservados y retries sin duplicar](https://developers.google.com/workspace/drive/api/guides/create-file), [generateIds y drive.file](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds), [permissions.create](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create).
