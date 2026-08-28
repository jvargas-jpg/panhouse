import { and, eq, ne } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema/index.js';

export interface UsuarioEquipo {
  id: string;
  nombre: string;
  rol: string;
}

// Personal de la editorial para llenar los selectores de asignación
// (SeccionEquipo.tsx — "Escuadrón de Producción"). `autor` no es
// personal interno (son usuarios externos con acceso al portal de
// pagos, ver server/routes/portal.routes.ts) — se excluye. Solo cuentas
// activas: una cuenta desactivada no debería poder recibir asignaciones
// nuevas, aunque ya tenga proyectos asignados de antes.
export function listarUsuarios(): Promise<UsuarioEquipo[]> {
  return db
    .select({ id: users.id, nombre: users.nombre, rol: users.rol })
    .from(users)
    .where(and(eq(users.activo, true), ne(users.rol, 'autor')));
}
