import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { hoyISO } from '../proyectos/campos';
import type { ProyectoPendienteSeccion1 } from '../types/api';
import { crearProyecto, eliminarProyecto, fetchCatalogos, reasignarProyecto } from '../jefatura/jefaturaApi';
import { fetchAutores } from './autoresApi';
import { SelectorMultipleAutores } from './SelectorMultipleAutores';

const LABEL_CLASS = 'mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-wide text-gray-500';
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
}: {
  proyectoEnEdicion: ProyectoPendienteSeccion1 | null;
  onGuardado: (mensaje: string) => void;
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
  }

  const servicioId = catalogosQuery.data?.servicios.find((servicio) => servicio.codigo === servicioCodigo)?.id;

  const mutacionCrear = useMutation({
    mutationFn: () => {
      if (autorIds.length === 0) throw new Error('Selecciona al menos un autor');
      if (!servicioId) throw new Error('Selecciona un servicio válido');
      return crearProyecto({ autorIds, servicioId, unidadId, presupuestoId, fechaProgramadaInicio });
    },
    onSuccess: () => {
      invalidarProyectos();
      onGuardado('Proyecto creado exitosamente');
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
    // p-6: Modal.tsx daba este padding gratis antes (lo tenía en su
    // propio wrapper de children); ahora ese wrapper es un slot desnudo
    // sin padding propio (ver el comentario de Modal.tsx), así que cada
    // formulario lo pone por su cuenta. Este formulario es corto y
    // nunca necesitó scroll propio, así que un <form> normal con
    // padding alcanza — no hace falta el split cuerpo/footer de
    // CrearAutorForm.tsx.
    <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto p-6">
      <div>
        <label htmlFor="proyecto-autores-buscador" className={LABEL_CLASS}>
          Autores (coautoría)
        </label>
        <SelectorMultipleAutores
          autoresDisponibles={autoresQuery.data?.autores ?? []}
          value={autorIds}
          onChange={(ids) => {
            setAutorIds(ids);
            mutacion.reset();
          }}
        />
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

      {proyectoEnEdicion && (
        <>
          <button
            type="button"
            onClick={handleEliminar}
            disabled={mutacionEliminar.isPending}
            className="mt-3 w-full rounded-lg py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
          >
            {mutacionEliminar.isPending ? 'Eliminando…' : 'Eliminar Proyecto'}
          </button>
          {mutacionEliminar.isError && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              No se pudo eliminar{mutacionEliminar.error instanceof Error ? `: ${mutacionEliminar.error.message}` : ''}.
            </p>
          )}
        </>
      )}
    </form>
  );
}
