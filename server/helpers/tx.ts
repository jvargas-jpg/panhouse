import { db } from '../db/client.js';

// Tipo de la transacción Drizzle inferido desde `db.transaction` — así
// las piezas reutilizables de Fase 2 (auditLog.ts, assignments.ts,
// workItems.ts) pueden aceptar `tx` como parámetro y componerse dentro
// de una única transacción (ej. asignarEspecialista: cerrar assignment
// anterior + crear uno nuevo + log de auditoría + notificación, todo
// atómico) en vez de cada una abriendo su propia transacción.
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
