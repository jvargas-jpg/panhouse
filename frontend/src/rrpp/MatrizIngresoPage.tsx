import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { fetchFicha, fetchProyecto } from '../proyectos/proyectoDetalleApi';
import { SeccionMatrizAsesorias } from '../proyectos/SeccionMatrizAsesorias';
import { SeccionMatrizIngreso } from '../proyectos/SeccionMatrizIngreso';

const FULL_BLEED = 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen';

// Módulo independiente de la "Matriz de Ingreso (RRPP)" — a pedido
// explícito del negocio, se extrajo de ProyectoDetallePage.tsx (ver el
// comentario en ese archivo) para que RRPP tenga un punto de entrada
// propio, fuera de la vista unificada del proyecto. Reutiliza
// fetchProyecto/fetchFicha (mismas dos queries que ya usaba
// ProyectoDetallePage.tsx) y el componente SeccionMatrizIngreso tal cual
// — ninguna de las dos cambió de forma, solo dónde se montan.
export function MatrizIngresoPage() {
  const { proyectoId } = useParams<{ proyectoId: string }>();
  if (!proyectoId) throw new Error('Falta el id del proyecto en la ruta');

  const { data: usuario } = useMe();
  const rol = usuario?.rol;
  // Mismo alcance que el guard del backend (requireRole('rrpp', 'jefe_area')
  // en GET /fichas-trazabilidad/enviados-a-rrpp y en PATCH .../matriz-ingreso).
  const puedeVerMatriz = rol === 'rrpp' || rol === 'jefe_area';
  const puedeEditar = rol === 'rrpp' || rol === 'jefe_area';

  const proyectoQuery = useQuery({ queryKey: ['proyecto', proyectoId], queryFn: () => fetchProyecto(proyectoId), enabled: puedeVerMatriz });
  const fichaQuery = useQuery({ queryKey: ['ficha', proyectoId], queryFn: () => fetchFicha(proyectoId), enabled: puedeVerMatriz });

  if (!puedeVerMatriz) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-crema/10 p-6 text-center">
        <p className="text-tinta">No tenés acceso a esta sección.</p>
        <Link to="/" className="text-sm text-dorado hover:underline">
          ← Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-crema/10">
      {proyectoQuery.isLoading && <p className="p-6 text-tinta/70">Cargando proyecto…</p>}
      {proyectoQuery.isError && (
        <p role="alert" className="p-6 text-red-600">
          No se pudo cargar el proyecto{proyectoQuery.error instanceof Error ? `: ${proyectoQuery.error.message}` : ''}.
        </p>
      )}

      {proyectoQuery.data && (
        <div className={`${FULL_BLEED} relative overflow-hidden bg-gradient-to-b from-gray-900 to-black px-6 py-8 text-white shadow-lg md:px-16`}>
          <Link to="/" className="text-sm text-white/60 hover:text-white hover:underline">
            ← Inicio
          </Link>

          <div className="flex flex-col items-center text-center">
            <span className="mt-4 rounded-full bg-purple-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              Matriz de Ingreso (RRPP)
            </span>
            <h1 className="mb-1 mt-3 text-3xl font-light text-white">
              {proyectoQuery.data.proyecto.autores.map((autor) => autor.nombre).join(', ') || 'Sin autor asignado'} — #
              {proyectoQuery.data.proyecto.codigo}
            </h1>
            <p className="text-sm text-white/70">
              {proyectoQuery.data.proyecto.servicio.nombre} ({proyectoQuery.data.proyecto.servicio.codigo})
            </p>
            <Link to={`/proyectos/${proyectoId}`} className="mt-3 text-xs text-white/60 hover:text-white hover:underline">
              Ver ficha completa del proyecto →
            </Link>
          </div>
        </div>
      )}

      {fichaQuery.isLoading && <p className="p-6 text-tinta/70">Cargando matriz…</p>}
      {fichaQuery.isError && (
        <p role="alert" className="p-6 text-red-600">
          No se pudo cargar la matriz{fichaQuery.error instanceof Error ? `: ${fichaQuery.error.message}` : ''}.
        </p>
      )}

      {fichaQuery.data && proyectoQuery.data && (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-12 md:px-16">
          {/* key={proyectoId}: mismo motivo que en ProyectoDetallePage.tsx
              — sin esto, React no remonta el formulario al navegar de la
              matriz de un proyecto a la de otro por la misma ruta
              (/rrpp/matriz/:proyectoId, solo cambia el param), y el
              estado local se queda pegado al proyecto anterior. */}
          <SeccionMatrizIngreso
            key={proyectoId}
            proyectoId={proyectoId}
            ficha={fichaQuery.data.ficha}
            autores={proyectoQuery.data.proyecto.autores}
            servicio={proyectoQuery.data.proyecto.servicio}
            puedeEditar={puedeEditar}
          />
          {/* "Matriz de Asesorías con fechas" — a pedido explícito del
              negocio, justo debajo de la Matriz de Ingreso en este mismo
              módulo exclusivo de RRPP. */}
          <SeccionMatrizAsesorias key={proyectoId} proyectoId={proyectoId} ficha={fichaQuery.data.ficha} puedeEditar={puedeEditar} />
        </div>
      )}
    </div>
  );
}
