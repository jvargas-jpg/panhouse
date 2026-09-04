import { Outlet } from 'react-router-dom';
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
  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto overflow-x-hidden bg-crema">
      <TopBar />
      <main className="min-h-0 w-full flex-1">
        <Outlet />
      </main>
    </div>
  );
}
