import { ListaProyectosPendientes } from '../proyectos/ListaProyectosPendientes';
import { fetchProyectosPendientesPerfil } from '../proyectos/proyectosPendientesApi';

// Primera pantalla de inicio propia de rrpp — antes caía en el mensaje
// genérico de HomePage.tsx.
export function RrppHomePage() {
  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-tinta sm:text-xl">Inicio</h1>

      <ListaProyectosPendientes
        titulo="Proyectos pendientes de tu perfil"
        queryKey={['fichas-trazabilidad', 'pendientes', 'perfil']}
        queryFn={fetchProyectosPendientesPerfil}
        mensajeVacio="No hay proyectos pendientes de tu perfil ahora mismo."
      />
    </div>
  );
}
