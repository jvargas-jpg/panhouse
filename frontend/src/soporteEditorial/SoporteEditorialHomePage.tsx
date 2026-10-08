import { ListaProyectosPendientes } from '../proyectos/ListaProyectosPendientes';
import { fetchProyectosPendientesCalidad } from '../proyectos/proyectosPendientesApi';
import { SeccionCalidadOperativa } from '../proyectos/SeccionCalidadOperativa';

// Primera pantalla de inicio propia de soporte_editorial — antes caía
// en el mensaje genérico de HomePage.tsx.
export function SoporteEditorialHomePage() {
  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-tinta sm:text-xl">Inicio</h1>

      <SeccionCalidadOperativa />
      <details><summary className="cursor-pointer text-sm text-gray-500">Proyectos históricos pendientes de Calidad</summary><ListaProyectosPendientes
        titulo="Proyectos pendientes de calidad"
        queryKey={['fichas-trazabilidad', 'pendientes', 'calidad']}
        queryFn={fetchProyectosPendientesCalidad}
        mensajeVacio="No hay proyectos pendientes de calidad ahora mismo."
      /></details>
    </div>
  );
}
