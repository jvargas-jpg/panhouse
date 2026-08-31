import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { CajaEntregaManuscrito } from './CajaEntregaManuscrito';
import { HITOS_STEPPER, calcularPasoStepper } from './faseAutor';
import { fetchMisLibros } from './portalAutorApi';

function StepperProgreso({ pasoActivo }: { pasoActivo: number }) {
  const porcentaje = (pasoActivo / HITOS_STEPPER.length) * 100;

  return (
    <div className="mb-8">
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-dorado transition-all duration-700" style={{ width: `${porcentaje}%` }} />
      </div>
      <div className="flex justify-between">
        {HITOS_STEPPER.map((hito, indice) => {
          const numero = indice + 1;
          const alcanzado = numero <= pasoActivo;
          return (
            <div key={hito} className="flex flex-col items-center gap-1.5 text-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  alcanzado ? 'bg-dorado text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {numero}
              </span>
              <span className={`text-xs font-medium ${alcanzado ? 'text-tinta' : 'text-gray-400'}`}>{hito}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// GET /proyectos/mis-libros no tiene contraparte "por id" (solo lista +
// PATCH manuscrito) — misma queryKey ['mis-libros'] que AutorHomePage.tsx
// para llegar acá con caché tibia al hacer clic en una tarjeta, y buscar
// el libro por id del lado del cliente.
export function LibroDetalleAutorPage() {
  const { id } = useParams<{ id: string }>();
  const misLibrosQuery = useQuery({ queryKey: ['mis-libros'], queryFn: fetchMisLibros });
  const libro = misLibrosQuery.data?.proyectos.find((p) => p.id === id);

  if (misLibrosQuery.isLoading) {
    return <p className="text-tinta/70">Cargando…</p>;
  }

  if (misLibrosQuery.isError) {
    return (
      <p role="alert" className="text-red-600">
        No se pudo cargar tu libro{misLibrosQuery.error instanceof Error ? `: ${misLibrosQuery.error.message}` : ''}.
      </p>
    );
  }

  if (!libro) {
    return <p className="text-tinta/70">No se encontró este libro.</p>;
  }

  return (
    <div>
      <Link to="/mis-libros" className="mb-4 inline-block text-sm text-gray-500 hover:text-tinta">
        ← Mis Libros
      </Link>

      <h1 className="mb-1 text-2xl font-bold text-tinta">{libro.titulo ?? libro.servicio.nombre}</h1>
      <p className="mb-6 text-sm text-gray-500">{libro.servicio.nombre}</p>

      <StepperProgreso pasoActivo={calcularPasoStepper(libro)} />

      <CajaEntregaManuscrito libro={libro} />
    </div>
  );
}
