import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import type { Tx } from './tx.js';
import type { FinancialList, FinancialProject } from '../../shared/pagos.js';

// Única proyección financiera. Postgres numeric conserva los decimales; el
// frontend recibe strings. No se suman monedas distintas, ni cuotas booleanas.
export const FINANCIAL_CTE = sql.raw(`WITH totals AS (
 SELECT proyecto_id, moneda, sum(monto) FILTER (WHERE estatus='Verificado') paid,
 count(*) FILTER (WHERE estatus='Pendiente de verificación')::int pending,
 max(fecha_pago) FILTER (WHERE estatus='Verificado') last_payment
 FROM pagos WHERE estatus<>'Anulado' AND estatus<>'Rechazado' GROUP BY proyecto_id,moneda
), currencies AS (
 SELECT proyecto_id, count(*) n, min(moneda) currency, sum(pending)::int pending FROM totals GROUP BY proyecto_id
), authors AS (
 SELECT pa.proyecto_id,string_agg(a.nombre,' · ' ORDER BY a.nombre) nombres
 FROM proyectos_autores pa JOIN autores a ON a.id=pa.autor_id GROUP BY pa.proyecto_id
), base AS (
 SELECT p.id,p.codigo,coalesce(nullif(p.titulo_definitivo,''),nullif(p.titulo,''),coalesce(a.nombres,ap.nombre)) proyecto,
 coalesce(a.nombres,ap.nombre) autor,p.servicio_id "servicioId",s.nombre servicio,p.estado,
 p.monto_contractual contract,coalesce(p.moneda_contractual,CASE WHEN c.n=1 THEN c.currency END) currency,
 coalesce(t.paid,0) paid,coalesce(c.pending,0) pending,p.solvencia_estado solvency,
 p.gate_financiero_requerido required,
 EXISTS(SELECT 1 FROM work_items w WHERE w.proyecto_id=p.id AND w.estado IN ('pendiente','en_progreso','bloqueado')
 AND (w.tipo='soporte_digital' OR w.gate_bloqueante='FINANCIAL_SOLVENCY')) gate_active,
 coalesce(c.n>1 OR (p.moneda_contractual IS NOT NULL AND c.currency<>p.moneda_contractual),false) mismatch,
 t.last_payment
 FROM proyectos p JOIN autores ap ON ap.id=p.autor_id JOIN servicios s ON s.id=p.servicio_id
 LEFT JOIN authors a ON a.proyecto_id=p.id LEFT JOIN currencies c ON c.proyecto_id=p.id
 LEFT JOIN totals t ON t.proyecto_id=p.id AND t.moneda=coalesce(p.moneda_contractual,CASE WHEN c.n=1 THEN c.currency END)
), financial AS (
 SELECT id,codigo,proyecto,autor,"servicioId",servicio,estado,contract::text "contractAmount",currency,
 CASE WHEN mismatch THEN NULL ELSE paid::numeric(20,2)::text END "confirmedPaid",
 CASE WHEN mismatch OR contract IS NULL THEN NULL ELSE greatest(contract-paid,0)::numeric(20,2)::text END "pendingAmount",
 CASE WHEN NOT mismatch AND contract>0 THEN round(paid/contract*100,2)::text END "paidPercentage",
 CASE WHEN mismatch THEN 'Revisar moneda' WHEN contract IS NULL THEN 'Sin monto contractual'
 WHEN paid>contract THEN 'Sobrepago' WHEN paid=0 THEN 'Sin pagos' WHEN paid=contract THEN 'Pagado' ELSE 'Parcial' END "paymentStatus",
 solvency "solvencyStatus",required "gateRequired",(NOT required OR solvency='Solvente') "gateSatisfied",
 CASE WHEN NOT required THEN 'No aplicable' WHEN solvency='Solvente' THEN 'Liberado' ELSE 'Bloqueado' END "financialGateStatus",
 (required AND solvency<>'Solvente' AND gate_active) "gateAffectingWorkflow",last_payment::text "lastPayment",
 pending "pendingPayments",mismatch "currencyMismatch"
 FROM base
)`);

export async function getProjectFinancialStatus(id: string, client: typeof db | Tx = db): Promise<FinancialProject | undefined> {
  const r = await client.execute(sql`${FINANCIAL_CTE} SELECT * FROM financial WHERE id=${id}::uuid`);
  return r.rows[0] as unknown as FinancialProject | undefined;
}

export interface FinancialFilters {
  search?: string; service?: string; paymentStatus?: string; dateFrom?: string; dateTo?: string;
  tab?: string; page: number; pageSize: number; sort?: string; includeInactive?: boolean;
}
export async function listFinancialProjects(f: FinancialFilters): Promise<FinancialList> {
  const conditions = [sql`true`];
  if (!f.includeInactive) conditions.push(sql`estado NOT IN ('retirado','culminado')`);
  if (f.search) {
    const term = `%${f.search.replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(sql`(autor ILIKE ${term} OR proyecto ILIKE ${term} OR codigo ILIKE ${term})`);
  }
  if (f.service) conditions.push(sql`"servicioId"=${f.service}::uuid`);
  if (f.paymentStatus) conditions.push(sql`"paymentStatus"=${f.paymentStatus}`);
  if (f.dateFrom) conditions.push(sql`"lastPayment">=${f.dateFrom}`);
  if (f.dateTo) conditions.push(sql`"lastPayment"<=${f.dateTo}`);
  const tabs: Record<string, ReturnType<typeof sql>> = {
    saldo: sql`"pendingAmount"::numeric>0`, pendientes: sql`"pendingPayments">0`,
    solventes: sql`"solvencyStatus"='Solvente'`, bloqueados: sql`"gateAffectingWorkflow"`,
  };
  const sort = f.sort === 'recent' ? sql`"lastPayment" DESC NULLS LAST,id`
    : sql`"gateAffectingWorkflow" DESC,("pendingPayments">0) DESC,(coalesce("pendingAmount"::numeric,0)>0) DESC,"lastPayment" DESC NULLS LAST,id`;
  const result = await db.execute(sql`${FINANCIAL_CTE}, scoped AS (SELECT * FROM financial WHERE ${sql.join(conditions, sql` AND `)}),
    filtered AS (SELECT * FROM scoped WHERE ${tabs[f.tab ?? ''] ?? sql`true`}),
    page_rows AS (SELECT * FROM filtered ORDER BY ${sort} LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize})
    SELECT coalesce((SELECT json_agg(r) FROM page_rows r),'[]') items,(SELECT count(*)::int FROM filtered) total,
    json_build_object('conSaldo',count(*) FILTER(WHERE "pendingAmount"::numeric>0),
    'porConfirmar',coalesce(sum("pendingPayments"),0),'solventes',count(*) FILTER(WHERE "solvencyStatus"='Solvente'),
    'bloqueados',count(*) FILTER(WHERE "gateAffectingWorkflow")) kpis,
    (SELECT coalesce(json_agg(x),'[]') FROM (SELECT DISTINCT "servicioId" id,servicio nombre FROM financial ORDER BY servicio) x) servicios
    FROM scoped`);
  return { ...result.rows[0], page: f.page, pageSize: f.pageSize } as unknown as FinancialList;
}

// Se llama dentro del lock del proyecto de cada escritura downstream.
export async function assertFinancialGate(tx: Tx, projectId: string) {
  const status = await getProjectFinancialStatus(projectId, tx);
  if (!status) throw Object.assign(new Error('Proyecto no encontrado'), { statusCode: 404 });
  if (!status.gateSatisfied) throw Object.assign(new Error('Comercial debe liberar la solvencia antes de entregar el paquete final o publicar'), { statusCode: 409 });
}
