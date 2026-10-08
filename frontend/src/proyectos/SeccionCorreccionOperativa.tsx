import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Modal } from '../autores/Modal';
import type { AlcanceCorreccion, Correccion, EstadoPlazoCorreccion, ResultadoCorreccion } from '../types/api';
import { hoyISO } from './campos';
import {
  asignarCorrector,
  cerrarCorreccion,
  fetchCorreccionesDeProyecto,
  marcarInicioCorreccion,
  registrarEntregaCorreccion,
  solicitarCorreccion,
} from './correccionesApi';
import { fetchPersonalEquipo } from './proyectoDetalleApi';

const ALCANCES: { value: AlcanceCorreccion; label: string }[] = [
  { value: 'tripa_completa', label: 'Tripa Completa' },
  { value: 'preliminares', label: 'Preliminares' },
  { value: 'cubierta_extendida', label: 'Cubierta Extendida' },
];

const ETIQUETA_ALCANCE: Record<string, string> = Object.fromEntries(ALCANCES.map((a) => [a.value, a.label]));

const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-700',
  en_progreso: 'bg-blue-100 text-blue-800',
  completado: 'bg-green-100 text-green-800',
  cancelado: 'bg-gray-100 text-gray-500',
};

const ESTADO_ETIQUETA: Record<string, string> = {
  pendiente: 'Pendiente de asignación',
  en_progreso: 'En progreso',
  completado: 'Entregada',
  cancelado: 'Cancelada',
};

const PLAZO_BADGE: Record<EstadoPlazoCorreccion, string> = {
  en_tiempo: 'bg-green-100 text-green-800',
  proximo_a_vencer: 'bg-amber-100 text-amber-800',
  vencido: 'bg-red-100 text-red-800',
};

const PLAZO_ETIQUETA: Record<EstadoPlazoCorreccion, string> = {
  en_tiempo: 'En tiempo',
  proximo_a_vencer: 'Próximo a vencer',
  vencido: 'Vencido',
};

function formatearFechaCorta(fecha: string | null): string {
  if (!fecha) return '—';
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es');
}

// dueAt es timestamp completo (checkpoint 5B §0.1 — algunos alcances
// tienen SLA de 12h, no de 1 día), a diferencia de fechaAsignada/
// fechaInicio/fechaEntrega (solo `date`) — formatearFechaCorta le
// agregaría "T00:00:00" a un string que YA tiene su propia hora,
// produciendo una fecha inválida. Se muestra con hora para no esconder
// esa precisión.
function formatearFechaHora(fechaHora: string | null): string {
  if (!fechaHora) return '—';
  return new Date(fechaHora).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
}

function FormularioSolicitar({ proyectoId, onCerrar }: { proyectoId: string; onCerrar: () => void }) {
  const [alcance, setAlcance] = useState<AlcanceCorreccion>('tripa_completa');
  const [paginas, setPaginas] = useState('');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () => solicitarCorreccion(proyectoId, { alcance, paginas: paginas ? Number(paginas) : null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correcciones', proyectoId] });
      onCerrar();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-xl border border-dorado/30 bg-dorado/5 p-4">
      <div>
        <label htmlFor="correccion-alcance" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
          Alcance
        </label>
        <select
          id="correccion-alcance"
          value={alcance}
          onChange={(event) => setAlcance(event.target.value as AlcanceCorreccion)}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        >
          {ALCANCES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="correccion-paginas" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
          Páginas (Word)
        </label>
        <input
          id="correccion-paginas"
          type="number"
          min={0}
          value={paginas}
          onChange={(event) => setPaginas(event.target.value)}
          className="w-28 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
      </div>
      <button
        type="submit"
        disabled={mutacion.isPending}
        className="rounded-md bg-dorado px-4 py-2 text-sm font-semibold text-tinta transition hover:brightness-95 disabled:opacity-60"
      >
        {mutacion.isPending ? 'Solicitando…' : 'Solicitar corrección'}
      </button>
      <button type="button" onClick={onCerrar} className="text-xs text-gray-500 underline hover:text-gray-700">
        Cancelar
      </button>
      {mutacion.isError && (
        <span role="alert" className="text-xs text-red-600">
          No se pudo solicitar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
        </span>
      )}
    </form>
  );
}

function ModalAsignar({ correccion, proyectoId, onClose }: { correccion: Correccion; proyectoId: string; onClose: () => void }) {
  const personalQuery = useQuery({ queryKey: ['usuarios'], queryFn: fetchPersonalEquipo });
  const correctoresInternos = personalQuery.data?.usuarios.filter((u) => u.rol === 'corrector') ?? [];

  const [modo, setModo] = useState<'interno' | 'freelance'>('interno');
  const [correctorId, setCorrectorId] = useState('');
  const [correctorNombre, setCorrectorNombre] = useState('');
  const [contratoConfirmado, setContratoConfirmado] = useState(false);
  const [revisionPreviaConfirmada, setRevisionPreviaConfirmada] = useState(correccion.revisionPreviaConfirmada);
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      asignarCorrector(correccion.id, {
        correctorId: modo === 'interno' ? correctorId : null,
        correctorNombre: modo === 'freelance' ? correctorNombre : null,
        freelance: modo === 'freelance',
        contratoConfirmado,
        revisionPreviaConfirmada,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correcciones', proyectoId] });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  const yaTeniaCorrector = Boolean(correccion.correctorId || correccion.correctorNombre);

  return (
    <Modal titulo={yaTeniaCorrector ? 'Reasignar corrector' : 'Asignar corrector'} subtitulo={ETIQUETA_ALCANCE[correccion.alcance]} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto p-6">
        {correccion.requiereRevisionPrevia && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Esta tripa supera las 120 páginas — el Manual exige revisión previa antes de asignar (costo evaluado caso por caso, no calculado aquí).
            <label className="mt-2 flex items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={revisionPreviaConfirmada} onChange={(event) => setRevisionPreviaConfirmada(event.target.checked)} />
              Confirmo que ya se hizo la revisión previa
            </label>
          </div>
        )}

        <div className="flex gap-2 rounded-lg bg-gray-100 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setModo('interno')}
            className={`flex-1 rounded-md px-3 py-1.5 ${modo === 'interno' ? 'bg-white text-tinta shadow-sm' : 'text-gray-500'}`}
          >
            Corrector interno
          </button>
          <button
            type="button"
            onClick={() => setModo('freelance')}
            className={`flex-1 rounded-md px-3 py-1.5 ${modo === 'freelance' ? 'bg-white text-tinta shadow-sm' : 'text-gray-500'}`}
          >
            Freelance
          </button>
        </div>

        {modo === 'interno' ? (
          <div>
            <label htmlFor="asignar-corrector-interno" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Corrector
            </label>
            <select
              id="asignar-corrector-interno"
              required
              value={correctorId}
              onChange={(event) => setCorrectorId(event.target.value)}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            >
              <option value="">Seleccionar…</option>
              {correctoresInternos.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
            {correctoresInternos.length === 0 && <p className="mt-1 text-xs text-gray-500">No hay correctores internos registrados todavía.</p>}
          </div>
        ) : (
          <div>
            <label htmlFor="asignar-corrector-freelance" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Nombre del corrector freelance
            </label>
            <input
              id="asignar-corrector-freelance"
              type="text"
              required
              value={correctorNombre}
              onChange={(event) => setCorrectorNombre(event.target.value)}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
              placeholder="Ej. Genesis Herrera"
            />
            <p className="mt-1 text-xs text-gray-500">Sin cuenta de sistema — tú registrarás su inicio y entrega.</p>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={contratoConfirmado} onChange={(event) => setContratoConfirmado(event.target.checked)} />
          Talento Humano confirmó la recepción del contrato firmado
        </label>

        <div className="mt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={mutacion.isPending}
            className="rounded-md bg-tinta px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
          >
            {mutacion.isPending ? 'Guardando…' : yaTeniaCorrector ? 'Reasignar' : 'Asignar'}
          </button>
          {mutacion.isError && (
            <span role="alert" className="text-xs text-red-600">
              No se pudo asignar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
            </span>
          )}
        </div>
      </form>
    </Modal>
  );
}

function ModalCerrar({ correccion, proyectoId, onClose }: { correccion: Correccion; proyectoId: string; onClose: () => void }) {
  const [resultado, setResultado] = useState<ResultadoCorreccion>('buena');
  const [observaciones, setObservaciones] = useState('');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () => cerrarCorreccion(correccion.id, { resultado, observaciones: observaciones || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correcciones', proyectoId] });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <Modal titulo="Cerrar corrección" subtitulo={ETIQUETA_ALCANCE[correccion.alcance]} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
        <div>
          <label htmlFor="cierre-resultado" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
            Resultado
          </label>
          <select
            id="cierre-resultado"
            value={resultado}
            onChange={(event) => setResultado(event.target.value as ResultadoCorreccion)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
          >
            <option value="buena">Buena</option>
            <option value="regular">Regular</option>
            <option value="deficiente">Deficiente</option>
          </select>
        </div>
        <div>
          <label htmlFor="cierre-observaciones" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
            Observaciones
          </label>
          <textarea
            id="cierre-observaciones"
            rows={3}
            value={observaciones}
            onChange={(event) => setObservaciones(event.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={mutacion.isPending}
            className="rounded-md bg-tinta px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
          >
            {mutacion.isPending ? 'Guardando…' : 'Cerrar corrección'}
          </button>
          {mutacion.isError && (
            <span role="alert" className="text-xs text-red-600">
              No se pudo cerrar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
            </span>
          )}
        </div>
      </form>
    </Modal>
  );
}

// Entrega rápida (fecha + enlaces) — el Especialista solo la ve cuando
// el corrector es freelance (sin cuenta, no puede registrarla él
// mismo); si es interno, esta acción vive en "Mis Correcciones" del
// corrector, no acá (mismo 403 que ya aplica el backend).
function AccionesEjecucionFreelance({ correccion, proyectoId }: { correccion: Correccion; proyectoId: string }) {
  const [fechaInicio, setFechaInicio] = useState(hoyISO());
  const [fechaEntrega, setFechaEntrega] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  const [controlCambiosUrl, setControlCambiosUrl] = useState('');
  const [informeTecnicoUrl, setInformeTecnicoUrl] = useState('');
  const queryClient = useQueryClient();

  const inicioMutacion = useMutation({
    mutationFn: () => marcarInicioCorreccion(correccion.id, fechaInicio),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['correcciones', proyectoId] }),
  });

  const entregaMutacion = useMutation({
    mutationFn: () => registrarEntregaCorreccion(correccion.id, { fecha: fechaEntrega.slice(0, 10), entregadoEn: new Date(fechaEntrega).toISOString(), controlCambiosUrl: controlCambiosUrl || null, informeTecnicoUrl: informeTecnicoUrl || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['correcciones', proyectoId] }),
  });

  if (!correccion.fechaInicio) {
    return (
      <div className="mt-3 flex items-end gap-2">
        <input
          type="date"
          value={fechaInicio}
          onChange={(event) => setFechaInicio(event.target.value)}
          className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => inicioMutacion.mutate()}
          disabled={inicioMutacion.isPending}
          className="rounded-md bg-tinta px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          Marcar inicio
        </button>
      </div>
    );
  }

  if (!correccion.fechaEntrega) {
    return (
      <div className="mt-3 flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
        <div className="flex gap-2">
          <input
            type="datetime-local"
            aria-label="Fecha y hora real de entrega"
            value={fechaEntrega}
            onChange={(event) => setFechaEntrega(event.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          />
          <input
            type="text"
            placeholder="Enlace control de cambios"
            value={controlCambiosUrl}
            onChange={(event) => setControlCambiosUrl(event.target.value)}
            className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          />
        </div>
        <input
          type="text"
          placeholder="Enlace informe técnico"
          value={informeTecnicoUrl}
          onChange={(event) => setInformeTecnicoUrl(event.target.value)}
          className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => entregaMutacion.mutate()}
          disabled={entregaMutacion.isPending}
          className="self-start rounded-md bg-dorado px-3 py-1.5 text-xs font-semibold text-tinta hover:brightness-95 disabled:opacity-60"
        >
          Registrar entrega
        </button>
      </div>
    );
  }

  return null;
}

function TarjetaCorreccion({ correccion, proyectoId, puedeOperar }: { correccion: Correccion; proyectoId: string; puedeOperar: boolean }) {
  const [modalActivo, setModalActivo] = useState<'asignar' | 'cerrar' | null>(null);
  const tieneCorrector = Boolean(correccion.correctorId || correccion.correctorNombre);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-bold text-gray-900">{ETIQUETA_ALCANCE[correccion.alcance] ?? correccion.alcance}</h4>
          {correccion.paginas != null && <p className="text-xs text-gray-500">{correccion.paginas} páginas</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_BADGE[correccion.estado] ?? 'bg-gray-100 text-gray-700'}`}>
            {ESTADO_ETIQUETA[correccion.estado] ?? correccion.estado}
          </span>
          {correccion.plazo && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PLAZO_BADGE[correccion.plazo]}`}>{PLAZO_ETIQUETA[correccion.plazo]}</span>
          )}
          {correccion.resultado && (
            <span className="rounded-full bg-tinta px-2.5 py-1 text-xs font-medium text-white">Resultado: {correccion.resultado}</span>
          )}
        </div>
      </div>

      {correccion.requiereRevisionPrevia && !correccion.revisionPreviaConfirmada && (
        <p className="mt-2 text-xs font-medium text-amber-700">⚠ Supera 120 páginas — requiere revisión previa antes de asignar.</p>
      )}

      {tieneCorrector && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-gray-400">Corrector</dt>
            <dd className="font-medium text-gray-800">{correccion.correctorNombre ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Vence</dt>
            <dd className="font-medium text-gray-800">{formatearFechaHora(correccion.dueAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Inicio</dt>
            <dd className="font-medium text-gray-800">{formatearFechaCorta(correccion.fechaInicio)}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Entrega</dt>
            <dd className="font-medium text-gray-800">{correccion.entregadoEn ? formatearFechaHora(correccion.entregadoEn) : formatearFechaCorta(correccion.fechaEntrega)}</dd>
          </div>
        </dl>
      )}

      {(correccion.controlCambiosUrl || correccion.informeTecnicoUrl) && (
        <div className="mt-2 flex gap-3 text-xs">
          {correccion.controlCambiosUrl && (
            <a href={correccion.controlCambiosUrl} target="_blank" rel="noreferrer" className="text-dorado underline">
              Control de cambios
            </a>
          )}
          {correccion.informeTecnicoUrl && (
            <a href={correccion.informeTecnicoUrl} target="_blank" rel="noreferrer" className="text-dorado underline">
              Informe técnico
            </a>
          )}
        </div>
      )}

      {puedeOperar && !tieneCorrector && (
        <button
          type="button"
          onClick={() => setModalActivo('asignar')}
          className="mt-3 rounded-md bg-dorado px-3 py-1.5 text-xs font-semibold text-tinta hover:brightness-95"
        >
          Asignar corrector
        </button>
      )}

      {puedeOperar && tieneCorrector && correccion.estado !== 'completado' && (
        <button type="button" onClick={() => setModalActivo('asignar')} className="mt-3 text-xs font-medium text-dorado underline">
          Reasignar
        </button>
      )}

      {puedeOperar && correccion.freelance && correccion.estado !== 'completado' && tieneCorrector && (
        <AccionesEjecucionFreelance correccion={correccion} proyectoId={proyectoId} />
      )}

      {puedeOperar && correccion.estado === 'completado' && !correccion.resultado && (
        <button
          type="button"
          onClick={() => setModalActivo('cerrar')}
          className="mt-3 rounded-md bg-tinta px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
        >
          Cerrar con resultado
        </button>
      )}

      {modalActivo === 'asignar' && <ModalAsignar correccion={correccion} proyectoId={proyectoId} onClose={() => setModalActivo(null)} />}
      {modalActivo === 'cerrar' && <ModalCerrar correccion={correccion} proyectoId={proyectoId} onClose={() => setModalActivo(null)} />}
    </div>
  );
}

// Pipeline operativo real de Corrección (Fase 5, 5B) — distinto de
// SeccionCorreccion.tsx (resumen macro "Control de Especialista" de la
// ficha, sin tocar): acá viven las intervenciones reales con
// work_item/assignment/SLA/audit, mismo criterio que capitulos.ts para
// Edición. puedeOperar = especialista dueño del proyecto (único rol que
// solicita/asigna/cierra, ver Manual §3.1 — acá no hay jefatura
// intermedia a diferencia de Edición).
export function SeccionCorreccionOperativa({ proyectoId, puedeOperar }: { proyectoId: string; puedeOperar: boolean }) {
  const correccionesQuery = useQuery({ queryKey: ['correcciones', proyectoId], queryFn: () => fetchCorreccionesDeProyecto(proyectoId) });
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const correcciones = correccionesQuery.data?.correcciones ?? [];

  return (
    <div className="mb-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <span className="h-2 w-2 rounded-full bg-dorado" /> Corrección — Pipeline Operativo
        </h3>
        {puedeOperar && !mostrarFormulario && (
          <button type="button" onClick={() => setMostrarFormulario(true)} className="text-sm font-medium text-dorado hover:underline">
            + Solicitar corrección
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 p-6">
        {mostrarFormulario && <FormularioSolicitar proyectoId={proyectoId} onCerrar={() => setMostrarFormulario(false)} />}

        {correccionesQuery.isLoading && <p className="text-sm text-gray-500">Cargando correcciones…</p>}
        {correccionesQuery.isError && (
          <p role="alert" className="text-sm text-red-600">
            No se pudieron cargar las correcciones
            {correccionesQuery.error instanceof Error ? `: ${correccionesQuery.error.message}` : ''}.
          </p>
        )}

        {correccionesQuery.data && correcciones.length === 0 && !mostrarFormulario && (
          <p className="text-sm text-gray-500">Todavía no se ha solicitado ninguna corrección para este proyecto.</p>
        )}

        {correcciones.map((correccion) => (
          <TarjetaCorreccion key={correccion.id} correccion={correccion} proyectoId={proyectoId} puedeOperar={puedeOperar} />
        ))}
      </div>
    </div>
  );
}
