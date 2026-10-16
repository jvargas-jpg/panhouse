# Google Drive fase 1 · reporte de entrega

16 de octubre de 2026. Conexión real autorizada, persistida y operativa. Alcance: OAuth corporativo, adapter, UI administrativa y prueba de carpetas con cleanup.

| Punto | Resultado |
|---|---|
| A · Simulación anterior | `server/services/googleDrive.service.ts` devolvía IDs/URLs mock y listas vacías; no tenía consumidores. Eliminado. |
| B · Auditoría | Revisados Fastify, auth/cookies/sesiones, middleware RBAC, Drizzle, env, frontend routing/TanStack Query y audit logs. El contrato previo `server/services/googleDriveAdapter.ts` no tenía implementación; ahora reexporta la frontera real. No existían helpers de cifrado ni tabla reutilizable de integraciones. |
| C · Arquitectura | Módulo `server/modules/integrations/google-drive/`: config, encryption, errors, OAuth, provider, adapter, servicio corporativo, rutas y cleanup. `DriveStorageProvider` separa negocio del SDK oficial. Una conexión organizacional. |
| D · Dependencias | `@googleapis/drive` 26.0.2 y `google-auth-library` 11.3.1. Submódulo oficial Drive v3 y OAuth2Client oficial; Node >=22, compatible con el proyecto. |
| E · Entorno | Soporte para GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_DRIVE_SCOPE, GOOGLE_TOKEN_ENCRYPTION_KEY y APP_FRONTEND_URL. `.env.example` solo placeholders. Configuración incompleta devuelve `Google Drive integration is not configured.` sin derribar el servidor. Cliente/secret/callback ya estaban localmente; se completaron scope, frontend y clave aleatoria mediante helper que no imprime valores. |
| F · Persistencia | Migración aditiva `0082_lean_leo.sql`: `external_integrations` singleton y `google_oauth_attempts`. Aplicada en desarrollo y por el setup de pruebas en la base `_test`. Metadata mínima, actor, timestamps, scope, revisión, resultado de prueba y refresh cifrado; ningún access token en DB. |
| G · Cifrado | AES-256-GCM, clave de 32 bytes base64 fuera de PostgreSQL, IV aleatorio de 12 bytes, tag de 16 bytes y AAD distinto para refresh/PKCE. Envelope versionado. Tests de roundtrip, IV distinto, clave incorrecta, tag corrupto y propósito incorrecto. |
| H · Connect | POST `/api/integrations/google-drive/connect`: RBAC, rate limit, state, PKCE S256, URL oficial, offline, consentimiento y exclusivamente drive.file. |
| I · State | 256 bits aleatorios, hash SHA-256 persistido, usuario/sesión originales, expiración de 10 minutos y consumo atómico previo al intercambio. Se prueban válido, incorrecto, ausente, expirado, reutilizado, otra sesión y otro usuario. Revisión impide reconectar desde un intento anterior a desconexión. Purga de intentos expirados hace más de 24 horas. |
| J · Callback | GET `http://localhost:3000/api/auth/google/callback`, sin cambiar el callback registrado. Requiere sesión/rol, intercambia exclusivamente en backend y redirige a frontend fijo. Query OAuth excluida de logs automáticos; mensajes permitidos, sin respuestas SDK crudas. No sustituye login PanHouse. |
| K · Refresh | Se prueba una llamada real con cliente creado únicamente con refresh persistido; el SDK obtiene acceso automáticamente. El callback exige esa validación antes de marcar conectado. Nunca sobrescribe un refresh con NULL; solo reutiliza el anterior si coinciden cuenta verificada y cliente OAuth. Primera conexión sin refresh produce error accionable. |
| L · Adapter | validateConnection/about.get, createFolder con MIME folder/padre, listFolders paginado y query escapada, getMetadata y deleteFileOrFolder. Metadata propia, respuestas incompletas rechazadas y errores normalizados. Llamadas oficiales con timeout y sin retries indiscriminados de creación. |
| M · Status | GET `/api/integrations/google-drive/status`: configured, connected, provider, cuenta, scope, fechas, salud y resultado de prueba seguro. No expone token, ciphertext ni client secret. No considera sano un token sin validación con Google. |
| N · Disconnect | POST intenta revocar, elimina credencial local incluso si Google falla, marca desconectado, invalida intentos anteriores y audita. No borra archivos. Cubierto con mocks, incluido fallo remoto. La conexión real se deja activa al entregar. |
| O · Prueba administrativa | POST `/api/integrations/google-drive/test`: validación real, recuperación de raíces propias etiquetadas, raíz temporal, hija «Prueba API», listado, metadata, eliminación y confirmación 404. Cooldown de 10 s y lock corporativo no bloqueante. Persistencia/auditoría también ante fallo parcial, sin rollback que oculte el fallo. |
| P · Frontend | `/configuracion/integraciones/google-drive`, enlace «Integraciones» para Dirección. Cuenta/estado/salud/fecha/alcance, conexión, prueba y desconexión confirmada. Callback muestra resultado y refetch. Sin tokens Google en almacenamiento del navegador. Verificado desktop/tablet/móvil. |
| Q · RBAC y cuenta solicitada | Dirección es el rol existente más restrictivo elegido para esta integración; propietario definitivo PENDIENTE_VALIDACION_DOCUMENTAL. Especialista carece de controles y backend devuelve 403. A petición expresa se creó `admin@panhouse.local`, «Administrador PanHouse», rol `direccion`. No se inventó rol admin ni se ampliaron permisos de otros módulos. Contraseña aleatoria solo en `secrets/panhouse-admin.local.json`, ignorado por Git; DB con Argon2id. |
| R · Auditoría | GOOGLE_DRIVE_CONECTADO, GOOGLE_DRIVE_DESCONECTADO, GOOGLE_DRIVE_VERIFICADO y GOOGLE_DRIVE_CARPETA_PRUEBA_CREADA. Actor y metadata segura; sin tokens/códigos/secretos/ciphertext. Cleanup queda en resultado auditado. |
| S · Unit tests | 16 de seguridad/OAuth/cifrado/errores/confirmación diferida de eliminación y 6 del adapter oficial mockeado. |
| T · Route tests | 20 pruebas Fastify inject con DB real de tests y gateway mockeado: permisos, origen/payload, state, persistencia, scope, refresh, fallos, prueba/cleanup/recuperación y rate limit. Ninguna llamada real a Google. |
| U · Frontend tests | `scripts/google-drive-browser-qa.mjs`: 18 checks aprobados, cero errores JS. Estados conectado/desconectado/no configurado, connect, callback, test, errores, cancelar/confirmar disconnect, responsive y restricción Especialista. Evidencias marcadas explícitamente como fixtures. |
| V · Regresión completa | **71 archivos, 1354 tests aprobados, 0 fallidos**. Corrida finalizada, duración 548.23 s. Después del ajuste de cleanup se repitieron los 3 archivos específicos: **42/42 aprobados**. |
| W · Typecheck/build | Backend typecheck y build aprobados, repetidos tras el ajuste final. Frontend typecheck y build aprobados. Vite mantiene su aviso de chunks grandes; no impide build. |
| X · OAuth manual | Click real desde PanHouse → selector Google → cuenta del Workspace `jvargas@editorialpanhouse.com` → consentimiento drive.file → callback Fastify → estado conectado. Recargar la pantalla mantiene cuenta, estado y fechas desde DB. |
| Y · Smoke real | Endpoint ejecutado desde la UI y comando de inspección visual ejecutado contra Google real, con refresh leído/cifrado en DB. Creación, listado y metadata de raíz/hija comprobados; ambas eliminadas. El comando manual pausa antes de cleanup por hasta 180 s y nunca forma parte de npm test. |
| Z · Carpetas verificadas | Inspección visual: `PANHOUSE_API_TEST_1792159726187_5e32d1b3`, raíz `1ibibgFE4uJHRPRSK8woI2-xnKM5gH6Nt`, hija `1tSMh3YaCDP1W5HhdeuyQh7WQojZt_Cfg`. Último endpoint: `PANHOUSE_API_TEST_1792159831394_7f71a760`, raíz `1yGK_zIlsd3U3rb4cE10yhibWP4IJ7zcl`, hija `15cMBJXXabeT20T4F9sX3RV2Wzy_86S_T`. IDs no sensibles de objetos temporales ya eliminados. |
| AA · Cleanup | Confirmado mediante API para raíz/hija de inspección y del último endpoint, 404 visual al abrir raíz eliminada y **0 raíces de prueba pendientes**. Una primera inspección descubrió metadata visible brevemente tras delete; no se declaró éxito falso. La repetición con confirmación acotada y eliminación independiente hija/raíz pasó. |
| AB · Scopes finales | Exclusivamente `https://www.googleapis.com/auth/drive.file`. Sin drive completo, openid, email, profile, Picker ni scopes incrementales. |
| AC · Seguridad | Búsqueda de client_secret, refresh_token, access_token y private_key con reporte solo de nombres/conteos. Comparación adicional de secretos locales contra archivos candidatos a Git, incluyendo contraseña administrativa: sin valores reales detectados. `.env` y `secrets/` ignorados. npm audit registra 16 avisos en dependencias ya presentes y con versiones idénticas a HEAD previo: 7 moderados, 6 altos, 3 críticos; ninguno señala las nuevas librerías Google. No se mezcló una actualización general de dependencias con esta fase. |
| AD · Fase 2 | Pendientes estructura por servicio/manual, automatización por asignación, entregables, versionado, freelancers, Picker, sincronización y detección de cambios. Producción requiere callback HTTPS registrado, secretos respaldados fuera de DB y definición formal del propietario administrativo. |
| AE · Diff | Estadística exacta de la entrega en `25-google-drive-diff-stat.txt`, incluye migración/snapshot y evidencias. |
| AF · Git status | Verificado limpio tras commit de entrega. Los secretos locales quedan ignorados y fuera del índice. |
| AG · Commit | `feat: connect corporate Google Drive with secure OAuth and real smoke test`; hash exacto entregado en la respuesta final y disponible en git log. |

## Evidencias

- [Estado real y refresh independiente](../evidencias/google-drive/real-status.json)
- [Resultado del smoke visual](../evidencias/google-drive/real-smoke.json)
- [PanHouse conectado tras prueba real](../evidencias/google-drive/panhouse-real-connected.png)
- [Raíz y subcarpeta reales en Google Drive](../evidencias/google-drive/drive-real-inspection.png)
- [404 de la raíz eliminada](../evidencias/google-drive/drive-real-cleanup.png)
- [18 comprobaciones frontend](../evidencias/google-drive/frontend-qa.json)
- [Revisión sin valores secretos](../evidencias/google-drive/security-qa.json)
- [Arquitectura y operación](../arquitectura/25-google-drive-integration.md)

Las imágenes con sufijo `fixture` y `ui-*` son pruebas de UI mockeadas; las imágenes `drive-real-*` y `panhouse-real-connected` corresponden a Google real. Ninguna evidencia incluye credenciales ni tokens Google.
