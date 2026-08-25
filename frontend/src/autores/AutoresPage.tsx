import { useMe } from '../auth/useAuth';
import { fetchProyectosPendientesContrato } from '../proyectos/proyectosPendientesApi';
import { CrearAutorForm } from './CrearAutorForm';
import { ListaAutores } from './ListaAutores';
import { ProyectosPendientesCrmList } from './ProyectosPendientesCrmList';

// comercial y dirección: alta de autores. Layout CRM de dos columnas —
// izquierda: proyectos pendientes de contrato (solo comercial, ver nota
// en ProyectosPendientesCrmList) + Autores; derecha: panel fijo "Nuevo
// Autor", visible para ambos roles porque los dos dan de alta autores.
export function AutoresPage() {
  const { data: usuario } = useMe();

  return (
    <div className="min-h-screen bg-[#F8F9FA] px-4 py-10 sm:px-8">
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-start gap-8 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-8">
          {usuario?.rol === 'comercial' && (
            <ProyectosPendientesCrmList
              queryKey={['fichas-trazabilidad', 'pendientes', 'contrato']}
              queryFn={fetchProyectosPendientesContrato}
              mensajeVacio="No hay proyectos pendientes de lo contractual ahora mismo."
            />
          )}
          <ListaAutores />
        </div>

        <div className="xl:col-span-4">
          <CrearAutorForm />
        </div>
      </div>
    </div>
  );
}
