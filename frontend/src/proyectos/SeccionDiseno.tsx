import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { FichaCompleta, FichaDisenoPropuesta, ProyectoConRiesgo, Rol, TipoPortada } from '../types/api';
import { formatearFecha, SinCompletar } from './campos';
import {
  actualizarBriefDiseno,
  actualizarPropuestaDiseno,
  agregarPropuestaDiseno,
  asignarDisenador,
  eliminarPropuestaDiseno,
  fetchDisenadoresCarga,
} from './proyectoDetalleApi';
import { SeccionDisenoControl } from './SeccionDisenoControl';

const TIPO_PORTADA_LABEL: Record<TipoPortada, string> = {
  tipografica: 'Tipográfica',
  fotografica: 'Fotográfica',
  ilustrada: 'Ilustrada',
};

// Se muestra en vez de la Sección 4 completa cuando el especialista
// dueño del proyecto todavía no le asignó disenador — mismo patrón que
// AsignarEspecialistaCard/AsignarEditorCard (select con carga + botón
// Asignar), pero la mutación invalida ['proyecto', proyectoId] (no
// ['ficha', ...]): lo que cambia es proyectos.disenadorId, que viaja en
// el proyecto, no en la ficha.
function AsignarDisenadorForm({ proyectoId }: { proyectoId: string }) {
  const cargaQuery = useQuery({ queryKey: ['disenadores', 'carga'], queryFn: fetchDisenadoresCarga });
  const [disenadorId, setDisenadorId] = useState('');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () => asignarDisenador(proyectoId, disenadorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <div className="w-full rounded-xl border-2 border-dashed border-dorado/30 bg-dorado/5 p-6 text-center">
      <p className="text-base font-semibold text-tinta">Falta asignar Dirección Creativa</p>
      <p className="mb-4 text-sm text-tinta/60">Elige un diseñador para habilitar la Sección 4.</p>

      {cargaQuery.isLoading && <p className="text-sm text-tinta/70">Cargando diseñadores…</p>}
      {cargaQuery.isError && (
        <p role="alert" className="text-sm text-red-600">
          No se pudo cargar la lista{cargaQuery.error instanceof Error ? `: ${cargaQuery.error.message}` : ''}.
        </p>
      )}

      {cargaQuery.data && cargaQuery.data.disenadores.length === 0 && (
        <p className="text-sm text-tinta/70">No hay disenadores registrados todavía.</p>
      )}

      {cargaQuery.data && cargaQuery.data.disenadores.length > 0 && (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end justify-center gap-3">
          <div className="text-left">
            <label htmlFor="asignar-disenador" className="mb-1 block text-sm font-medium text-tinta">
              Diseñador
            </label>
            <select
              id="asignar-disenador"
              required
              value={disenadorId}
              onChange={(event) => setDisenadorId(event.target.value)}
              className="rounded-md border border-tinta/20 bg-white px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            >
              <option value="">Seleccionar…</option>
              {cargaQuery.data.disenadores.map((disenador) => (
                <option key={disenador.id} value={disenador.id}>
                  {disenador.nombre} (carga: {disenador.carga})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={mutacion.isPending}
            className="rounded-md bg-tinta px-4 py-2 text-sm font-medium text-white transition hover:bg-tinta/90 disabled:opacity-60"
          >
            {mutacion.isPending ? 'Asignando…' : 'Asignar'}
          </button>
          {mutacion.isError && (
            <span role="alert" className="w-full text-xs text-red-600">
              No se pudo asignar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
            </span>
          )}
        </form>
      )}
    </div>
  );
}

function PropuestaRow({
  proyectoId,
  propuesta,
  puedeEditar,
}: {
  proyectoId: string;
  propuesta: FichaDisenoPropuesta;
  puedeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [fechaEnviadaEspecialista, setFechaEnviadaEspecialista] = useState(propuesta.fechaEnviadaEspecialista ?? '');
  const [fechaEnviadaAutor, setFechaEnviadaAutor] = useState(propuesta.fechaEnviadaAutor ?? '');
  const [fechaAprobadaAutor, setFechaAprobadaAutor] = useState(propuesta.fechaAprobadaAutor ?? '');
  const [estado, setEstado] = useState(propuesta.estado ?? '');
  const [descripcion, setDescripcion] = useState(propuesta.descripcion ?? '');
  const [enlace, setEnlace] = useState(propuesta.enlace ?? '');
  const queryClient = useQueryClient();

  const mutacionEditar = useMutation({
    mutationFn: () =>
      actualizarPropuestaDiseno(proyectoId, propuesta.id, {
        fechaEnviadaEspecialista: fechaEnviadaEspecialista || null,
        fechaEnviadaAutor: fechaEnviadaAutor || null,
        fechaAprobadaAutor: fechaAprobadaAutor || null,
        estado: estado || null,
        descripcion: descripcion || null,
        enlace: enlace || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
      setEditando(false);
    },
  });

  const mutacionBorrar = useMutation({
    mutationFn: () => eliminarPropuestaDiseno(proyectoId, propuesta.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacionEditar.mutate();
  }

  function handleBorrar() {
    if (!window.confirm('¿Borrar esta propuesta de portada? No se puede deshacer.')) return;
    mutacionBorrar.mutate();
  }

  const texto = `Propuesta${propuesta.descripcion ? `: ${propuesta.descripcion}` : ''}${
    propuesta.estado ? ` — ${propuesta.estado}` : ''
  }${propuesta.fechaEnviadaEspecialista ? ` (enviada a especialista ${formatearFecha(propuesta.fechaEnviadaEspecialista)})` : ''}`;

  if (!puedeEditar) {
    return <li>{texto}</li>;
  }

  if (!editando) {
    return (
      <li className="flex items-center justify-between gap-2">
        <span>{texto}</span>
        <span className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setEditando(true)} className="text-xs text-tinta/70 underline hover:text-tinta">
            Editar
          </button>
          <button
            type="button"
            onClick={handleBorrar}
            disabled={mutacionBorrar.isPending}
            className="text-xs text-red-600 underline hover:text-red-800 disabled:opacity-60"
          >
            {mutacionBorrar.isPending ? 'Borrando…' : 'Borrar'}
          </button>
        </span>
        {mutacionBorrar.isError && (
          <span role="alert" className="text-xs text-red-600">
            No se pudo borrar.
          </span>
        )}
      </li>
    );
  }

  return (
    <li>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-md bg-crema p-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-tinta/70">Enviada a especialista</label>
          <input
            type="date"
            value={fechaEnviadaEspecialista}
            onChange={(event) => setFechaEnviadaEspecialista(event.target.value)}
            className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-tinta/70">Enviada al autor</label>
          <input
            type="date"
            value={fechaEnviadaAutor}
            onChange={(event) => setFechaEnviadaAutor(event.target.value)}
            className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-tinta/70">Aprobada por el autor</label>
          <input
            type="date"
            value={fechaAprobadaAutor}
            onChange={(event) => setFechaAprobadaAutor(event.target.value)}
            className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
          />
        </div>
        <input
          type="text"
          value={estado}
          onChange={(event) => setEstado(event.target.value)}
          placeholder="Estado (ej. aprobadas)"
          className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
        <input
          type="text"
          value={descripcion}
          onChange={(event) => setDescripcion(event.target.value)}
          placeholder="Observaciones"
          className="flex-1 rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
        <input
          type="text"
          value={enlace}
          onChange={(event) => setEnlace(event.target.value)}
          placeholder="Link de presentación"
          className="flex-1 rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
        <button
          type="submit"
          disabled={mutacionEditar.isPending}
          className="rounded-md bg-dorado px-3 py-1.5 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
        >
          {mutacionEditar.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={() => setEditando(false)} className="text-xs text-tinta/70 underline hover:text-tinta">
          Cancelar
        </button>
        {mutacionEditar.isError && (
          <span role="alert" className="text-xs text-red-600">
            No se pudo guardar.
          </span>
        )}
      </form>
    </li>
  );
}

// Vista "Micro" de la Sección 4 (brief creativo + propuestas de
// portada) — código previo, sin cambios, solo dejó de exportarse
// directo: ahora SeccionDiseno (más abajo) la monta debajo del panel
// "Macro" (SeccionDisenoControl). Dueño disenador o lider_creativo — a
// diferencia de la sección 1, no está partida por campo: los mismos dos
// roles escriben tanto el brief como las propuestas. rolUsuario/proyecto
// solo hacen falta para el caso especial de abajo (especialista sin
// disenador asignado todavía) — el resto de la sección sigue guiándose
// por puedeEditar, como las demás secciones de la ficha.
function ContenidoDisenoMicro({
  proyectoId,
  proyecto,
  ficha,
  puedeEditar,
  rolUsuario,
}: {
  proyectoId: string;
  proyecto: ProyectoConRiesgo;
  ficha: FichaCompleta;
  puedeEditar: boolean;
  rolUsuario?: Rol;
}) {
  const [brief, setBrief] = useState(ficha.disenoBriefCreativo ?? '');
  const [tipoPortada, setTipoPortada] = useState<TipoPortada | ''>(ficha.disenoTipoPortada ?? '');
  const [fechaReunionCreativa, setFechaReunionCreativa] = useState(ficha.disenoFechaReunionCreativa ?? '');
  const [fechaEntregaBrief, setFechaEntregaBrief] = useState(ficha.disenoFechaEntregaBrief ?? '');
  const [briefAprobadoFecha, setBriefAprobadoFecha] = useState(ficha.disenoBriefAprobadoFecha ?? '');

  const [fechaEnviadaEspecialista, setFechaEnviadaEspecialista] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enlace, setEnlace] = useState('');
  const queryClient = useQueryClient();

  const mutacionBrief = useMutation({
    mutationFn: () =>
      actualizarBriefDiseno(proyectoId, {
        disenoBriefCreativo: brief || null,
        disenoTipoPortada: tipoPortada || null,
        disenoFechaReunionCreativa: fechaReunionCreativa || null,
        disenoFechaEntregaBrief: fechaEntregaBrief || null,
        disenoBriefAprobadoFecha: briefAprobadoFecha || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
    },
  });

  const mutacionPropuesta = useMutation({
    mutationFn: () =>
      agregarPropuestaDiseno(proyectoId, {
        fechaEnviadaEspecialista: fechaEnviadaEspecialista || null,
        descripcion: descripcion || null,
        enlace: enlace || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
      setDescripcion('');
      setEnlace('');
    },
  });

  function handleSubmitBrief(event: FormEvent) {
    event.preventDefault();
    mutacionBrief.mutate();
  }

  function handleSubmitPropuesta(event: FormEvent) {
    event.preventDefault();
    mutacionPropuesta.mutate();
  }

  if (rolUsuario === 'especialista' && !proyecto.disenadorId) {
    return <AsignarDisenadorForm proyectoId={proyectoId} />;
  }

  if (!puedeEditar) {
    const sinNada =
      !ficha.disenoBriefCreativo &&
      !ficha.disenoTipoPortada &&
      !ficha.disenoFechaReunionCreativa &&
      !ficha.disenoFechaEntregaBrief &&
      !ficha.disenoBriefAprobadoFecha &&
      ficha.disenoPropuestas.length === 0;
    return (
      <div className="w-full rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-medium text-tinta">4. Diseño</h3>
        {sinNada ? (
          <SinCompletar />
        ) : (
          <div className="space-y-2 text-sm">
            {ficha.disenoBriefCreativo && (
              <p>
                <span className="font-medium text-tinta/70">Brief: </span>
                {ficha.disenoBriefCreativo}
              </p>
            )}
            {ficha.disenoTipoPortada && (
              <p>
                <span className="font-medium text-tinta/70">Tipo de portada: </span>
                {TIPO_PORTADA_LABEL[ficha.disenoTipoPortada]}
              </p>
            )}
            {ficha.disenoFechaReunionCreativa && (
              <p>
                <span className="font-medium text-tinta/70">Reunión creativa: </span>
                {formatearFecha(ficha.disenoFechaReunionCreativa)}
              </p>
            )}
            {ficha.disenoFechaEntregaBrief && (
              <p>
                <span className="font-medium text-tinta/70">Entrega del brief: </span>
                {formatearFecha(ficha.disenoFechaEntregaBrief)}
              </p>
            )}
            {ficha.disenoBriefAprobadoFecha && (
              <p>
                <span className="font-medium text-tinta/70">Brief aprobado: </span>
                {formatearFecha(ficha.disenoBriefAprobadoFecha)}
              </p>
            )}
            <ul className="space-y-1">
              {ficha.disenoPropuestas.map((propuesta) => (
                <PropuestaRow key={propuesta.id} proyectoId={proyectoId} propuesta={propuesta} puedeEditar={false} />
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
      <h3 className="mb-2 font-medium text-tinta">4. Diseño</h3>

      <form onSubmit={handleSubmitBrief} className="space-y-3">
        <div>
          <label htmlFor="diseno-brief" className="mb-1 block text-sm font-medium text-tinta">
            Brief creativo
          </label>
          <textarea
            id="diseno-brief"
            rows={2}
            value={brief}
            onChange={(event) => {
              setBrief(event.target.value);
              mutacionBrief.reset();
            }}
            className="w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="diseno-tipo-portada" className="mb-1 block text-xs font-medium text-tinta">
              Tipo de portada
            </label>
            <select
              id="diseno-tipo-portada"
              value={tipoPortada}
              onChange={(event) => {
                setTipoPortada(event.target.value as TipoPortada | '');
                mutacionBrief.reset();
              }}
              className="rounded-md border border-tinta/20 px-2 py-1 text-sm focus:border-dorado focus:outline-none"
            >
              <option value="">Sin definir</option>
              <option value="tipografica">Tipográfica</option>
              <option value="fotografica">Fotográfica</option>
              <option value="ilustrada">Ilustrada</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-tinta">Reunión creativa</label>
            <input
              type="date"
              value={fechaReunionCreativa}
              onChange={(event) => {
                setFechaReunionCreativa(event.target.value);
                mutacionBrief.reset();
              }}
              className="rounded-md border border-tinta/20 px-2 py-1 text-sm focus:border-dorado focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-tinta">Entrega del brief</label>
            <input
              type="date"
              value={fechaEntregaBrief}
              onChange={(event) => {
                setFechaEntregaBrief(event.target.value);
                mutacionBrief.reset();
              }}
              className="rounded-md border border-tinta/20 px-2 py-1 text-sm focus:border-dorado focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-tinta">Brief aprobado</label>
            <input
              type="date"
              value={briefAprobadoFecha}
              onChange={(event) => {
                setBriefAprobadoFecha(event.target.value);
                mutacionBrief.reset();
              }}
              className="rounded-md border border-tinta/20 px-2 py-1 text-sm focus:border-dorado focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={mutacionBrief.isPending}
            className="rounded-md bg-dorado px-4 py-2 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
          >
            {mutacionBrief.isPending ? 'Guardando…' : 'Guardar brief'}
          </button>
          {mutacionBrief.isSuccess && <span className="text-sm text-green-700">Guardado ✓</span>}
          {mutacionBrief.isError && (
            <span role="alert" className="text-sm text-red-600">
              No se pudo guardar{mutacionBrief.error instanceof Error ? `: ${mutacionBrief.error.message}` : ''}.
            </span>
          )}
        </div>
      </form>

      {ficha.disenoPropuestas.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-tinta/10 pt-3 text-sm text-tinta">
          {ficha.disenoPropuestas.map((propuesta) => (
            <PropuestaRow key={propuesta.id} proyectoId={proyectoId} propuesta={propuesta} puedeEditar />
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmitPropuesta} className="mt-3 space-y-2 border-t border-tinta/10 pt-3">
        <p className="text-sm font-medium text-tinta">Agregar propuesta de portada</p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="diseno-propuesta-fecha" className="mb-1 block text-sm font-medium text-tinta">
              Enviada a especialista
            </label>
            <input
              id="diseno-propuesta-fecha"
              type="date"
              value={fechaEnviadaEspecialista}
              onChange={(event) => setFechaEnviadaEspecialista(event.target.value)}
              className="w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="diseno-propuesta-descripcion" className="mb-1 block text-sm font-medium text-tinta">
              Observaciones
            </label>
            <input
              id="diseno-propuesta-descripcion"
              type="text"
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
              className="w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            />
          </div>
        </div>
        <div>
          <label htmlFor="diseno-propuesta-enlace" className="mb-1 block text-sm font-medium text-tinta">
            Link de presentación
          </label>
          <input
            id="diseno-propuesta-enlace"
            type="text"
            value={enlace}
            onChange={(event) => setEnlace(event.target.value)}
            className="w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={mutacionPropuesta.isPending}
            className="rounded-md bg-dorado px-4 py-2 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
          >
            {mutacionPropuesta.isPending ? 'Agregando…' : 'Agregar propuesta'}
          </button>
          {mutacionPropuesta.isSuccess && <span className="text-sm text-green-700">Guardado ✓</span>}
          {mutacionPropuesta.isError && (
            <span role="alert" className="text-sm text-red-600">
              No se pudo guardar{mutacionPropuesta.error instanceof Error ? `: ${mutacionPropuesta.error.message}` : ''}.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

// Sección 4 completa: panel "Macro" (estatus agregado, dueño doble —
// especialista dueño del proyecto o disenador asignado) arriba, vista
// "Micro" (brief + propuestas, código previo sin cambios) debajo.
// puedeEditarControl llega resuelto desde ProyectoDetallePage.tsx
// porque para decidirlo hace falta el id del usuario logueado, no solo
// su rol (a diferencia de puedeEditar, que sigue siendo solo por rol).
export function SeccionDiseno({
  proyectoId,
  proyecto,
  ficha,
  puedeEditar,
  puedeEditarControl,
  rolUsuario,
}: {
  proyectoId: string;
  proyecto: ProyectoConRiesgo;
  ficha: FichaCompleta;
  puedeEditar: boolean;
  puedeEditarControl: boolean;
  rolUsuario?: Rol;
}) {
  return (
    <div className="flex w-full flex-col gap-6">
      <SeccionDisenoControl proyectoId={proyectoId} ficha={ficha} puedeEditar={puedeEditarControl} />
      <ContenidoDisenoMicro proyectoId={proyectoId} proyecto={proyecto} ficha={ficha} puedeEditar={puedeEditar} rolUsuario={rolUsuario} />
    </div>
  );
}
