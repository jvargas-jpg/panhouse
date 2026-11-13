import { ROLES, type Rol } from '../../shared/roles.js';

// Compatibility debt ONLY: the historical PostgreSQL enum and notification
// destinations still store this value. It is never a business role/context.
const LEGACY_VALIDATOR_ROLE = 'soporte_editorial';
type StorageRole = Exclude<Rol, 'validador'> | typeof LEGACY_VALIDATOR_ROLE;
export const STORAGE_ROLES = ROLES.map(roleToStorage) as [StorageRole, ...StorageRole[]];
export function roleFromStorage(value: string): string {
  return value === LEGACY_VALIDATOR_ROLE ? 'validador' : value;
}
export function roleToStorage(value: string): StorageRole {
  return (value === 'validador' ? LEGACY_VALIDATOR_ROLE : value) as StorageRole;
}

// Only generated legacy actor prefixes are normalized; the legitimate work
// context "Soporte Editorial · Revisión de cubierta" remains unchanged.
export function notificationMessageFromStorage(value: unknown): string {
  return String(value).replace(/^Soporte Editorial (reportó|canceló|completó)/u, 'El Validador $1');
}

// Public column codecs preserve the original PgEnum/text column and DDL.
// Applies to selects, relational queries, inserts, updates and bound filters.
export function bindRoleCompatibility(column: {
  mapFromDriverValue: (value: any) => any;
  mapToDriverValue: (value: any) => any;
}) {
  column.mapFromDriverValue = roleFromStorage;
  column.mapToDriverValue = roleToStorage;
}

// Raw SQL projections and historical audit JSON bypass column codecs.
// Normalize those at the HTTP boundary too, without rewriting history.
export function publicRoleData(value: unknown): unknown {
  if (typeof value === 'string') return roleFromStorage(value);
  if (Array.isArray(value)) return value.map(publicRoleData);
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [roleFromStorage(key), publicRoleData(item)]));
}

// Use only for raw SQL role projections; never interpolate user input here.
export const publicRoleSql = (column: string) => `CASE WHEN ${column}::text='${LEGACY_VALIDATOR_ROLE}' THEN 'validador' ELSE ${column}::text END`;
