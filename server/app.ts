import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { autoresRoutes } from './routes/autores.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { capitulosRoutes } from './routes/capitulos.routes.js';
import { catalogosRoutes } from './routes/catalogos.routes.js';
import { disenadoresRoutes } from './routes/disenadores.routes.js';
import { editoresRoutes } from './routes/editores.routes.js';
import { especialistasRoutes } from './routes/especialistas.routes.js';
import { pagosRoutes } from './routes/pagos.routes.js';
import { pausasRoutes } from './routes/pausas.routes.js';
import { portalRoutes } from './routes/portal.routes.js';
import { proyectosRoutes } from './routes/proyectos.routes.js';
import { seguimientoRoutes } from './routes/seguimiento.routes.js';
import { trazabilidadRoutes } from './routes/trazabilidad.routes.js';
import { usuariosRoutes } from './routes/usuarios.routes.js';

export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  app.register(cookie);

  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(autoresRoutes, { prefix: '/api/autores' });
  app.register(catalogosRoutes, { prefix: '/api/catalogos' });
  app.register(proyectosRoutes, { prefix: '/api/proyectos' });
  app.register(especialistasRoutes, { prefix: '/api/especialistas' });
  app.register(editoresRoutes, { prefix: '/api/editores' });
  app.register(disenadoresRoutes, { prefix: '/api/disenadores' });
  app.register(pausasRoutes, { prefix: '/api/pausas' });
  app.register(capitulosRoutes, { prefix: '/api/capitulos' });
  app.register(trazabilidadRoutes, { prefix: '/api/fichas-trazabilidad' });
  app.register(portalRoutes, { prefix: '/api/portal' });
  app.register(usuariosRoutes, { prefix: '/api/usuarios' });
  app.register(seguimientoRoutes, { prefix: '/api/seguimiento' });
  app.register(pagosRoutes, { prefix: '/api/pagos' });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
