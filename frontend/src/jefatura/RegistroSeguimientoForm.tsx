import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { SelectorProyecto } from '../comercial/SelectorProyecto';
import { conValorLegacyIncluido } from '../proyectos/campos';
import { fetchPersonalEquipo } from '../proyectos/proyectoDetalleApi';
import { fetchProyectosActivos } from '../proyectos/proyectosApi';
import type { ProyectoResumen, RegistroSeguimiento } from '../types/api';
import { actualizarRegistroSeguimiento, crearRegistroSeguimiento } from './seguimientoApi';

// Mismo lenguaje visual que CrearAutorForm.tsx (formulario largo dentro
// de un Modal): fondo gris claro + foco dorado, en vez del focus:ring
// tinta que usan las secciones de página completa (SeccionMatrizAsesorias.tsx).
const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40';
const LABEL_CLASS = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500';
const CHECKBOX_CLASS = 'h-4 w-4 rounded border-gray-300 text-dorado focus:outline-none focus:ring-2 focus:ring-dorado/40';
// Separador entre bloques temáticos, mismo criterio que
// SeccionMatrizAsesorias.tsx (BLOQUE_CLASS) — borde inferior en vez de
// espaciado suelto, para que un formulario con ~20 campos se lea como
// grupos, no como una lista plana.
const BLOQUE_CLASS = 'mb-6 border-b border-gray-100 pb-6 last:mb-0 last:border-0 last:pb-0';
const BLOQUE_TITULO_CLASS = 'mb-4 text-xs font-bold uppercase tracking-wide text-dorado';
const GRID_CLASS = 'grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3';

// Sugerencias vistas en el Excel real ("Seguimiento Corrección") — no
// son catálogos cerrados confirmados, mismo criterio que el resto del
// backend (ver schema/seguimiento.ts): <select> de sugerencias sobre un
// campo de texto libre, con conValorLegacyIncluido como red de
// seguridad.
const SUGERENCIAS_ASIGNACION = ['TRIPA DIAGRAMADA', 'CUBIERTA EXTENDIDA', 'TRIPA COMPLETA', 'PRELIMINARES'] as const;
const SUGERENCIAS_TIPO_SERVICIO = ['Validación', 'Corrección', 'Fase de Calidad 1', 'Revisión Final'] as const;
const SUGERENCIAS_ESTATUS = ['Entregado', 'En proceso'] as const;

// Formulario real de "Control de Tiempos" — reemplaza el modal stub de
// SeguimientoPage.tsx ("función en desarrollo"). Mismo componente sirve
// para crear (registro=null, proyectoId fijo desde afuera si ya se
// conoce) y para editar una fila existente (registro!=null, proyecto ya
// fijo y de solo lectura — una fila nunca cambia de proyecto). Vive
// dentro de <Modal ancho="3xl">: al ser ~20 campos necesita más aire que
// el max-w-md por defecto de los otros modales (Autor, Proyecto, etc.).
export function RegistroSeguimientoForm({
  registro,
  onGuardado,
  onCancelar,
}: {
  registro: RegistroSeguimiento | null;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const proyectosQuery = useQuery({ queryKey: ['proyectos', 'activos'], queryFn: fetchProyectosActivos });
  const personalQuery = useQuery({ queryKey: ['usuarios'], queryFn: fetchPersonalEquipo });
  const queryClient = useQueryClient();

  const [proyecto, setProyecto] = useState<ProyectoResumen | null>(
    registro ? { id: registro.proyecto.id, titulo: null, estado: 'en_proceso', autor: { id: '', nombre: registro.proyecto.autorNombre }, servicio: { id: '', codigo: '', nombre: '' } } : null,
  );
  const [analistaId, setAnalistaId] = useState(registro?.analista?.id ?? '');
  const [especialistaId, setEspecialistaId] = useState(registro?.especialista?.id ?? '');
  const [asignacionTipo, setAsignacionTipo] = useState(registro?.asignacionTipo ?? '');
  const [tipoServicio, setTipoServicio] = useState(registro?.tipoServicio ?? '');
  const [paginas, setPaginas] = useState(registro?.paginas != null ? String(registro.paginas) : '');
  const [fechaAsignada, setFechaAsignada] = useState(registro?.fechaAsignada ?? '');
  const [horaRecibida, setHoraRecibida] = useState(registro?.horaRecibida ?? '');
  const [fechaInicio, setFechaInicio] = useState(registro?.fechaInicio ?? '');
  const [horaInicio, setHoraInicio] = useState(registro?.horaInicio ?? '');
  const [fechaEntrega, setFechaEntrega] = useState(registro?.fechaEntrega ?? '');
  const [horaEntrega, setHoraEntrega] = useState(registro?.horaEntrega ?? '');
  const [estatus, setEstatus] = useState(registro?.estatus ?? '');
  const [totalDias, setTotalDias] = useState(registro?.totalDias ?? '');
  const [totalHoras, setTotalHoras] = useState(registro?.totalHoras ?? '');
  const [tiempoCorrecto, setTiempoCorrecto] = useState(registro?.tiempoCorrecto ?? '');
  const [observaciones, setObservaciones] = useState(registro?.observaciones ?? '');
  const [freelance, setFreelance] = useState(registro?.freelance ?? false);
  const [pago80, setPago80] = useState(registro?.pago80 ?? false);
  const [pago20, setPago20] = useState(registro?.pago20 ?? false);
  const [resultadosCorreccion, setResultadosCorreccion] = useState(registro?.resultadosCorreccion ?? '');
  const [cantidadComentarios, setCantidadComentarios] = useState(
    registro?.cantidadComentarios != null ? String(registro.cantidadComentarios) : '',
  );
  const [cumplimiento, setCumplimiento] = useState(registro?.cumplimiento ?? '');

  const datosComunes = {
    analistaId: analistaId || null,
    especialistaId: especialistaId || null,
    asignacionTipo: asignacionTipo || null,
    tipoServicio: tipoServicio || null,
    paginas: paginas ? Number(paginas) : null,
    fechaAsignada: fechaAsignada || null,
    horaRecibida: horaRecibida || null,
    fechaInicio: fechaInicio || null,
    horaInicio: horaInicio || null,
    fechaEntrega: fechaEntrega || null,
    horaEntrega: horaEntrega || null,
    estatus: estatus || null,
    totalDias: totalDias || null,
    totalHoras: totalHoras || null,
    tiempoCorrecto: tiempoCorrecto || null,
    observaciones: observaciones || null,
    freelance,
    pago80,
    pago20,
    resultadosCorreccion: resultadosCorreccion || null,
    cantidadComentarios: cantidadComentarios ? Number(cantidadComentarios) : null,
    cumplimiento: cumplimiento || null,
  };

  const mutacion = useMutation({
    mutationFn: () => {
      if (registro) return actualizarRegistroSeguimiento(registro.id, datosComunes);
      if (!proyecto) throw new Error('Elegí un proyecto antes de guardar.');
      return crearRegistroSeguimiento({ proyectoId: proyecto.id, ...datosComunes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seguimiento'] });
      onGuardado();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    // Mismo esqueleto de tres pisos que CrearAutorForm.tsx: Modal.tsx ya
    // entrega un slot acotado en alto (flex-1 min-h-0, sin su propio
    // scroll ni padding) — este <form> se estira para llenarlo y reparte
    // adentro cuerpo scrolleable (p-6) + footer fijo (sin sticky).
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className={BLOQUE_CLASS}>
          <label className={LABEL_CLASS}>Proyecto</label>
          {registro ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900">
              {registro.proyecto.autorNombre} <span className="text-gray-400">#{registro.proyecto.codigo}</span>
            </p>
          ) : (
            <SelectorProyecto proyectos={proyectosQuery.data?.proyectos ?? []} proyectoSeleccionado={proyecto} onSeleccionar={setProyecto} />
          )}
        </div>

        <div className={BLOQUE_CLASS}>
          <h3 className={BLOQUE_TITULO_CLASS}>Asignación</h3>
          <div className={GRID_CLASS}>
            <div>
              <label htmlFor="seguimiento-asignacion-tipo" className={LABEL_CLASS}>
                Asignación / tipo
              </label>
              <select
                id="seguimiento-asignacion-tipo"
                value={asignacionTipo}
                onChange={(event) => setAsignacionTipo(event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Sin definir</option>
                {conValorLegacyIncluido(SUGERENCIAS_ASIGNACION, asignacionTipo).map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="seguimiento-especialista" className={LABEL_CLASS}>
                Especialista
              </label>
              <select
                id="seguimiento-especialista"
                value={especialistaId}
                onChange={(event) => setEspecialistaId(event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Sin definir</option>
                {personalQuery.data?.usuarios.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="seguimiento-paginas" className={LABEL_CLASS}>
                Páginas
              </label>
              <input
                id="seguimiento-paginas"
                type="number"
                min="0"
                value={paginas}
                onChange={(event) => setPaginas(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>

        <div className={BLOQUE_CLASS}>
          <h3 className={BLOQUE_TITULO_CLASS}>Cronograma</h3>
          <div className={GRID_CLASS}>
            <div>
              <label htmlFor="seguimiento-fecha-asignada" className={LABEL_CLASS}>
                Fecha asignada
              </label>
              <input
                id="seguimiento-fecha-asignada"
                type="date"
                value={fechaAsignada}
                onChange={(event) => setFechaAsignada(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="seguimiento-hora-recibida" className={LABEL_CLASS}>
                Hora recibida
              </label>
              <input
                id="seguimiento-hora-recibida"
                type="time"
                value={horaRecibida}
                onChange={(event) => setHoraRecibida(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div />
            <div>
              <label htmlFor="seguimiento-fecha-inicio" className={LABEL_CLASS}>
                Fecha inicio proceso
              </label>
              <input
                id="seguimiento-fecha-inicio"
                type="date"
                value={fechaInicio}
                onChange={(event) => setFechaInicio(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="seguimiento-hora-inicio" className={LABEL_CLASS}>
                Hora inicio proceso
              </label>
              <input
                id="seguimiento-hora-inicio"
                type="time"
                value={horaInicio}
                onChange={(event) => setHoraInicio(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div />
            <div>
              <label htmlFor="seguimiento-fecha-entrega" className={LABEL_CLASS}>
                Fecha entrega
              </label>
              <input
                id="seguimiento-fecha-entrega"
                type="date"
                value={fechaEntrega}
                onChange={(event) => setFechaEntrega(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="seguimiento-hora-entrega" className={LABEL_CLASS}>
                Hora entrega
              </label>
              <input
                id="seguimiento-hora-entrega"
                type="time"
                value={horaEntrega}
                onChange={(event) => setHoraEntrega(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>

        <div className={BLOQUE_CLASS}>
          <h3 className={BLOQUE_TITULO_CLASS}>Analista y estatus</h3>
          <div className={GRID_CLASS}>
            <div>
              <label htmlFor="seguimiento-analista" className={LABEL_CLASS}>
                Analista
              </label>
              <select
                id="seguimiento-analista"
                value={analistaId}
                onChange={(event) => setAnalistaId(event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Sin definir</option>
                {personalQuery.data?.usuarios.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="seguimiento-tipo-servicio" className={LABEL_CLASS}>
                Tipo de servicio
              </label>
              <select
                id="seguimiento-tipo-servicio"
                value={tipoServicio}
                onChange={(event) => setTipoServicio(event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Sin definir</option>
                {conValorLegacyIncluido(SUGERENCIAS_TIPO_SERVICIO, tipoServicio).map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="seguimiento-estatus" className={LABEL_CLASS}>
                Estatus
              </label>
              <select id="seguimiento-estatus" value={estatus} onChange={(event) => setEstatus(event.target.value)} className={INPUT_CLASS}>
                <option value="">Sin definir</option>
                {conValorLegacyIncluido(SUGERENCIAS_ESTATUS, estatus).map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="seguimiento-total-dias" className={LABEL_CLASS}>
                Total días
              </label>
              <input
                id="seguimiento-total-dias"
                type="text"
                inputMode="decimal"
                value={totalDias}
                onChange={(event) => setTotalDias(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="seguimiento-total-horas" className={LABEL_CLASS}>
                Total horas
              </label>
              <input
                id="seguimiento-total-horas"
                type="text"
                inputMode="decimal"
                value={totalHoras}
                onChange={(event) => setTotalHoras(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="seguimiento-tiempo-correcto" className={LABEL_CLASS}>
                Tiempo correcto
              </label>
              <input
                id="seguimiento-tiempo-correcto"
                type="text"
                value={tiempoCorrecto}
                onChange={(event) => setTiempoCorrecto(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>

        <div className={BLOQUE_CLASS}>
          <h3 className={BLOQUE_TITULO_CLASS}>Pago a freelance</h3>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <input
                id="seguimiento-freelance"
                type="checkbox"
                checked={freelance}
                onChange={(event) => setFreelance(event.target.checked)}
                className={CHECKBOX_CLASS}
              />
              <label htmlFor="seguimiento-freelance" className="text-sm font-medium text-gray-700">
                Freelance
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="seguimiento-pago-80"
                type="checkbox"
                checked={pago80}
                onChange={(event) => setPago80(event.target.checked)}
                className={CHECKBOX_CLASS}
              />
              <label htmlFor="seguimiento-pago-80" className="text-sm font-medium text-gray-700">
                Pago 80%
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="seguimiento-pago-20"
                type="checkbox"
                checked={pago20}
                onChange={(event) => setPago20(event.target.checked)}
                className={CHECKBOX_CLASS}
              />
              <label htmlFor="seguimiento-pago-20" className="text-sm font-medium text-gray-700">
                Pago 20%
              </label>
            </div>
          </div>
        </div>

        <div className={BLOQUE_CLASS}>
          <h3 className={BLOQUE_TITULO_CLASS}>Calidad y observaciones</h3>
          <div className={GRID_CLASS}>
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="seguimiento-cantidad-comentarios" className={LABEL_CLASS}>
                Cantidad de comentarios aunados a corrección
              </label>
              <input
                id="seguimiento-cantidad-comentarios"
                type="number"
                min="0"
                value={cantidadComentarios}
                onChange={(event) => setCantidadComentarios(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="seguimiento-cumplimiento" className={LABEL_CLASS}>
                Cumplimiento
              </label>
              <input
                id="seguimiento-cumplimiento"
                type="text"
                value={cumplimiento}
                onChange={(event) => setCumplimiento(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="seguimiento-resultados-correccion" className={LABEL_CLASS}>
              Resultados de la corrección
            </label>
            <textarea
              id="seguimiento-resultados-correccion"
              rows={2}
              value={resultadosCorreccion}
              onChange={(event) => setResultadosCorreccion(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="mt-4">
            <label htmlFor="seguimiento-observaciones" className={LABEL_CLASS}>
              Observaciones
            </label>
            <textarea
              id="seguimiento-observaciones"
              rows={2}
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-none items-center gap-3 border-t border-gray-200 bg-white p-4">
        <button
          type="submit"
          disabled={mutacion.isPending || (!registro && !proyecto)}
          className="rounded-lg bg-dorado px-4 py-2.5 text-sm font-semibold text-tinta shadow-sm transition hover:brightness-95 disabled:opacity-60"
        >
          {mutacion.isPending ? 'Guardando…' : registro ? 'Guardar cambios' : 'Crear registro'}
        </button>
        <button type="button" onClick={onCancelar} className="text-xs font-medium text-gray-500 underline hover:text-gray-800">
          Cancelar
        </button>
        {mutacion.isError && (
          <span role="alert" className="text-xs text-red-600">
            No se pudo guardar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
          </span>
        )}
      </div>
    </form>
  );
}
