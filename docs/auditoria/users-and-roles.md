# Inventario y Auditoría de Usuarios, Roles y Permisos
**Sistema:** PanHouse Gestor Editorial  
**Fecha de Auditoría:** Octubre 2026  
**Entorno:** Local / PostgreSQL Producción / Desarrollo

---

## 1. Inventario de Cuentas de Usuario en Base de Datos

Se realizó una consulta directa a la tabla `usuarios` en PostgreSQL (`SELECT id, nombre, email, rol, activo, autor_id, created_at FROM usuarios`).  
*Nota de seguridad:* No se exponen hashes de contraseñas (`password_hash`), tokens de sesión ni secretos.

| # | Nombre | Email | Rol del Sistema | Estado | Asignaciones Actuales |
|---|--------|-------|-----------------|--------|------------------------|
| 1 | Comercial Demo | `comercial.demo@panhouse.test` | `comercial` | Activo | N/A |
| 2 | RRPP Demo | `rrpp.demo@panhouse.test` | `rrpp` | Activo | N/A |
| 3 | Jefatura Demo | `jefatura.demo@panhouse.test` | `jefe_area` | Activo | N/A |
| 4 | Jefe Demo | `jefe.demo@panhouse.test` | `jefe_area` | Activo | N/A |
| 5 | Carlos Mendoza | `cmendoza@panhouse.com` | `especialista` | Activo | 0 proyectos |
| 6 | Elena Torres | `etorres@panhouse.com` | `especialista` | Activo | 0 proyectos |
| 7 | Especialista Demo | `especialista.demo@panhouse.test` | `especialista` | Activo | 0 proyectos |
| 8 | Laura Gil | `lgil@panhouse.com` | `especialista` | Activo | 0 proyectos |
| 9 | Roberto Salazar | `rsalazar@panhouse.com` | `especialista` | Activo | 1 proyecto |
| 10 | Sofia Vargas | `svargas@panhouse.com` | `especialista` | Activo | 0 proyectos |
| 11 | Jefe Edición Demo | `jefeedicion.demo@panhouse.test` | `jefe_edicion` | Activo | N/A |
| 12 | Editor Demo | `editor.demo@panhouse.test` | `editor` | Activo | 0 proyectos |
| 13 | Editor Dos Demo | `editor2.demo@panhouse.test` | `lider_creativo` | Activo | 0 proyectos |
| 14 | Diseñador Demo | `disenador.demo@panhouse.test` | `disenador` | Activo | 0 proyectos |
| 15 | Soporte Editorial Demo | `soporteeditorial.demo@panhouse.test` | `soporte_editorial` | Activo | N/A |
| 16 | Soporte Digital Demo | `soportedigital.demo@panhouse.test` | `soporte_digital` | Activo | N/A |
| 17 | Cobranzas Demo | `cobranzas.demo@panhouse.test` | `cobranzas` | Activo | N/A |
| 18 | Direccion Demo | `direccion.demo@panhouse.test` | `direccion` | Activo | N/A |

---

## 2. Mapeo entre Roles de Negocio y Roles de Sistema

| Rol del Negocio (Real) | Rol del Sistema (`rolEnum`) | Área Operativa | Responsabilidad Principal en el Flujo |
|-------------------------|----------------------------|----------------|---------------------------------------|
| Comercial / Asesor Comercial | `comercial` | Comercial | Registro de Autor, alta de Proyecto base, carga de condiciones contractuales (capítulos, páginas pactadas, condiciones especiales). |
| Relaciones Públicas (RRPP) | `rrpp` | Relaciones Públicas | Intake editorial (Ficha Editorial, subtipo Crudo Tripa/Capítulo, colección, diagnóstico), y Fase posterior (lanzamiento, eventos, ferias, aprobación de portadas). |
| Jefatura de Procesos / Jefe de Área | `jefe_area` | Producción Editorial | Distribución operativa de proyectos, evaluación de carga de especialistas, asignación formal, monitoreo de SLA, pausas y estados macro. |
| Especialista Editorial | `especialista` | Producción Editorial | Responsable operativo integral del proyecto, punto único de contacto con el autor, orquestador de hitos internos, reuniones y trazabilidad. |
| Jefatura de Edición | `jefe_edicion` | Edición | Recepción de solicitudes de editores, evaluación de carga de editores, asignación de editores. |
| Editor | `editor` | Edición | Ejecución técnica de la edición por capítulo o tripa completa (3 días/capítulo), aplicación de feedback. |
| Corrector Ortotipográfico (Freelance) | `corrector` (Mapeado operativamente / en seguimiento) | Corrección | Revisión ortotipográfica y de estilo sobre texto (5 días continuos), entrega de Word con control de cambios e informe técnico. |
| Líder Creativo / Dirección Creativa | `lider_creativo` | Creativa / Diseño | Conducción de reunión creativa (gate de título), elaboración de Brief Creativo, conceptualización de 2-3 portadas, revisión de cubierta extendida. |
| Diseñador Gráfico / Maquetador | `disenador` | Diseño | Muestra de diagramación (3 días), diagramación definitiva (5/15 días), cubierta extendida (3 días), paquete final. |
| Validador / Calidad Editorial | `soporte_editorial` | Calidad | Control de calidad en rondas sobre PDF diagramado (Fase 1, validación de aplicación de comentarios, Revisión Final Fase 3, validación final). |
| Soporte Digital / Amazon KDP | `soporte_digital` | Soporte Digital | Activación en hito de Fase 1: creación de cuenta Amazon, definición de precios/acabados, prueba de archivos, inducción y Autor Central. |
| Coordinador de Impresión | `impresion` | Impresión / Producción | Definición técnica de especificaciones de imprenta tradicional, cotizaciones de tirajes, acabados y pliegos. |
| Líder de Distribución | `distribucion` (operativo en Ficha) | Distribución | Acuerdos de distribución, porcentaje de regalías, medios y países de colocación. |
| Cobranzas / Administración | `cobranzas` | Administración | Registro de solvencia administrativa, control de cuotas 1 a 6, liberación de paquete final. |
| Talento Humano | `talento_humano` | Recursos Humanos | Contratación de correctores freelance y staff externo. |
| Dirección General / Gerencia | `direccion` | Dirección | Visión global, torre de control, métricas consolidadas e indicadores de alto nivel. |
| Autor | `autor` | Externo | Acceso al Portal del Autor: consulta de avance, entrega de manuscrito, revisión de propuestas de portada. |

---

## 3. Matriz de Permisos y Accesos por Endpoint

### 3.1 Módulo de Autores (`/api/autores`)
- `GET /api/autores`: Acceso para `comercial`, `jefe_area`, `rrpp`, `direccion`.
- `POST /api/autores`: Exclusivo de `comercial` y `jefe_area`.
- `PATCH /api/autores/:id`: Exclusivo de `comercial` y `jefe_area`.
- `DELETE /api/autores/:id`: Exclusivo de `comercial` y `jefe_area` (restringido si tiene proyectos).

### 3.2 Módulo de Proyectos (`/api/proyectos`)
- `GET /api/proyectos`: Acceso para `jefe_area`, `direccion`.
- `GET /api/proyectos/activos`: Acceso para `comercial`, `rrpp`, `cobranzas`, `jefe_area`.
- `POST /api/proyectos`: Exclusivo de `jefe_area`, `comercial`.
- `DELETE /api/proyectos/:id`: Exclusivo de `jefe_area`, `direccion`, `comercial`.
- `PATCH /api/proyectos/:id/reasignar`: Exclusivo de `comercial`, `jefe_area`.
- `PATCH /api/proyectos/:id/equipo`: Exclusivo de `jefe_area`.
- `POST /api/proyectos/:id/notificar-rrpp`: Exclusivo de `comercial` (con guardia de idempotencia `notificadoRrpp`).
- `POST /api/proyectos/:id/notificar-jefatura`: Exclusivo de `rrpp` (con guardia de idempotencia `notificadoJefatura`).
- `GET /api/proyectos/mios`: `especialista` (filtra `especialistaId`) y `editor` (filtra `editorId`).
- `GET /api/proyectos/sin-editor`: Exclusivo de `jefe_edicion`.
- `PATCH /api/proyectos/:id/especialista`: Exclusivo de `jefe_area`.
- `PATCH /api/proyectos/:id/editor`: Exclusivo de `jefe_edicion`.
- `PATCH /api/proyectos/:id/disenador`: Exclusivo del `especialista` asignado al proyecto.
- `PATCH /api/proyectos/:id/propuesta-portada`: Exclusivo del `especialista` o `disenador` asignado.
- `GET /api/proyectos/:id/riesgo`: `jefe_area`, `especialista` asignado, `editor` asignado, `disenador` asignado, `rrpp`, `comercial`, `lider_creativo`, `soporte_editorial`, `soporte_digital`.
- `PATCH /api/proyectos/:id`: Exclusivo del `especialista` asignado al proyecto (estados operativos, sin permitir `pausado` arbitrario).

### 3.3 Módulo de Portal del Autor (`/api/proyectos` + `/api/portal`)
- `GET /api/proyectos/mis-libros`: Exclusivo de rol `autor` (resuelve libros vía `users.autorId` en sesión).
- `PATCH /api/proyectos/:id/manuscrito`: Exclusivo de rol `autor` (valida propiedad del libro).
- `PATCH /api/proyectos/:id/decision-portada`: Exclusivo de rol `autor` (aprueba o rechaza con feedback obligatorio si rechaza).
- `GET /api/portal/pagos/enlace`: Exclusivo de rol `autor` (genera token JWT para portal externo).

### 3.4 Módulo de Ficha de Trazabilidad (`/api/fichas-trazabilidad`)
- `GET /api/fichas-trazabilidad/:proyectoId`: Verificación de acceso por rol y pertenencia.
- `PATCH /.../proyecto-perfil`: Exclusivo de `rrpp`, `comercial`, `jefe_area`.
- `PATCH /.../proyecto-contrato`: Exclusivo de `comercial`, `jefe_area`.
- `PATCH /.../ficha-editorial`: Exclusivo de `rrpp`, `jefe_area`.
- `PATCH /.../matriz-ingreso`: Exclusivo de `rrpp`, `jefe_area`.
- `PATCH /.../lanzamiento-promocion`: Exclusivo de `rrpp`, `jefe_area`.
- `PATCH /.../matriz-asesorias`: Exclusivo de `rrpp`, `jefe_area`.
- `PATCH /.../edicion`: Exclusivo de `especialista` asignado o `jefe_area`.
- `PATCH /.../correccion`: Exclusivo de `especialista` asignado o `jefe_area`.
- `PATCH /.../diseno-brief`: Exclusivo de `disenador`, `lider_creativo`, `jefe_area`.
- `PATCH /.../diseno-control`: Exclusivo de `disenador` asignado, `especialista` asignado o `jefe_area`.
- `POST /.../diseno/propuestas`: Exclusivo de `disenador`, `lider_creativo`, `jefe_area`.
- `PATCH /.../calidad-control`: Exclusivo de `soporte_editorial` o `especialista` asignado.
- `POST/PATCH/DELETE /.../calidad/fases`: Exclusivo de `soporte_editorial`, `jefe_area`.
- `PATCH /.../soporte-digital`: Exclusivo de `soporte_digital`, `jefe_area`.
- `PATCH /.../digital-control`: Exclusivo de `soporte_digital` o `especialista` asignado.
- `PATCH /.../impresion`: Exclusivo de `rrpp`, `jefe_area`.
- `PATCH /.../lanzamiento-control`: Exclusivo de `rrpp` o `especialista` asignado.
- `POST/PATCH/DELETE /.../lanzamiento/reuniones`: Exclusivo de `rrpp`, `jefe_area`.
- `PATCH /.../distribucion-control`: Exclusivo de `rrpp` o `especialista` asignado.

### 3.5 Módulo de Carga y Capacidad
- `GET /api/especialistas/carga`: Exclusivo de `jefe_area`, `direccion`.
- `GET /api/especialistas/:id/carga`: Exclusivo de `jefe_area`, `direccion` o del propio `especialista`.
- `GET /api/editores/carga`: Exclusivo de `jefe_edicion`, `direccion`.
- `GET /api/disenadores/carga`: Exclusivo de `especialista`, `jefe_area`, `direccion`.

### 3.6 Módulo de Pausas y Guardias Financieras
- `POST /api/pausas`: Exclusivo de `especialista` o `jefe_area`.
- Regla guardiana: Si `esPausadoFormal = true`, exige `pagoConfirmado = true` con `origenConfirmacionPago` y `confirmadoPagoPorId`. De lo contrario el backend arroja error 400 y bloquea la pausa.

---

## 4. Hallazgos de Seguridad y Vulnerabilidades Auditadas

1. **POST /api/auth/register Cerrado:**
   - Se verificó `server/routes/auth.routes.ts`. La ruta `POST /register` no existe. Las cuentas se aprovisionan únicamente por CLI (`server/db/createUser.ts`) o procesos administrativos protegidos. Cumple el requisito #75.
2. **Propiedad de Proyectos (Ownership Guard):**
   - El helper `verificarAccesoAProyecto` en `server/helpers/proyectos.ts` asegura que `especialista`, `editor` y `disenador` solo pueden leer y modificar proyectos donde su ID coincide con `especialistaId`, `editorId` o `disenadorId`.
3. **Restricción de Subtipo Crudo:**
   - La regla de negocio de que Comercial no puede definir si Crudo es Tripa o Capítulo está asegurada en el backend en `server/helpers/preparacionComercial.ts` y en `server/routes/trazabilidad.routes.ts`.
4. **Gaps de Roles sin Dashboard Propio (A resolver en la re-arquitectura):**
   - El rol `corrector` y `lider_creativo` actualmente carecen de una vista/bandeja dedicada en el frontend de React.
   - Los roles `soporte_editorial` y `soporte_digital` tienen páginas iniciales muy esquemáticas que deben convertirse en bandejas de trabajo activas orientadas a tareas (*Mis Validaciones*, *Mis Tareas de Amazon*).
