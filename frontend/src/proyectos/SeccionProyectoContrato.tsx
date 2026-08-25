import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { FichaCompleta } from '../types/api';
import { actualizarSeccionProyectoContrato } from './proyectoDetalleApi';

function SinCompletar() {
  return <p className="text-sm italic text-tinta/50">Sin completar</p>;
}

// Mitad de la sección 1 que llena comercial a partir de lo vendido.
// Ver SeccionProyectoPerfil para la otra mitad (rrpp).
export function SeccionProyectoContrato({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [capitulosPactados, setCapitulosPactados] = useState(ficha.capitulosPactados?.toString() ?? '');
  const [paginasPactadas, setPaginasPactadas] = useState(ficha.paginasPactadas?.toString() ?? '');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionProyectoContrato(proyectoId, {
        capitulosPactados: capitulosPactados ? Number(capitulosPactados) : null,
        paginasPactadas: paginasPactadas ? Number(paginasPactadas) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  if (!puedeEditar) {
    const conValor = [
      { etiqueta: 'Capítulos pactados', valor: ficha.capitulosPactados },
      { etiqueta: 'Páginas pactadas', valor: ficha.paginasPactadas },
    ].filter((c) => c.valor !== null);

    return (
      <div className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-medium text-tinta">1. Proyecto — Contrato</h3>
        {conValor.length === 0 ? (
          <SinCompletar />
        ) : (
          <dl className="space-y-1 text-sm">
            {conValor.map((c) => (
              <div key={c.etiqueta}>
                <dt className="inline font-medium text-tinta/70">{c.etiqueta}: </dt>
                <dd className="inline text-tinta">{c.valor}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
      <h3 className="mb-2 font-medium text-tinta">1. Proyecto — Contrato</h3>
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="capitulos-pactados" className="mb-1 block text-sm font-medium text-tinta">
              Capítulos pactados
            </label>
            <input
              id="capitulos-pactados"
              type="number"
              min={0}
              value={capitulosPactados}
              onChange={(event) => {
                setCapitulosPactados(event.target.value);
                mutacion.reset();
              }}
              className="w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            />
          </div>

          <div className="flex-1">
            <label htmlFor="paginas-pactadas" className="mb-1 block text-sm font-medium text-tinta">
              Páginas pactadas
            </label>
            <input
              id="paginas-pactadas"
              type="number"
              min={0}
              value={paginasPactadas}
              onChange={(event) => {
                setPaginasPactadas(event.target.value);
                mutacion.reset();
              }}
              className="w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={mutacion.isPending}
            className="rounded-md bg-dorado px-4 py-2 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
          >
            {mutacion.isPending ? 'Guardando…' : 'Guardar'}
          </button>
          {mutacion.isSuccess && <span className="text-sm text-green-700">Guardado ✓</span>}
          {mutacion.isError && (
            <span role="alert" className="text-sm text-red-600">
              No se pudo guardar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
