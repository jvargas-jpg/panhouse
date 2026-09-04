import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';

// h-screen acá arriba pone un techo real (100vh) y overflow-y-auto es
// lo único que scrollea a este nivel — antes era min-h-screen (sin
// techo), así que el documento (además de cualquier página full-bleed
// con su propia región de scroll interna: AutoresPage.tsx,
// MisProyectosPage.tsx, AuditoriaPagosPage.tsx, PanelJefaturaPage.tsx —
// mismo patrón sidebar fijo + panel de contenido) terminaba con DOS
// scrollbars verticales visibles a la vez si el alto de esa página
// (antes un h-[calc(100vh-59px)] a mano) quedaba aunque sea un par de
// píxeles corto.
//
// Importante: el scroll vive en este <div> raíz, NO en <main> — probado
// y revertido a propósito. Poner overflow-y-auto directo en <main>
// dispara una regla de CSS poco conocida: si overflow-y no es 'visible'
// pero overflow-x sí lo es, el navegador computa overflow-x como 'auto'
// también (no hay forma de tener "solo clip vertical" en un mismo
// elemento). Eso recortaba en seco el truco full-bleed (ml/mr negativos
// + w-screen) que esas mismas páginas usan para escapar de este
// max-w-4xl — la mitad izquierda de su sidebar quedaba fuera del área
// de scroll de <main> y era literalmente inaccesible al clic. Acá
// arriba no pasa nada de esto: el propio ancho de este <div> raíz YA es
// el viewport completo (sin max-w), así que nada de lo que las páginas
// full-bleed escapan llega a desbordarlo — overflow-x-hidden acá es
// solo un cinturón de seguridad explícito, nunca se activa en la
// práctica.
//
// Para una página con contenido más alto que lo disponible, el
// desborde de <main> (overflow visible, sin su propio scroll) burbujea
// hacia este contenedor y dispara SU scrollbar — un solo dueño del
// scroll para toda la app. Para una página full-bleed, su alto ya
// calza exacto (h-full contra el alto real de <main>, sin desbordar),
// así que este scrollbar nunca aparece y el panel interno de esa página
// sigue siendo el único que scrollea, como siempre.
export function AppLayout() {
  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto overflow-x-hidden bg-crema">
      <TopBar />
      <main className="mx-auto min-h-0 w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
