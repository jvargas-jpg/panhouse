import { disenoRoutes } from './routes/diseno.routes.js';
import { calidadRoutes } from './routes/calidad.routes.js';
import { soporteDigitalHomeRoutes } from './routes/soporteDigitalHome.routes.js';
import { soporteDigitalWorkRoutes } from './routes/soporteDigitalWork.routes.js';
import { soporteDigitalRequestsRoutes } from './routes/soporteDigitalRequests.routes.js';
import { projectCommandCenterRoutes } from './routes/projectCommandCenter.routes.js';
import { especialistaInicioRoutes } from './routes/especialistaInicio.routes.js';
import { especialistaCarteraRoutes } from './routes/especialistaCartera.routes.js';
import { especialistaSolicitudesRoutes } from './routes/especialistaSolicitudes.routes.js';
import { especialistaMiTrabajoRoutes } from './routes/especialistaMiTrabajo.routes.js';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { autoresRoutes } from './routes/autores.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { capitulosRoutes } from './routes/capitulos.routes.js';
import { catalogosRoutes } from './routes/catalogos.routes.js';
import { correccionesRoutes } from './routes/correcciones.routes.js';
import { decisionesRoutes } from './routes/decisiones.routes.js';
import { indicadoresJefaturaRoutes } from './routes/indicadoresJefatura.routes.js';
import { direccionCreativaRoutes } from './routes/direccionCreativa.routes.js';
import { disenadoresRoutes } from './routes/disenadores.routes.js';
import { editorRoutes } from './routes/editor.routes.js';
import { editoresRoutes } from './routes/editores.routes.js';
import { editorialChiefRoutes } from './routes/editorialChief.routes.js';
import { especialistasRoutes } from './routes/especialistas.routes.js';
import { metricasRoutes } from './routes/metricas.routes.js';
import { notificacionesRoutes } from './routes/notificaciones.routes.js';
import { pagosRoutes } from './routes/pagos.routes.js';
import { pausasRoutes } from './routes/pausas.routes.js';
import { portalRoutes } from './routes/portal.routes.js';
import { proyectosRoutes } from './routes/proyectos.routes.js';
import { seguimientoRoutes } from './routes/seguimiento.routes.js';
import { trazabilidadRoutes } from './routes/trazabilidad.routes.js';
import { fichaVivaRoutes } from './routes/fichaViva.routes.js';
import { usuariosRoutes } from './routes/usuarios.routes.js';
import { rrppRoutes } from './routes/rrpp.routes.js';
import { rrppLanzamientosRoutes } from './routes/rrppLanzamientos.routes.js';
import { jefaturaRoutes } from './routes/jefatura.routes.js';
import { operacionEspecialistaRoutes } from './routes/operacionEspecialista.routes.js';
import { monthlyGoalsRoutes } from './routes/monthlyGoals.routes.js';
import { googleDriveRoutes } from './modules/integrations/google-drive/routes.js';
import { safeRequestUrl } from './modules/integrations/google-drive/logging.js';
import { projectWorkspaceRoutes } from './modules/project-workspaces/routes.js';
import {enforceSessionContext} from './middleware/auth.middleware.js';
import {adminRoutes} from './modules/admin/routes.js';

export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : {
      serializers: { req: request => ({ method:request.method, url:safeRequestUrl(request.url), hostname:request.hostname,
        remoteAddress:request.ip, remotePort:request.socket?.remotePort }) },
      redact: ['req.headers.authorization','req.headers.cookie','res.headers.set-cookie'],
    },
  });

  app.register(cookie);
  app.addHook('preHandler',enforceSessionContext);
  app.register(adminRoutes,{prefix:'/api/admin'});
  app.register(googleDriveRoutes, { prefix: '/api' });
  app.register(projectWorkspaceRoutes, { prefix: '/api' });
  app.register(monthlyGoalsRoutes, { prefix: '/api/monthly-goals' });
  app.register(operacionEspecialistaRoutes, { prefix: '/api' });

  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(autoresRoutes, { prefix: '/api/autores' });
  app.register(catalogosRoutes, { prefix: '/api/catalogos' });
  app.register(proyectosRoutes, { prefix: '/api/proyectos' });
  app.register(projectCommandCenterRoutes, { prefix: '/api/proyectos' });
  app.register(especialistasRoutes, { prefix: '/api/especialistas' });
  app.register(especialistaInicioRoutes, { prefix: '/api/especialistas' });
  app.register(especialistaCarteraRoutes, { prefix: '/api/especialistas' });
  app.register(especialistaSolicitudesRoutes, { prefix: '/api/especialistas' });
  app.register(especialistaMiTrabajoRoutes, { prefix: '/api/especialistas' });
  app.register(editorRoutes, { prefix: '/api/editores' });
  app.register(editoresRoutes, { prefix: '/api/editores' });
  app.register(editorialChiefRoutes, { prefix: '/api/editores' });
  app.register(disenoRoutes, { prefix: '/api/diseno' });
  app.register(calidadRoutes, { prefix: '/api/calidad' });
  app.register(soporteDigitalHomeRoutes, { prefix: '/api/soporte-digital' });
  app.register(soporteDigitalWorkRoutes, { prefix: '/api/soporte-digital' });
  app.register(soporteDigitalRequestsRoutes, { prefix: '/api/soporte-digital' });
  app.register(disenadoresRoutes, { prefix: '/api/disenadores' });
  app.register(pausasRoutes, { prefix: '/api/pausas' });
  app.register(capitulosRoutes, { prefix: '/api/capitulos' });
  app.register(correccionesRoutes, { prefix: '/api/correcciones' });
  app.register(direccionCreativaRoutes, { prefix: '/api/direccion-creativa' });
  app.register(trazabilidadRoutes, { prefix: '/api/fichas-trazabilidad' });
  app.register(fichaVivaRoutes, { prefix: '/api/fichas-trazabilidad' });
  app.register(portalRoutes, { prefix: '/api/portal' });
  app.register(usuariosRoutes, { prefix: '/api/usuarios' });
  app.register(seguimientoRoutes, { prefix: '/api/seguimiento' });
  app.register(decisionesRoutes, { prefix: '/api/decisiones' });
  app.register(indicadoresJefaturaRoutes, { prefix: '/api/jefatura' });
  app.register(pagosRoutes, { prefix: '/api/pagos' });
  app.register(notificacionesRoutes, { prefix: '/api/notificaciones' });
  app.register(metricasRoutes, { prefix: '/api/metricas' });
  app.register(rrppRoutes, { prefix: '/api/rrpp' });
  app.register(rrppLanzamientosRoutes, { prefix: '/api/rrpp/lanzamientos' });
  app.register(jefaturaRoutes, { prefix: '/api/jefatura' });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
