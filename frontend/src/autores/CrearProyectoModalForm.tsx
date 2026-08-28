import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { hoyISO } from '../proyectos/campos';
import type { ProyectoPendienteSeccion1 } from '../types/api';
import { crearProyecto, fetchCatalogos, reasignarProyecto } from '../jefatura/jefaturaApi';
import { fetchAutores } from './autoresApi';

const LABEL_CLASS = 'mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-wide text-gray-500';
const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40';

// Crear: POST /proyectos, mismo endpoint y validación que
// jefatura/CrearProyectoForm.tsx (comercial ya está autorizado ahí, ver
// server/routes/proyectos.routes.ts) — unidad/presupuesto/fecha son
// NOT NULL en la tabla `proyectos`, así que un alta real no puede
// prescindir de ellos aunque el pedido original solo mencionara autor y
// servicio; se muestran acá solo en modo creación.
//
// Editar: PATCH /proyectos/:id/reasignar (ruta nueva, ver
// server/helpers/proyectos.ts) — deliberadamente acotada a autor y
// servicio, tal como se pidió: no toca especificaciones operativas
// (esas ya tienen su propia ruta, a cargo de especialista).
//
// El <select> de servicio ahora lee el catálogo real (GET /catalogos)
// en vez de una lista fija — así el value siempre coincide con
// servicios.codigo en la base de datos, y el proyecto en edición
// preselecciona su servicio real sin adivinar.
export function CrearProyectoModalForm({
  proyectoEnEdicion,
  onGuardado,
}: {
  proyectoEnEdicion: ProyectoPendienteSeccion1 | null;
  onGuardado: (mensaje: string) => void;
}) {
  const autoresQuery = useQuery({ queryKey: ['autores'], queryFn: fetchAutores });
  const catalogosQuery = useQuery({ queryKey: ['catalogos'], queryFn: fetchCatalogos });
  const queryClient = useQueryClient();

  const [autorId, setAutorId] = useState('');
  const [servicioCodigo, setServicioCodigo] = useState('');
  const [unidadId, setUnidadId] = useState('');
  const [presupuestoId, setPresupuestoId] = useState('');
  const [fechaProgramadaInicio, setFechaProgramadaInicio] = useState(hoyISO());

  useEffect(() => {
    setAutorId(proyectoEnEdicion?.autor.id ?? '');
    setServicioCodigo(proyectoEnEdicion?.servicio.codigo ?? '');
    setUnidadId('');
    setPresupuestoId('');
    setFechaProgramadaInicio(hoyISO());
  }, [proyectoEnEdicion]);

  // "Proyectos Pendientes" en AutoresPage.tsx se pide con esta queryKey
  // de 3 partes — invalidar solo ['pendientes', 'contrato'] no la
  // alcanza (invalidateQueries matchea por prefijo exacto del arreglo).
  function invalidarPendientes() {
    queryClient.invalidateQueries({ queryKey: ['fichas-trazabilidad', 'pendientes', 'contrato'] });
  }

  const servicioId = catalogosQuery.data?.servicios.find((servicio) => servicio.codigo === servicioCodigo)?.id;

  const mutacionCrear = useMutation({
    mutationFn: () => {
      if (!servicioId) throw new Error('Selecciona un servicio válido');
      return crearProyecto({ autorId, servicioId, unidadId, presupuestoId, fechaProgramadaInicio });
    },
    onSuccess: () => {
      invalidarPendientes();
      onGuardado('Proyecto creado exitosamente');
    },
  });

  const mutacionEditar = useMutation({
    mutationFn: () => {
      if (!servicioId) throw new Error('Selecciona un servicio válido');
      return reasignarProyecto(proyectoEnEdicion!.id, { autorId, servicioId });
    },
    onSuccess: () => {
      invalidarPendientes();
      onGuardado('Proyecto editado exitosamente');
    },
  });

  const mutacion = proyectoEnEdicion ? mutacionEditar : mutacionCrear;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="proyecto-autor" className={LABEL_CLASS}>
          Autor
        </label>
        <select
          id="proyecto-autor"
          required
          value={autorId}
          onChange={(event) => {
            setAutorId(event.target.value);
            mutacion.reset();
          }}
          className={INPUT_CLASS}
        >
          <option value="">Seleccionar…</option>
          {autoresQuery.data?.autores.map((autor) => (
            <option key={autor.id} value={autor.id}>
              {autor.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="proyecto-servicio" className={LABEL_CLASS}>
          Tipo de servicio
        </label>
        <select
          id="proyecto-servicio"
          required
          value={servicioCodigo}
          onChange={(event) => {
            setServicioCodigo(event.target.value);
            mutacion.reset();
          }}
          className={INPUT_CLASS}
        >
          <option value="" disabled>
            Selecciona el servicio a contratar...
          </option>
          {catalogosQuery.data?.servicios.map((servicio) => (
            <option key={servicio.id} value={servicio.codigo}>
              {servicio.codigo} — {servicio.nombre}
            </option>
          ))}
        </select>
      </div>

      {!proyectoEnEdicion && (
        <>
          <div>
            <label htmlFor="proyecto-unidad" className={LABEL_CLASS}>
              Unidad
            </label>
            <select
              id="proyecto-unidad"
              required
              value={unidadId}
              onChange={(event) => {
                setUnidadId(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Seleccionar…</option>
              {catalogosQuery.data?.unidades.map((unidad) => (
                <option key={unidad.id} value={unidad.id}>
                  {unidad.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="proyecto-presupuesto" className={LABEL_CLASS}>
              Presupuesto
            </label>
            <select
              id="proyecto-presupuesto"
              required
              value={presupuestoId}
              onChange={(event) => {
                setPresupuestoId(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Seleccionar…</option>
              {catalogosQuery.data?.presupuestos.map((presupuesto) => (
                <option key={presupuesto.id} value={presupuesto.id}>
                  {presupuesto.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="proyecto-fecha-inicio" className={LABEL_CLASS}>
              Fecha programada de inicio
            </label>
            <input
              id="proyecto-fecha-inicio"
              type="date"
              required
              value={fechaProgramadaInicio}
              onChange={(event) => {
                setFechaProgramadaInicio(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={mutacion.isPending}
        className="mt-8 w-full rounded-lg bg-tinta py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
      >
        {mutacion.isPending ? 'Guardando…' : proyectoEnEdicion ? 'Guardar Cambios' : 'Crear Proyecto'}
      </button>
      {mutacion.isError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          No se pudo guardar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
        </p>
      )}
    </form>
  );
}
