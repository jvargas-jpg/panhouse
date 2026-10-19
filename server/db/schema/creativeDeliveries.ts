import {pgTable,text,timestamp,unique,uuid} from 'drizzle-orm/pg-core';
import {proyectos} from './proyectos.js';
import {users} from './users.js';
import {direccionesCreativas} from './direccionCreativa.js';
import {fichaDisenoPropuestas} from './trazabilidad.js';

// Metadata only. Existing URL fields remain the canonical inputs used by Diseño.
export const creativeDeliveries=pgTable('creative_deliveries',{
  id:uuid('id').primaryKey().defaultRandom(),
  projectId:uuid('project_id').notNull().references(()=>proyectos.id,{onDelete:'cascade'}),
  creativeProcessId:uuid('creative_process_id').notNull().references(()=>direccionesCreativas.id,{onDelete:'cascade'}),
  conceptId:uuid('concept_id').references(()=>fichaDisenoPropuestas.id,{onDelete:'cascade'}),
  type:text('type').$type<'BRIEF'|'CONCEPT_IMAGE'|'CONCEPT_PDF'>().notNull(),
  driveFileId:text('drive_file_id'),driveUrl:text('drive_url').notNull(),
  submittedBy:uuid('submitted_by').notNull().references(()=>users.id),
  submittedAt:timestamp('submitted_at',{withTimezone:true}).notNull().defaultNow(),
},t=>({delivery:unique('creative_delivery_process_type_unique').on(t.creativeProcessId,t.type)}));
