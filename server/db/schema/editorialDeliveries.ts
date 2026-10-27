import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';
import { users } from './users.js';
import { workItems } from './workItems.js';

// Metadata only: Drive retains the file; PanHouse retains its delivery meaning.
// New deliveries require a verified Drive file ID belonging to the project's
// persisted workspace. driveFileId remains nullable only for legacy rows.
// Each feedback cycle can create a new version. The command serializes on the
// project/work item and returns the completed cycle's existing delivery on retry.
export const editorialDeliveries = pgTable('editorial_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  workItemId: uuid('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }),
  driveUrl: text('drive_url').notNull(),
  driveFileId: text('drive_file_id'),
  observaciones: text('observaciones'),
  submittedBy: uuid('submitted_by').notNull().references(() => users.id),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
});
