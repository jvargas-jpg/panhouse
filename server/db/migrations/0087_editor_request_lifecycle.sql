ALTER TABLE solicitudes_area DROP CONSTRAINT solicitudes_area_tipo_check;
--> statement-breakpoint
ALTER TABLE solicitudes_area ADD CONSTRAINT solicitudes_area_tipo_check CHECK(tipo IN ('lanzamiento','impresion','creativa','editor'));
--> statement-breakpoint
-- Preserve the public native request IDs and originating facts. Reading an inbox never writes.
-- The work item keeps its execution lifecycle; the existing handoff table owns the decision.
INSERT INTO solicitudes_area (id,proyecto_id,work_item_id,tipo,business_key,requested_by_id,estado,requested_at,resolved_at,resolved_by_id,outcome)
SELECT w.id,w.proyecto_id,w.id,'editor',w.business_key,pedido.actor_id,
 CASE WHEN resolved.id IS NOT NULL THEN 'resuelta' WHEN w.estado='cancelado' THEN 'cancelada' ELSE 'pendiente' END,
 pedido.created_at,resolved.asignado_en,resolved.asignado_por_id,
 CASE WHEN resolved.id IS NOT NULL THEN 'EDITOR_ASIGNADO' END
FROM work_items w
JOIN LATERAL (SELECT a.actor_id,a.created_at FROM audit_logs a WHERE a.entity_id=w.id AND a.accion='EDITOR_SOLICITADO' AND a.actor_id IS NOT NULL ORDER BY a.created_at,a.id LIMIT 1) pedido ON true
LEFT JOIN LATERAL (SELECT pa.id,pa.asignado_en,pa.asignado_por_id FROM project_assignments pa WHERE pa.proyecto_id=w.proyecto_id AND pa.tipo='editor' AND pa.work_item_id IS NULL AND pa.asignado_en>=pedido.created_at ORDER BY pa.asignado_en,pa.id LIMIT 1) resolved ON true
WHERE w.tipo='edicion'
ON CONFLICT DO NOTHING;
