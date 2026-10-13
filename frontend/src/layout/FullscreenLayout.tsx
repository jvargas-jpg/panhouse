import { Outlet, useLocation } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { TopBar } from './TopBar';

// Igual que AppLayout.tsx pero sin el <main max-w-4xl> centrado: para
// páginas que necesitan el 100% del ancho de la pantalla (empieza con
// ProyectoDetallePage.tsx, cuyo formulario se sentía apretado dentro de
// esa columna de 896px). Mismo TopBar (notificaciones/cerrar sesión) y
// el mismo dueño único del scroll en el <div> raíz — ver el comentario
// de AppLayout.tsx para el razonamiento completo de por qué el scroll
// vive ahí y no en <main>; se repite acá para que las dos páginas full-
// bleed que ya existían (AutoresPage.tsx, etc.) y esta no diverjan.
export function FullscreenLayout() {
  const { data: user } = useMe(), location = useLocation();
  const command = !!user && (['especialista', 'jefe_area'].includes(user.rol) && /^\/proyectos\/[^/]+(?:\/(operacion|equipo|ficha|actividad|ficha-trazabilidad))?$/.test(location.pathname)
    || user.rol === 'rrpp' && /^\/proyectos\/[^/]+\/(operacion|equipo|ficha|actividad)$/.test(location.pathname));
  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto overflow-x-hidden bg-crema">
      {!command && <TopBar />}
      <main className="min-h-0 w-full flex-1">
        <Outlet />
      </main>
    </div>
  );
}
