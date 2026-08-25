# Panhouse Gestor Editorial — backend

Esqueleto inicial del backend. Node 22 + TypeScript + Fastify + Drizzle
ORM (Postgres) + BullMQ (Redis) + argon2 + sesión en cookie httpOnly.

## Requisitos

- Node.js 22+
- Docker y Docker Compose (solo para Postgres y Redis en desarrollo)

## Levantar el entorno local

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate   # genera el SQL de migración a partir del esquema
npm run db:migrate    # aplica las migraciones a la base de datos
npm run db:seed       # siembra catálogos base (unidades, presupuestos, servicios)
npm run dev            # levanta la API con recarga en caliente
```

La API queda en `http://localhost:3000` (o el puerto que configures en
`PORT`). El worker de BullMQ se levanta aparte, en otra terminal:

```bash
npm run worker
```

Ambos (`dev` y `worker`) corren fuera de Docker; solo Postgres y Redis
están containerizados, para iterar rápido.

## Variables de entorno

Ver [.env.example](.env.example). Los puertos de Postgres y Redis
(`POSTGRES_PORT`, `REDIS_PORT`) son configurables para no chocar con
otros contenedores que ya tengas corriendo. `DATABASE_URL` y `REDIS_URL`
deben mantenerse en sincronía manualmente con esos valores.

## Migraciones

El esquema vive en [server/db/schema/](server/db/schema/). Tras
modificarlo:

```bash
npm run db:generate   # crea el archivo SQL en server/db/migrations
npm run db:migrate    # lo aplica
```

## Tests

```bash
npm test
```

Los tests corren contra una base de datos separada
(`<POSTGRES_DB>_test`), creada automáticamente por Docker la primera vez
que se levanta el contenedor de Postgres (ver
[docker/postgres-init/01-create-test-db.sh](docker/postgres-init/01-create-test-db.sh)).
Si ya tenías el volumen de Postgres creado antes de este cambio, créala
a mano una vez:

```bash
docker compose exec postgres createdb -U panhouse panhouse_test
```

`npm test` migra automáticamente esa base antes de correr la suite
(`tests/globalSetup.ts`) y trunca las tablas entre cada test.

## Estructura

```
server/
  routes/       endpoints Fastify
  middleware/   requireAuth / requireRole (verificación siempre en servidor)
  helpers/      password, sesión, validación, reglas de negocio (pausas)
  services/     integraciones externas — MOCK hasta tener credenciales
  queue/        BullMQ (conexión, colas, workers)
  db/
    schema/     definición Drizzle (una tabla = un archivo)
    migrations/ SQL generado por drizzle-kit
```

## Pendiente (fuera de alcance de este esqueleto)

- Integraciones reales de Google Drive, WhatsApp, Claude y transcripción
  (hoy son mocks en `server/services/`, a la espera de credenciales).
- Definición detallada de la ficha de trazabilidad (hoy es un JSON
  flexible en `fichas_trazabilidad`).
- Fases y pasos específicos del proceso editorial: se cargan como datos
  en `fases`, `pasos` y `servicio_fases`, nunca hardcodeados en código.
