import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { hoyISO } from '../proyectos/campos';
import type { ProyectoPendienteSeccion1 } from '../types/api';
import { crearProyecto, eliminarProyecto, fetchCatalogos, reasignarProyecto } from '../jefatura/jefaturaApi';
import { fetchAutores } from './autoresApi';
import { SelectorMultipleAutores } from './SelectorMultipleAutores';

const LABEL_CLASS = 'mb-1.5 block text-xs font-medium text-gray-600';
const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40';

// Comercial (al crear un proyecto nuevo) solo elige la categoría
// general del servicio — el resto del catálogo real (EEC/EET, hoy
// subsumidos por Crudo + subtipo, ver SeccionProyectoPerfil.tsx) queda
// oculto acá pero sigue existiendo para proyectos legacy. Mismo backend
// (helpers/proyectos.ts:CODIGOS_SERVICIO_PERMITIDOS_EN_ALTA) valida esto
// también — esto es solo la UX, no la única barrera. En modo edición
// (proyectoEnEdicion) se muestra el catálogo completo sin filtrar: un
// proyecto legacy ya asignado a EEC/EET tiene que poder seguir
// mostrando/corrigiendo su servicio real.
const CODIGOS_SERVICIO_ALTA = ['SE', 'EF', 'CR'];

// Crear: POST /proyectos, mismo endpoint y validación que
// jefatura/CrearProyectoForm.tsx (comercial ya está autorizado ahí, ver
// server/routes/proyectos.routes.ts) — unidad/presupuesto/fecha son
// NOT NULL en la tabla `proyectos`, así que un alta real no puede
// prescindir de ellos.
//
// Editar: PATCH /proyectos/:id/reasignar — cubre TODOS los parámetros
// comerciales (coautoría, servicio, unidad, presupuesto, fecha
// programada). proyectoEnEdicion (ProyectoPendienteSeccion1) ya trae
// autores/unidadId/presupuestoId/fechaProgramadaInicio precargados
// desde el backend (server/helpers/trazabilidad.ts) para poder
// preseleccionar estos campos sin una consulta aparte.
//
// Sin campo de título: el negocio lo retiró (ver el comentario de la
// columna en server/db/schema/proyectos.ts) — el nombre visual del
// proyecto ahora se genera solo (autores + codigo), no hay nada que
// escribir acá ni en modo alta ni en edición.
//
// El <select> de servicio lee el catálogo real (GET /catalogos) en vez
// de una lista fija — así el value siempre coincide con
// servicios.codigo en la base de datos, y el proyecto en edición
// preselecciona su servicio real sin adivinar.
export function CrearProyectoModalForm({
  proyectoEnEdicion,
  onGuardado,
  onCancelar,
  onCreado,
}: {
  proyectoEnEdicion: ProyectoPendienteSeccion1 | null;
  onGuardado: (mensaje: string) => void;
  onCancelar?: () => void;
  onCreado?: (id: string) => void;
}) {
  const autoresQuery = useQuery({ queryKey: ['autores'], queryFn: fetchAutores });
  const catalogosQuery = useQuery({ queryKey: ['catalogos'], queryFn: fetchCatalogos });
  const queryClient = useQueryClient();

  // Se usan en los dos modos: en alta arrancan vacíos, en edición se
  // precargan desde proyectoEnEdicion (ver el efecto de abajo).
  const [autorIds, setAutorIds] = useState<string[]>([]);
  const [servicioCodigo, setServicioCodigo] = useState('');
  const [unidadId, setUnidadId] = useState('');
  const [presupuestoId, setPresupuestoId] = useState('');
  const [fechaProgramadaInicio, setFechaProgramadaInicio] = useState(hoyISO());

  useEffect(() => {
    setAutorIds(proyectoEnEdicion?.autores.map((autor) => autor.id) ?? []);
    setServicioCodigo(proyectoEnEdicion?.servicio.codigo ?? '');
    setUnidadId(proyectoEnEdicion?.unidadId ?? '');
    setPresupuestoId(proyectoEnEdicion?.presupuestoId ?? '');
    setFechaProgramadaInicio(proyectoEnEdicion?.fechaProgramadaInicio ?? hoyISO());
  }, [proyectoEnEdicion]);

  // "Proyectos Pendientes" en AutoresPage.tsx se pide con esta queryKey
  // de 3 partes — invalidar solo ['pendientes', 'contrato'] no la
  // alcanza (invalidateQueries matchea por prefijo exacto del arreglo).
  // También invalida ['proyectos'] (prefijo compartido con /activos,
  // /mios, /riesgo, etc.) para que cualquier otra pantalla con un
  // proyecto editado o eliminado en caché se refresque también.
  function invalidarProyectos() {
    queryClient.invalidateQueries({ queryKey: ['fichas-trazabilidad', 'pendientes', 'contrato'] });
    queryClient.invalidateQueries({ queryKey: ['proyectos'] });
    queryClient.invalidateQueries({ queryKey: ['metricas', 'comercial'] });
  }

  const servicioId = catalogosQuery.data?.servicios.find((servicio) => servicio.codigo === servicioCodigo)?.id;

  const mutacionCrear = useMutation({
    mutationFn: () => {
      if (autorIds.length === 0) throw new Error('Selecciona al menos un autor');
      if (!servicioId) throw new Error('Selecciona un servicio válido');
      return crearProyecto({ autorIds, servicioId, unidadId, presupuestoId, fechaProgramadaInicio });
    },
    onSuccess: (resultado) => {
      invalidarProyectos();
      if (onCreado) onCreado(resultado.proyecto.id);
      else onGuardado('Proyecto creado exitosamente');
    },
  });

  const mutacionEditar = useMutation({
    mutationFn: () => {
      if (autorIds.length === 0) throw new Error('Selecciona al menos un autor');
      if (!servicioId) throw new Error('Selecciona un servicio válido');
      return reasignarProyecto(proyectoEnEdicion!.id, {
        autorIds,
        servicioId,
        unidadId,
        presupuestoId,
        fechaProgramadaInicio,
      });
    },
    onSuccess: () => {
      invalidarProyectos();
      onGuardado('Proyecto editado exitosamente');
    },
  });

  // onGuardado ya cierra el modal y muestra el toast (así lo conecta
  // AutoresPage.tsx) — se reutiliza tal cual para el mensaje de
  // eliminación, no hizo falta un callback aparte.
  const mutacionEliminar = useMutation({
    mutationFn: () => eliminarProyecto(proyectoEnEdicion!.id),
    onSuccess: () => {
      invalidarProyectos();
      onGuardado('Proyecto eliminado exitosamente');
    },
  });

  const mutacion = proyectoEnEdicion ? mutacionEditar : mutacionCrear;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  function handleEliminar() {
    if (!proyectoEnEdicion) return;
    if (!window.confirm('¿Estás seguro de eliminar este proyecto? Esta acción no se puede deshacer.')) return;
    mutacionEliminar.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {(autoresQuery.isError || catalogosQuery.isError) && <div role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">No se pudieron cargar las opciones. <button type="button" onClick={() => { if (autoresQuery.isError) void autoresQuery.refetch(); if (catalogosQuery.isError) void catalogosQuery.refetch(); }} className="font-semibold underline">Reintentar</button></div>}
      <div>
        <label htmlFor="proyecto-autores-buscador" className={LABEL_CLASS}>
          Autoría
        </label>
        <SelectorMultipleAutores
          autoresDisponibles={autoresQuery.data?.autores ?? []}
          value={autorIds}
          onChange={(ids) => {
            setAutorIds(ids);
            mutacion.reset();
          }}
        />
        <p className="mt-2 text-xs text-gray-500">Selecciona uno o varios autores para este proyecto.</p>
      </div>

        <div role="group" aria-labelledby="project-initial-data" className="border-t border-gray-100 pt-4">
          <h4 id="project-initial-data" className="mb-4 text-sm font-semibold text-gray-900">Información del proyecto</h4>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
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
          {catalogosQuery.data?.servicios
            .filter((servicio) => proyectoEnEdicion || CODIGOS_SERVICIO_ALTA.includes(servicio.codigo))
            .map((servicio) => (
              <option key={servicio.id} value={servicio.codigo}>
                {servicio.codigo} — {servicio.nombre}
              </option>
            ))}
        </select>
      </div>

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
          Fecha de ingreso
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

          </div>
        </div>
        {proyectoEnEdicion && <details className="text-xs text-gray-500"><summary className="cursor-pointer">Más opciones</summary><button type="button" onClick={handleEliminar} disabled={mutacionEliminar.isPending} className="mt-2 rounded-lg px-3 py-2 text-red-700 hover:bg-red-50">{mutacionEliminar.isPending ? 'Eliminando…' : 'Eliminar proyecto'}</button></details>}
      </div>
      <footer className="shrink-0 border-t border-gray-100 bg-white px-6 py-4">
        {(mutacion.isError || mutacionEliminar.isError) && <p role="alert" className="mb-3 break-words text-sm text-red-600">No se pudo guardar{(mutacion.error ?? mutacionEliminar.error) instanceof Error ? `: ${((mutacion.error ?? mutacionEliminar.error) as Error).message}` : '.'}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          {onCancelar && <button type="button" onClick={onCancelar} disabled={mutacion.isPending} className="min-h-11 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-dorado disabled:opacity-60">Cancelar</button>}
          <button type="submit" disabled={mutacion.isPending || mutacionEliminar.isPending || autoresQuery.isLoading || catalogosQuery.isLoading || autoresQuery.isError || catalogosQuery.isError} className="min-h-11 rounded-lg bg-dorado px-4 py-2.5 text-sm font-semibold text-tinta transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 disabled:opacity-60">{mutacion.isPending ? 'Guardando…' : proyectoEnEdicion ? 'Guardar cambios' : onCreado ? 'Crear y completar ficha' : 'Crear proyecto'}</button>
        </div>
      </footer>
    </form>
  );
}
