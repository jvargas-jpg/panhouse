import { ListaProyectosPendientes } from '../proyectos/ListaProyectosPendientes';
import { fetchProyectosPendientesSoporteDigital } from '../proyectos/proyectosPendientesApi';

export function SoporteDigitalHomePage() {
  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-tinta sm:text-xl">Inicio — Soporte Digital</h1>

      <ListaProyectosPendientes
        titulo="Proyectos pendientes de soporte digital"
        queryKey={['fichas-trazabilidad', 'pendientes', 'soporte-digital']}
        queryFn={fetchProyectosPendientesSoporteDigital}
        mensajeVacio="No hay proyectos pendientes de soporte digital ahora mismo."
      />
    </div>
  );
}