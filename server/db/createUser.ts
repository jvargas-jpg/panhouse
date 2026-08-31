import { eq } from 'drizzle-orm';
import { hashPassword } from '../helpers/password.js';
import { db, pool } from './client.js';
import { autores, ROLES, users } from './schema/index.js';

// Provisión manual de cuentas mientras no exista el flujo real de
// alta/baja de usuarios (RF pendiente): POST /api/auth/register ya no
// existe — crear cuentas de equipo o de autor no puede ser un
// formulario público, ver server/routes/auth.routes.ts.
//
// Uso:
//   NUEVA_CONTRASENA=algo-seguro npm run db:create-user -- correo@ejemplo.com "Nombre Apellido" rol [autorId]
//
// autorId es el 5º argumento, opcional, solo tiene efecto con rol
// 'autor' (ver users.autorId en server/db/schema/users.ts) — vincula la
// cuenta de login con la entidad autores cuyos libros va a ver en el
// Portal del Autor. Sin esto, una cuenta 'autor' recién creada no
// tendría libros que mostrar (GET /proyectos/mis-libros la rechazaría).
//
// La contraseña va por variable de entorno, no por argumento, para no
// dejarla en el historial de la terminal.
async function main() {
  const [email, nombre, rol, autorId] = process.argv.slice(2);
  const password = process.env.NUEVA_CONTRASENA;

  if (!email || !nombre || !rol || !password) {
    console.error('Uso: NUEVA_CONTRASENA=algo-seguro npm run db:create-user -- correo@ejemplo.com "Nombre Apellido" rol [autorId]');
    console.error(`Roles válidos: ${ROLES.join(', ')}`);
    process.exit(1);
  }

  if (!(ROLES as readonly string[]).includes(rol)) {
    console.error(`Rol inválido: "${rol}". Roles válidos: ${ROLES.join(', ')}`);
    process.exit(1);
  }

  if (autorId && rol !== 'autor') {
    console.error(`autorId solo aplica con rol 'autor' (se recibió rol "${rol}").`);
    process.exit(1);
  }

  const existente = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existente) {
    console.error(`Ya existe un usuario con el correo ${email}.`);
    process.exit(1);
  }

  if (autorId) {
    const autorExiste = await db.query.autores.findFirst({ where: eq(autores.id, autorId) });
    if (!autorExiste) {
      console.error(`No existe ningún autor con id ${autorId}.`);
      process.exit(1);
    }
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, nombre, rol: rol as (typeof ROLES)[number], autorId: autorId || undefined })
    .returning({ id: users.id, email: users.email, nombre: users.nombre, rol: users.rol, autorId: users.autorId });

  console.log('Usuario creado:', user);
  await pool.end();
}

main().catch((err) => {
  console.error('Error creando el usuario:', err);
  process.exit(1);
});
