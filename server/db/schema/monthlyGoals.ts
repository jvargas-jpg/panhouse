import { sql } from 'drizzle-orm';
import { check, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';
import { users } from './users.js';
import { workItems } from './workItems.js';
import type { GoalSource, GoalType, GoalBaseStatus, GoalEvidence } from '../../../shared/monthlyGoals.js';

export const monthlyGoals = pgTable('monthly_goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  specialistId: uuid('specialist_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  projectId: uuid('project_id').references(() => proyectos.id, { onDelete: 'restrict' }),
  periodYear: integer('period_year').notNull(),
  periodMonth: integer('period_month').notNull(),
  source: text('source').$type<GoalSource>().notNull(),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  description: text('description'),
  goalType: text('goal_type').$type<GoalType>().notNull(),
  targetProcess: text('target_process'),
  targetWorkItemId: uuid('target_work_item_id').references(() => workItems.id, { onDelete: 'restrict' }),
  targetDate: date('target_date').notNull(),
  status: text('status').$type<GoalBaseStatus>().notNull().default('ACTIVO'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedByUserId: uuid('completed_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
  evidence: jsonb('evidence').$type<GoalEvidence>(),
  resultContext: text('result_context'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: text('cancel_reason'),
  idempotencyKey: uuid('idempotency_key').notNull(),
  requestHash: text('request_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, t => ({
  period: index('monthly_goals_period_specialist_idx').on(t.periodYear, t.periodMonth, t.specialistId),
  project: index('monthly_goals_project_status_idx').on(t.projectId, t.status),
  retry: uniqueIndex('monthly_goals_creator_retry_idx').on(t.createdByUserId, t.idempotencyKey),
  validPeriod: check('monthly_goals_valid_period', sql`${t.periodMonth} between 1 and 12 and ${t.periodYear} between 2000 and 2200`),
  validSource: check('monthly_goals_valid_source', sql`${t.source} in ('JEFATURA','ESPECIALISTA')`),
  validStatus: check('monthly_goals_valid_status', sql`${t.status} in ('ACTIVO','CUMPLIDO','NO_CUMPLIDO','CANCELADO')`),
  validType: check('monthly_goals_valid_type', sql`(${t.goalType}='GENERAL' and ${t.targetProcess} is null and ${t.targetWorkItemId} is null) or (${t.projectId} is not null and ((${t.goalType}='CIERRE_PROYECTO' and ${t.targetProcess} is null and ${t.targetWorkItemId} is null) or (${t.goalType}='ALCANZAR_PROCESO' and ${t.targetProcess} is not null and ${t.targetWorkItemId} is null) or (${t.goalType}='ALCANZAR_HITO' and ${t.targetWorkItemId} is not null and ${t.targetProcess} is null)))`),
  validCancellation: check('monthly_goals_valid_cancellation', sql`${t.status}<>'CANCELADO' or (${t.cancelledAt} is not null and length(trim(${t.cancelReason}))>0)`),
  validCompletion: check('monthly_goals_valid_completion', sql`${t.status}<>'CUMPLIDO' or (${t.completedAt} is not null and ${t.evidence} is not null)`),
}));
