# 25 · Google Drive, fase 1

## Auditoría previa

Base: `450e646`, árbol limpio. `server/services/googleDrive.service.ts` devolvía IDs/URLs `mock-*` y una lista vacía. No tenía consumidores. `googleDriveAdapter.ts` solo declaraba contratos para una automatización documental futura, sin implementación. Se elimina la simulación y se establece una frontera única de almacenamiento; esta fase no crea carpetas al asignar proyectos ni implementa entregables/versiones.

Fastify 5 usa sesión opaca almacenada por hash SHA-256 en `sesiones`, cookie httpOnly SameSite=Lax y comprobación de roles en backend. No hay middleware CSRF, cifrado autenticado ni rate limiting general. Tampoco hay configuración administrativa de integraciones ni tabla reutilizable. Dirección es el único rol habilitado: no se inventa un rol admin y los soportes operativos no reciben privilegios organizacionales. El propietario administrativo definitivo queda PENDIENTE_VALIDACION_DOCUMENTAL.

## Frontera y persistencia

`server/modules/integrations/google-drive/` contiene configuración, cifrado, gateway OAuth, adapter real y servicio organizacional. `DriveStorageProvider` es el contrato interno. Solo este módulo conoce las librerías oficiales de Google (`@googleapis/drive` y `google-auth-library`); los módulos de negocio no llaman REST ni SDK.

Una fila única `external_integrations(provider=google_drive)` conserva estado, refresh token cifrado, cuenta/permissionId cuando Drive lo suministra, scopes, client ID público que emitió el grant, conexión/actor, última validación, desconexión y resultado mínimo de prueba. No guarda access tokens ni respuestas Google completas. `google_oauth_attempts` guarda hash del state, sesión/usuario, expiración, consumo, revisión de integración y verificador PKCE cifrado. Migración Drizzle aditiva.

## OAuth y seguridad

1. PanHouse mantiene su login actual; esta integración no es «Login with Google».
2. Dirección inicia `POST /api/integrations/google-drive/connect`. Origen HTTP debe coincidir con el frontend configurado cuando se envía Origin.
3. State aleatorio de 256 bits, almacenado únicamente por hash, vinculado a sesión y usuario, expira en 10 minutos y se consume atómicamente una sola vez. PKCE S256 protege además el intercambio de código.
4. Se solicita exclusivamente `https://www.googleapis.com/auth/drive.file`, con acceso offline y consentimiento explícito. No se piden openid/email/profile ni drive completo, ni se amplían scopes de forma incremental.
5. Callback exacto de desarrollo: `http://localhost:3000/api/auth/google/callback`. Requiere sesión y rol originales, valida/consume state antes del intercambio. Nunca devuelve código/tokens a React.
6. Se comprueba el scope concedido y se valida la cuenta con una llamada real a Drive. El refresh token se cifra con AES-256-GCM, IV aleatorio y AAD por propósito. La clave de 32 bytes base64 está fuera de la DB. Un tag modificado o una clave incorrecta falla de forma cerrada.
7. Si Google omite refresh token, solo se conserva el anterior cuando pertenece al mismo cliente OAuth y a la misma cuenta comprobada con Drive; también se verifica que el token anterior sigue funcionando. Si no hay uno utilizable, se pide reconectar con consentimiento. Nunca se reemplaza por NULL.
8. Desconexión/reconexión incrementan una revisión. Un intento OAuth anterior no puede reactivar una integración desconectada mientras se autorizaba en Google.
9. El cliente oficial obtiene access tokens desde el refresh token y los renueva automáticamente. Access tokens permanecen solo en memoria de la operación.

Los logs HTTP omiten la query del callback, que contiene código y state. Errores Google se traducen a códigos/mensajes permitidos; nunca se registran objetos Gaxios, cuerpos de token exchange, códigos, tokens ni ciphertext completo. Los endpoints solo devuelven DTOs seguros y el callback redirige a una URL frontend fija con un indicador permitido.

## Configuración sin secretos versionados

```dotenv
GOOGLE_CLIENT_ID=<client-id-del-cliente-web>
GOOGLE_CLIENT_SECRET=<secreto-local>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_DRIVE_SCOPE=https://www.googleapis.com/auth/drive.file
GOOGLE_TOKEN_ENCRYPTION_KEY=<32-bytes-aleatorios-en-base64>
APP_FRONTEND_URL=http://localhost:5173
```

Sin configuración completa el servidor conserva las demás funciones; el módulo responde `Google Drive integration is not configured.` No imprime valores de configuración. `.env.example` solo contiene placeholders. La clave debe mantenerse estable y respaldada mediante gestión de secretos: perderla obliga a reconectar. Rotarla requiere una migración explícita de cifrado, no reemplazarla en cada arranque.

## Operaciones y smoke test

- GET `/api/integrations/google-drive/status`: estado persistido seguro; no confunde token existente con validación real.
- POST `/api/integrations/google-drive/connect`: URL OAuth de Google generada por backend.
- GET `/api/auth/google/callback`: callback de integración, no autenticación PanHouse.
- POST `/api/integrations/google-drive/test`: valida, crea raíz `PANHOUSE_API_TEST_<sufijo>`, crea `Prueba API`, lista hija y consulta metadata, y limpia ambos objetos en `finally`.
- POST `/api/integrations/google-drive/disconnect`: intenta revocar en Google, inutiliza el refresh token local y audita. No borra archivos de Drive.

Las raíces de prueba llevan appProperties de propósito y nombre controlado; nunca se usa una carpeta editorial real ni un nombre de autor. Un recorrido posterior puede recuperar raíces de prueba huérfanas de la misma aplicación. Se reporta explícitamente cualquier fallo de cleanup, sin dar éxito falso. Operaciones corporativas se serializan con lock transaccional no bloqueante; llamadas externas tienen timeout. Conexión: máximo cinco intentos por usuario en diez minutos. Prueba: cooldown de diez segundos. Los intentos expirados hace más de 24 horas se purgan al iniciar nuevas conexiones. Las mutaciones auditan de forma transaccional sin secretos.

### Inspección visual explícita

`node --import tsx scripts/google-drive-visual-smoke.ts`, con `PANHOUSE_DRIVE_ACTOR_ID` de un usuario activo de Dirección, ejecuta el mismo servicio real y pausa antes del `finally` de limpieza. No es parte de `npm test`. Deja únicamente metadata no sensible en `%TEMP%/panhouse-drive-smoke/inspection.json`: URL/ID de raíz y subcarpeta. Abrir la raíz en el Drive de la cuenta autorizada permite verificar visualmente «Prueba API». Crear `%TEMP%/panhouse-drive-smoke/cleanup.signal` continúa la limpieza; si no se crea, continúa automáticamente tras 180 segundos. `result.json` registra resultado y confirmación de cleanup. La ruta HTTP normal siempre limpia inmediatamente. Si se interrumpe forzosamente el proceso, repetir la prueba recupera las raíces etiquetadas.

## UI y verificación

Ruta `/configuracion/integraciones/google-drive`, accesible desde la cuenta de Dirección. Muestra estado/cuenta cuando existe/alcance/última verificación, conexión, prueba y desconexión con confirmación. React no conoce secretos ni guarda tokens Google en storage o cookies.

Tests normales mockean gateway/SDK: cifrado, state, RBAC, scope, refresh ausente, adapter, errores y rutas sin Internet. Smoke real únicamente por acción administrativa explícita. OAuth manual requiere que la persona autorizada elija y autorice su cuenta corporativa; nunca se sustituye por mocks para declarar la conexión real.

Se validó manualmente el flujo en el Workspace corporativo el 16 de octubre de 2026. La prueba visual descubrió que metadata puede permanecer brevemente visible tras un delete exitoso: la confirmación ahora realiza reintentos acotados (250/500/1000/2000 ms), exige 404 y trata de eliminar hija y raíz independientemente. El reporte y las evidencias diferencian fixtures UI de operaciones Google reales.

Por solicitud explícita del usuario se aprovisionó `admin@panhouse.local`, nombre «Administrador PanHouse», con el rol administrativo existente `direccion`. No se inventó un enum admin ni se amplió el RBAC de otros módulos. La contraseña aleatoria se guarda únicamente en `secrets/panhouse-admin.local.json`, excluido de Git; PostgreSQL conserva Argon2id. `scripts/create-local-admin.ts` permite provisionar esa cuenta local sin sobrescribir cuentas/contraseñas existentes y rechaza entornos ajenos a development.

## Despliegue interno y fase 2

El backend interno solo necesita salida HTTPS hacia OAuth/Drive de Google, PostgreSQL y una clave de cifrado fuera de DB. Producción configura callback HTTPS registrado en Google y frontend permitido; no hay dependencia de alojar PanHouse en Google Cloud. `drive.file` permite operar archivos gestionados por la app; explorar indiscriminadamente el Drive corporativo queda fuera de este alcance.

Fase 2 definirá `createProjectWorkspace` según servicio y manual del Especialista, entregables/versiones y su ownership. No se adelantan carpetas de autor, auto-creación por asignación, Picker, freelancers, sincronización, webhooks ni detección de cambios.

## Referencias oficiales

- [Cliente oficial Node y submódulos](https://github.com/googleapis/google-api-nodejs-client)
- [OAuth para aplicaciones web](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Alcances Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Drive about.get](https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get)
