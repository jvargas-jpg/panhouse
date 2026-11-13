import { validationDeliveryOutbox } from '../db/schema/index.js';
import type { Tx } from './tx.js';
// One notice per rejected execution version. Validation decisions use their
// phase key, while author/creative feedback uses the version key in this SAME outbox.
export async function queueExternalDesignNotice(tx: Tx, design: { externalProviderEmail: string | null }, version: { id: string; numero: number }, title: string, feedback: string) {
 if (!design.externalProviderEmail) return;
 await tx.insert(validationDeliveryOutbox).values({ versionId: version.id, recipient: design.externalProviderEmail, subject: `${title}: ajustes de Diseño V${version.numero}`, message: `${feedback}\nEntrega una nueva versión V${version.numero + 1} en Versiones_para_corregir. PanHouse registrará la entrega automáticamente.` }).onConflictDoNothing();
}
