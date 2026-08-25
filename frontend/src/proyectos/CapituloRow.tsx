import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { Capitulo } from '../types/api';
import { actualizarCapituloAutor, actualizarCapituloEditor } from './proyectoDetalleApi';

// Lado autor del capítulo — restringido a especialista (ver comentario
// en server/routes/capitulos.routes.ts). "enlaces" es un array en el
// backend; aquí se edita como texto separado por comas y se divide/une
// al guardar/cargar, para no montar un editor de lista.
function enlacesComoTexto(enlaces: string[] | null): string {
  return enlaces?.join(', ') ?? '';
}

function textoComoEnlaces(texto: string): string[] | null {
  const partes = texto
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
  return partes.length > 0 ? partes : null;
}

function FormularioAutor({ proyectoId, capitulo }: { proyectoId: string; capitulo: Capitulo }) {
  const [fechaEnvioAutor, setFechaEnvioAutor] = useState(capitulo.fechaEnvioAutor ?? '');
  const [fechaPautadaFeedback, setFechaPautadaFeedback] = useState(capitulo.fechaPautadaFeedback ?? '');
  const [fechaRespuestaReal, setFechaRespuestaReal] = useState(capitulo.fechaRespuestaReal ?? '');
  const [enlaces, setEnlaces] = useState(enlacesComoTexto(capitulo.enlaces));
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarCapituloAutor(proyectoId, capitulo.numero, {
        fechaEnvioAutor: fechaEnvioAutor || null,
        fechaPautadaFeedback: fechaPautadaFeedback || null,
        fechaRespuestaReal: fechaRespuestaReal || null,
        enlaces: textoComoEnlaces(enlaces),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capitulos', proyectoId] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor={`envio-autor-${capitulo.id}`} className="mb-1 block text-xs font-medium text-tinta">
          Envío al autor
        </label>
        <input
          id={`envio-autor-${capitulo.id}`}
          type="date"
          value={fechaEnvioAutor}
          onChange={(event) => {
            setFechaEnvioAutor(event.target.value);
            mutacion.reset();
          }}
          className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
      </div>

      <div>
        <label htmlFor={`feedback-pautado-${capitulo.id}`} className="mb-1 block text-xs font-medium text-tinta">
          Feedback pautado
        </label>
        <input
          id={`feedback-pautado-${capitulo.id}`}
          type="date"
          value={fechaPautadaFeedback}
          onChange={(event) => {
            setFechaPautadaFeedback(event.target.value);
            mutacion.reset();
          }}
          className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
      </div>

      <div>
        <label htmlFor={`respuesta-real-${capitulo.id}`} className="mb-1 block text-xs font-medium text-tinta">
          Respuesta real
        </label>
        <input
          id={`respuesta-real-${capitulo.id}`}
          type="date"
          value={fechaRespuestaReal}
          onChange={(event) => {
            setFechaRespuestaReal(event.target.value);
            mutacion.reset();
          }}
          className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
      </div>

      <div className="min-w-40 flex-1">
        <label htmlFor={`enlaces-${capitulo.id}`} className="mb-1 block text-xs font-medium text-tinta">
          Enlaces (separados por coma)
        </label>
        <input
          id={`enlaces-${capitulo.id}`}
          type="text"
          value={enlaces}
          onChange={(event) => {
            setEnlaces(event.target.value);
            mutacion.reset();
          }}
          className="w-full rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
      </div>

      <button
        type="submit"
        disabled={mutacion.isPending}
        className="rounded-md bg-dorado px-3 py-1.5 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
      >
        {mutacion.isPending ? 'Guardando…' : 'Guardar'}
      </button>
      {mutacion.isSuccess && <span className="text-sm text-green-700">Guardado ✓</span>}
      {mutacion.isError && (
        <span role="alert" className="text-sm text-red-600">
          No se pudo guardar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
        </span>
      )}
    </form>
  );
}

function FormularioEditor({ proyectoId, capitulo }: { proyectoId: string; capitulo: Capitulo }) {
  const [fechaInicioEditor, setFechaInicioEditor] = useState(capitulo.fechaInicioEditor ?? '');
  const [paginas, setPaginas] = useState(capitulo.paginas?.toString() ?? '');
  const [fechaEntregaEditor, setFechaEntregaEditor] = useState(capitulo.fechaEntregaEditor ?? '');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarCapituloEditor(proyectoId, capitulo.numero, {
        fechaInicioEditor: fechaInicioEditor || null,
        paginas: paginas ? Number(paginas) : null,
        fechaEntregaEditor: fechaEntregaEditor || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capitulos', proyectoId] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor={`inicio-editor-${capitulo.id}`} className="mb-1 block text-xs font-medium text-tinta">
          Inicio editor
        </label>
        <input
          id={`inicio-editor-${capitulo.id}`}
          type="date"
          value={fechaInicioEditor}
          onChange={(event) => {
            setFechaInicioEditor(event.target.value);
            mutacion.reset();
          }}
          className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
      </div>

      <div>
        <label htmlFor={`paginas-${capitulo.id}`} className="mb-1 block text-xs font-medium text-tinta">
          Páginas
        </label>
        <input
          id={`paginas-${capitulo.id}`}
          type="number"
          min={0}
          value={paginas}
          onChange={(event) => {
            setPaginas(event.target.value);
            mutacion.reset();
          }}
          className="w-24 rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
      </div>

      <div>
        <label htmlFor={`entrega-editor-${capitulo.id}`} className="mb-1 block text-xs font-medium text-tinta">
          Entrega editor
        </label>
        <input
          id={`entrega-editor-${capitulo.id}`}
          type="date"
          value={fechaEntregaEditor}
          onChange={(event) => {
            setFechaEntregaEditor(event.target.value);
            mutacion.reset();
          }}
          className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
      </div>

      <button
        type="submit"
        disabled={mutacion.isPending}
        className="rounded-md bg-dorado px-3 py-1.5 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
      >
        {mutacion.isPending ? 'Guardando…' : 'Guardar'}
      </button>
      {mutacion.isSuccess && <span className="text-sm text-green-700">Guardado ✓</span>}
      {mutacion.isError && (
        <span role="alert" className="text-sm text-red-600">
          No se pudo guardar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
        </span>
      )}
    </form>
  );
}

export function CapituloRow({
  proyectoId,
  capitulo,
  puedeEditarAutor,
  puedeEditarEditor,
}: {
  proyectoId: string;
  capitulo: Capitulo;
  puedeEditarAutor: boolean;
  puedeEditarEditor: boolean;
}) {
  if (!puedeEditarAutor && !puedeEditarEditor) {
    return (
      <li className="rounded-lg border border-tinta/10 bg-white p-3 text-sm shadow-sm">
        <span className="font-medium text-tinta">Capítulo {capitulo.numero}</span>
        <span className="ml-3 text-tinta/70">
          Respondido por autor: {capitulo.fechaRespuestaReal ? 'Sí' : 'No'} · Entregado por editor:{' '}
          {capitulo.fechaEntregaEditor ? 'Sí' : 'No'}
        </span>
      </li>
    );
  }

  return (
    <li className="space-y-3 rounded-lg border border-tinta/10 bg-white p-3 shadow-sm">
      <p className="text-sm font-medium text-tinta">Capítulo {capitulo.numero}</p>

      {puedeEditarAutor && (
        <div>
          <p className="mb-1 text-xs font-medium text-tinta/70">Lado autor</p>
          <FormularioAutor proyectoId={proyectoId} capitulo={capitulo} />
        </div>
      )}

      {puedeEditarEditor && (
        <div>
          <p className="mb-1 text-xs font-medium text-tinta/70">Lado editor</p>
          <FormularioEditor proyectoId={proyectoId} capitulo={capitulo} />
        </div>
      )}
    </li>
  );
}
