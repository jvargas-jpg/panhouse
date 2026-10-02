# Documento 08 — Plan de Migración Progresiva y Cero Pérdida de Datos
**Sistema:** PanHouse Gestor Editorial  
**Fecha:** Octubre 2026  
**Estrategia:** Aditiva de 6 Fases (Zero-Downtime, Zero Data Loss)

---

## 1. Principio Fundamental: Migración Aditiva

En cumplimiento de las reglas del proyecto:
- **NO destruir ni borrar datos históricos existentes.**
- **NO ejecutar comandos `DROP COLUMN` ni `DROP TABLE` prematuramente.**
- Seguir estrictamente el ciclo:
  $$\text{ADD} \longrightarrow \text{BACKFILL} \longrightarrow \text{MIGRATE READS} \longrightarrow \text{MIGRATE WRITES} \longrightarrow \text{VERIFY} \longrightarrow \text{DEPRECATE}$$

---

## 2. Fases de Ejecución de la Migración

### Fase 1: ADD (Ampliación Aditiva de Esquemas)
- Crear nuevas columnas en `proyectos`, `fichas_trazabilidad` o nuevas tablas (`audit_logs`) con restricciones `NULLABLE` o con valores por defecto seguros.
- No modificar el comportamiento de las columnas existentes.
- *Ejemplo de Migración Drizzle:*
  - Agregar `titulo_definitivo` y `subtitulo_definitivo` en `proyectos`.
  - Agregar `solvencia_administrativa` (`boolean default false`) en `proyectos`.
  - Agregar tabla `audit_logs` con FK hacia `proyectos`.

### Fase 2: BACKFILL (Poblado de Datos Históricos)
- Escribir scripts idempotentes de backfill para poblar los nuevos campos a partir de datos ya existentes.
- *Casos de Backfill:*
  - Si un proyecto histórico en `fichas_trazabilidad` tiene `posibleTituloLibro` y su estado es `culminado`, respaldar dicho título en `tituloDefinitivo`.
  - Poblar la tabla de unión `proyectos_autores` asegurando que todo proyecto existente tenga al menos una fila vinculada con su `autor_id` principal.
  - Asegurar que todo proyecto cuente con una fila asociada en `fichas_trazabilidad`.

### Fase 3: MIGRATE READS (Lectura desde la Fuente Canónica)
- Actualizar los endpoints de lectura (`GET /api/proyectos`, `GET /api/proyectos/:id/riesgo`, `GET /api/proyectos/activos`, `GET /api/metricas/*`) para que lean los datos directamente de su entidad canónica única (vía `JOIN`).
- Los dashboards y tablas en el frontend consumen la entidad canónica proyectada.
- Las vistas de Matriz IA, Matriz Editores y Matriz RRPP se transforman en consultas sobre `proyectos` + `autores` + `fichas_trazabilidad` en lugar de requerir tablas separadas.

### Fase 4: MIGRATE WRITES (Centralización de la Escritura)
- Actualizar los endpoints y formularios de escritura para que apunten exclusivamente a la fuente de verdad.
- Al editar un Especialista desde el panel de Jefatura, se ejecuta un único `UPDATE proyectos SET especialista_id = ...` y se inserta el evento en `audit_logs`.
- Todas las demás pantallas leen este cambio inmediatamente sin necesidad de sincronizaciones batch.

### Fase 5: VERIFY (Validación y Testing Integral)
- Ejecutar la suite completa de pruebas:
  - Tests unitarios y de integración (`npm test`).
  - Tests de contratos y validación de esquemas Zod.
  - Verificación de consistencia de datos en PostgreSQL con consultas de control (0 huérfanos, 0 referencias nulas en campos obligatorios).
- Verificar compatibilidad visual y responsiva en frontend.

### Fase 6: DEPRECATE (Depreciación Segura)
- Marcar campos legacy como inactivos en código y documentación.
- No eliminarlos de la base de datos hasta que se cumpla un ciclo completo de release y auditoría de respaldos.

---

## 3. Plan de Rollback (Contingencia)
- Como todas las migraciones en Fases 1 a 4 son puramente aditivas, un rollback a nivel de código de aplicación no requiere revertir la base de datos: el código anterior puede continuar funcionando leyendo sus columnas habituales sin que las nuevas columnas interfieran.
- Toda operación de migración en la base de datos se realiza dentro de transacciones DDL de PostgreSQL (`BEGIN ... COMMIT`).
