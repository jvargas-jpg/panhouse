import { AutoresPage } from './autores/AutoresPage';
import { useMe } from './auth/useAuth';
import { DisenadorHomePage } from './disenador/DisenadorHomePage';
import { EditorHomePage } from './editor/EditorHomePage';
import { JefeEdicionHomePage } from './jefeEdicion/JefeEdicionHomePage';
import { PanelJefaturaPage } from './jefatura/PanelJefaturaPage';
import { MisProyectosPage } from './proyectos/MisProyectosPage';
import { RrppHomePage } from './rrpp/RrppHomePage';
import { SoporteDigitalHomePage } from './soporteDigital/SoporteDigitalHomePage';
import { SoporteEditorialHomePage } from './soporteEditorial/SoporteEditorialHomePage';

// Punto de entrada autenticado: qué pantalla ve cada quien depende del
// rol de la sesión, no de la ruta. RequireAuth ya garantizó que hay
// usuario antes de llegar acá.
export function HomePage() {
  const { data: user } = useMe();

  if (user?.rol === 'especialista') {
    return <MisProyectosPage />;
  }

  if (user?.rol === 'jefe_area') {
    return <PanelJefaturaPage />;
  }

  if (user?.rol === 'comercial' || user?.rol === 'direccion') {
    return <AutoresPage />;
  }

  if (user?.rol === 'rrpp') {
    return <RrppHomePage />;
  }

  if (user?.rol === 'editor') {
    return <EditorHomePage />;
  }

  if (user?.rol === 'jefe_edicion') {
    return <JefeEdicionHomePage />;
  }

  // AQUÍ ESTÁ EL CAMBIO: Agregamos al lider_creativo a esta vista
  if (user?.rol === 'disenador' || user?.rol === 'lider_creativo') {
    return <DisenadorHomePage />;
  }

  if (user?.rol === 'soporte_editorial') {
    return <SoporteEditorialHomePage />;
  }

  if (user?.rol === 'soporte_digital') {
    return <SoporteDigitalHomePage />;
  }

  return (
    <div className="rounded-lg border border-tinta/10 bg-white p-6 text-tinta/70 shadow-sm">
      Todavía no hay una pantalla para tu rol ({user?.rol}).
    </div>
  );
}