# Documento 01 — Estado Actual del Sistema (Current State Architecture)
**Proyecto:** PanHouse Gestor Editorial  
**Fecha:** Octubre 2026  
**Versión:** 1.0 Baseline  

---

## 1. Resumen Ejecutivo del Estado Actual

PanHouse Gestor Editorial es una aplicación web empresarial concebida para reemplazar el manejo manual de hojas de cálculo y formularios en el proceso de producción editorial de Grupo PanHouse. 

A la fecha de la auditoría inicial de esta rearquitectura:
- **Stack Técnico:**
  - **Frontend:** React 18, Vite 5, TypeScript 5, Tailwind CSS 3, TanStack React Query v5, React Router DOM v6, Recharts, React Simple Maps.
  - **Backend:** Node.js (>=22), Fastify v5, Zod 3, Drizzle ORM 0.38, TypeScript 5, cookies `httpOnly`.
  - **Infraestructura & Base de Datos:** PostgreSQL (con extensiones nativas `uuid-ossp`, `pg_trgm`, `unaccent`), Redis (ioredis 5), BullMQ 5 para colas de notificaciones asíncronas.
  - **Testing:** Vitest 2, Supertest 7.
- **Salud del Código (Baseline FASE 0):**
  - **TypeScript Backend (`npm run typecheck`):** 0 errores (código de salida 0).
  - **TypeScript Frontend (`npm --prefix frontend run typecheck`):** 0 errores (código de salida 0).
  - **Suite de Pruebas Automatizadas (`npm test`):** 30 archivos de prueba ejecutados, 531 tests pasando exitosamente (0 fallos).
  - **Compilación de Producción (`build`):** Compilación limpia tanto de backend (`tsc -p tsconfig.json`) como de frontend (`tsc -b && vite build`).

---

## 2. Mapa de Módulos y Código Existente

### 2.1 Backend (`server/`)
1. **Esquema de Base de Datos (`server/db/schema/`):**
   - `enums.ts`: Contiene los enums de PostgreSQL y constantes TypeScript (`ROLES`, `ESTADOS_PROYECTO`, `CAUSAS_PAUSA`, `CATEGORIAS_STAND_BY`, `TIPOS_PORTADA`, `COLECCIONES_PANHOUSE`, `SUBTIPOS_CRUDO`, `CONDICIONES_ESPECIALES`, etc.).
   - `users.ts`: Tabla `usuarios` con autenticación por contraseña (`password_hash`), rol, estado activo y vínculo opcional `autor_id` para cuentas de autor.
   - `autores.ts`: Tabla `autores` que representa a la persona física o jurídica (nombre, nombre artístico, nacionalidades array, fecha de nacimiento, redes sociales jsonb, personalidad array, ocupación, email array, teléfono, país, categoría cliente Estándar/VIP).
   - `proyectos.ts`: Tabla `proyectos` (autor principal, servicio, unidad, presupuesto, colección, asignaciones de especialista, editor, diseñador, corrector, jefe de área, código corto alfanumérico único, fechas macro, estados, hitos y cuotas de pago) y tabla de unión `proyectos_autores` para coautoría N:M.
   - `catalogos.ts`: Tablas `unidades`, `presupuestos`, `colecciones`.
   - `servicios.ts`: Tabla `servicios` con códigos (`EF`, `EEC`, `EET`, `SE`, `CR`), plazos y pesos de complejidad ponderada.
   - `fases.ts`: Tablas `fases`, `pasos`, `servicio_fases` para la configuración de etapas según servicio.
   - `capitulos.ts`: Tabla `capitulos` para el seguimiento capítulo a capítulo del proceso de edición cara al autor y cara al editor.
   - `pausas.ts`: Tabla `pausas` que audita suspensiones de proyectos (causa externa: autor u otro departamento, pausa formal con verificación de pago).
   - `pagos.ts`: Tabla `pagos` para registro financiero de cuotas por proyecto.
   - `notificaciones.ts`: Tabla `notificaciones` con destinatario por rol, mensaje y estado de lectura.
   - `trazabilidad.ts`: Tabla `fichas_trazabilidad` (1:1 con proyectos) que modela las secciones de ingreso, especificaciones contractuales, ficha editorial, matriz de ingreso RRPP, asesorías, edición, corrección, diseño, calidad, soporte digital, lanzamiento, impresión y distribución; junto a tablas hijas `ficha_calidad_fases`, `ficha_diseno_propuestas`, `ficha_lanzamiento_reuniones`, `ficha_distribucion_paises`.
   - `seguimiento.ts`: Tabla `seguimiento_fases` que mapea la matriz de control de tiempos y analistas/correctores.

2. **Rutas y Controladores (`server/routes/`):**
   - `auth.routes.ts`: Login (`/api/auth/login`), logout y `/me`. Registro público eliminado intencionalmente por seguridad.
   - `autores.routes.ts`: CRUD de autores con búsqueda y validación.
   - `proyectos.routes.ts`: Alta de proyecto, listado general, listado de activos, reasignación comercial, asignación de equipo, proyecto/riesgo, propuestas de portada y manuscrito.
   - `trazabilidad.routes.ts`: Endpoints especializados por sección para la actualización parcial y segura de cada área de la ficha de trazabilidad.
   - `capitulos.routes.ts`, `pausas.routes.ts`, `notificaciones.routes.ts`, `metricas.routes.ts`, `catalogos.routes.ts`, `usuarios.routes.ts`, `seguimiento.routes.ts`, `portal.routes.ts`.

3. **Lógica de Dominio y Helpers (`server/helpers/`):**
   - `carga.ts`: Cálculo de carga activa ponderada por peso de complejidad del servicio (`EF > EEC > EET > SE`).
   - `alertas.ts`: Determinación de proyectos en riesgo, retrasados y próximos a vencer.
   - `preparacionComercial.ts`: Evaluación unificada del readiness (`listoParaRrpp`) en base a campos comerciales y contractuales completos.
   - `portalAutor.ts`: Restricción de acceso para autores exclusivos a sus libros y ciclo de decisión de portadas.

### 2.2 Frontend (`frontend/src/`)
- **Diseño Comercial Moderno:** Se cuenta con una UI moderna en el área comercial (`frontend/src/comercial/`, `frontend/src/autores/`) caracterizada por sidebar navy oscuro (`#0b1329`), acento dorado (`#c5a059`), cards blancas, tipografía sobria y densidad enterprise.
- **Módulos Existentes:**
  - `jefatura/`: Panel de Jefatura y Registro de Seguimiento.
  - `jefeEdicion/`: Panel del Jefe de Edición y asignación de editores a proyectos sin editor.
  - `proyectos/`: Detalle del proyecto, stepper de fases, Ficha de Trazabilidad y secciones de edición/diseño/calidad.
  - `trazabilidad/`: Componentes de preparación comercial, intake y cabecera de trazabilidad.
  - `portalAutor/`: Portal dedicado para autores (entrega de manuscrito, revisión de portadas, consulta de avances).
  - `rrpp/`, `disenador/`, `editor/`, `soporteDigital/`, `soporteEditorial/`: Vistas iniciales para los distintos roles.

---

## 3. Diagnóstico de Problemas y Cuellos de Botella Detectados

1. **Persistencia de Mentalidad "Hoja de Cálculo" en el Schema:**
   - La tabla `fichas_trazabilidad` tiene más de 50 columnas planas, agrupando datos de hasta 9 departamentos distintos en una sola entidad.
   - Aunque la relación es 1 a 1 con proyectos, varios campos de fechas y estados compiten con los campos de `proyectos` o `seguimiento_fases`.
2. **Duplicación Potencial de Datos:**
   - En los Excel originales, el nombre del autor, país, fecha de ingreso, nombre del especialista, nombre del editor y fechas clave se escribían repetidamente en cada matriz.
   - En el código ya se avanzó centralizando en `autores` y `proyectos`, pero algunas vistas de RRPP y Jefatura aún mantenían campos independientes que deben consolidarse definitivamente.
3. **Flujos No Lineales Representados con Flags Planos:**
   - El paralelismo entre Dirección Creativa, Corrección, Diagramación y Soporte Digital se manejaba parcialmente con campos de fecha sueltos o booleans en la ficha, sin una abstracción de *Work Items* o tareas con responsables, dependencias y estados independientes.
4. **Roles con Interfaces Débiles o Inexistentes:**
   - Los roles de `corrector` (freelance) y `lider_creativo` no contaban con una bandeja operativa dedicada en el frontend.
   - El equipo de Calidad/Validación requería una interfaz especializada para iterar sobre las versiones de PDF sin tener que navegar por formularios densos de la ficha general.
5. **Gobernanza de Cierres y Solvencia:**
   - El bloqueo de entrega del Paquete Final dependía de verificar manualmente el color de una celda en Excel ("fondo verde"), requiriendo que Cobranzas certifique formalmente la Solvencia Administrativa en el sistema.
