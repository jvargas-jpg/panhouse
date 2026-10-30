export const METODOS_PAGO = ['Transferencia', 'Zelle', 'Tarjeta', 'Efectivo', 'Otro'] as const;
export const ROLES_LECTURA_PAGOS = ['comercial', 'rrpp', 'jefe_area', 'direccion', 'admin'] as const;
// Etapa actual: Comercial declara lo recibido y decide la solvencia.
// Admin conserva intervención justificada; Cobranzas queda para una etapa futura.
export const ROLES_REGISTRO_PAGOS = ['comercial', 'admin'] as const;
export const ROLES_CONFIRMACION_PAGOS = ['comercial', 'admin'] as const;
export interface FinancialProject {
  id: string; codigo: string; proyecto: string; autor: string; servicioId: string; servicio: string; estado: string;
  contractAmount: string | null; currency: string | null; confirmedPaid: string | null; pendingAmount: string | null;
  paidPercentage: string | null; paymentStatus: string; solvencyStatus: string;
  financialGateStatus: 'Liberado' | 'Bloqueado' | 'No aplicable'; gateSatisfied: boolean; gateRequired: boolean;
  gateAffectingWorkflow: boolean; lastPayment: string | null; pendingPayments: number; currencyMismatch: boolean;
}
export interface PaymentHistory {
  id: string; proyectoId: string; monto: string; moneda: string; fechaPago: string; metodoPago: string;
  referencia: string | null; notas: string | null; estatus: string; motivoRechazo: string | null;
  registradoPor: string | null; registradoEn: string; confirmadoPor: string | null; confirmadoEn: string | null;
  anuladoPor: string | null; anuladoEn: string | null; motivoAnulacion: string | null;
  origen: string; tieneComprobante: boolean;
}
export interface FinancialDetail extends FinancialProject {
  revision: string;
  payments: PaymentHistory[]; historyTotal: number; historyPage: number;
  financialNotes: string | null; solvencyBy: string | null; solvencyAt: string | null;
  auditSummary: { accion: string; fecha: string; actor: string | null }[];
}
export interface FinancialList {
  items: FinancialProject[]; total: number; page: number; pageSize: number;
  kpis: { conSaldo: number; porConfirmar: number; solventes: number; bloqueados: number };
  servicios: { id: string; nombre: string }[];
}
