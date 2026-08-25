import { ListaProyectosPendientes } from '../proyectos/ListaProyectosPendientes';
import { fetchProyectosPendientesCalidad } from '../proyectos/proyectosPendientesApi';

// Primera pantalla de inicio propia de soporte_editorial — antes caía
// en el mensaje genérico de HomePage.tsx.
export function SoporteEditorialHomePage() {
  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-tinta sm:text-xl">Inicio</h1>

      <ListaProyectosPendientes
        titulo="Proyectos pendientes de calidad"
        queryKey={['fichas-trazabilidad', 'pendientes', 'calidad']}
        queryFn={fetchProyectosPendientesCalidad}
        mensajeVacio="No hay proyectos pendientes de calidad ahora mismo."
      />
    </div>
  );
}
