import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { FichaCompleta, ParticipacionFerias, PropietarioMatrizIngreso } from '../types/api';
import { CampoFichaTecnica, conValorLegacyIncluido, formatearFechaONull, SinCompletar } from './campos';
import { PAISES } from './paises';
import { actualizarSeccionLanzamientoPromocion } from './proyectoDetalleApi';

const INPUT_CLASS =
  'w-full bg-white border border-gray-200 text-gray-900 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-tinta/20 focus:border-tinta transition-all placeholder:text-gray-400';
const LABEL_CLASS = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';
const AYUDA_CLASS = 'mt-1 text-xs text-gray-500';
const BLOQUE_CLASS = 'mb-8 pb-6 border-b border-gray-100 last:border-0';
const BLOQUE_TITULO_CLASS = 'text-base font-bold text-gray-900 mb-5 flex items-center gap-2';
const GRID_CLASS = 'grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-5';
const GRID_2COL_CLASS = 'grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2';

const PARTICIPACIONES_FERIAS: ParticipacionFerias[] = ['Sí', 'No', 'Pendiente'];

// Cerrado a Paola Morales/Daniel Valente — a pedido explícito del
// negocio, mismas dos personas y mismo enum que "Propietario" en
// SeccionMatrizIngreso.tsx (propietarioMatrizIngresoEnum, ver
// schema/enums.ts) — se reutiliza en vez de duplicar la lista.
const OPCIONES_ENCARGADO: PropietarioMatrizIngreso[] = ['Paola Morales', 'Daniel Valente'];

// "Proceso de Lanzamiento y Promoción" — Área exclusiva de RRPP, Fase
// 1, dueño exclusivo rrpp (comercial y jefatura ven de solo lectura,
// mismo patrón que Ficha Editorial/Matriz de Ingreso). NO es la Sección 7
// "Lanzamiento y promoción" del stepper (pasoActivo=7, ver
// SeccionLanzamiento.tsx) — mismo nombre de negocio, dueño y columnas
// distintas (ver el comentario completo en server/db/schema/trazabilidad.ts).
export function SeccionLanzamientoPromocion({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [fechaPrimeraReunion, setFechaPrimeraReunion] = useState(ficha.lanzamientoPromocionFechaPrimeraReunion ?? '');
  const [encargadoPrimeraReunion, setEncargadoPrimeraReunion] = useState<PropietarioMatrizIngreso | ''>(
    ficha.lanzamientoPromocionEncargadoPrimeraReunion ?? '',
  );
  const [puntosTratadosPrimera, setPuntosTratadosPrimera] = useState(ficha.lanzamientoPromocionPuntosTratadosPrimera ?? '');
  const [fechaSegundaReunion, setFechaSegundaReunion] = useState(ficha.lanzamientoPromocionFechaSegundaReunion ?? '');
  const [encargadoSegundaReunion, setEncargadoSegundaReunion] = useState<PropietarioMatrizIngreso | ''>(
    ficha.lanzamientoPromocionEncargadoSegundaReunion ?? '',
  );
  const [acuerdosSegunda, setAcuerdosSegunda] = useState(ficha.lanzamientoPromocionAcuerdosSegunda ?? '');
  const [objetivoComercial, setObjetivoComercial] = useState(ficha.lanzamientoPromocionObjetivoComercial ?? '');
  const [participacionFerias, setParticipacionFerias] = useState<ParticipacionFerias | ''>(
    ficha.lanzamientoPromocionParticipacionFerias ?? '',
  );
  const [isbn, setIsbn] = useState(ficha.lanzamientoPromocionIsbn ?? '');
  const [detallesProyeccion, setDetallesProyeccion] = useState(ficha.lanzamientoPromocionDetallesProyeccion ?? '');
  const [fechaTentativa, setFechaTentativa] = useState(ficha.lanzamientoPromocionFechaTentativa ?? '');
  const [tipo, setTipo] = useState(ficha.lanzamientoPromocionTipo ?? '');
  const [observaciones, setObservaciones] = useState(ficha.lanzamientoPromocionObservaciones ?? '');
  const [observacionesGenerales, setObservacionesGenerales] = useState(ficha.lanzamientoPromocionObservacionesGenerales ?? '');
  const [linkMinuta, setLinkMinuta] = useState(ficha.lanzamientoPromocionLinkMinuta ?? '');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionLanzamientoPromocion(proyectoId, {
        lanzamientoPromocionFechaPrimeraReunion: fechaPrimeraReunion || null,
        lanzamientoPromocionEncargadoPrimeraReunion: encargadoPrimeraReunion || null,
        lanzamientoPromocionPuntosTratadosPrimera: puntosTratadosPrimera || null,
        lanzamientoPromocionFechaSegundaReunion: fechaSegundaReunion || null,
        lanzamientoPromocionEncargadoSegundaReunion: encargadoSegundaReunion || null,
        lanzamientoPromocionAcuerdosSegunda: acuerdosSegunda || null,
        lanzamientoPromocionObjetivoComercial: objetivoComercial || null,
        lanzamientoPromocionParticipacionFerias: participacionFerias || null,
        lanzamientoPromocionIsbn: isbn || null,
        lanzamientoPromocionDetallesProyeccion: detallesProyeccion || null,
        lanzamientoPromocionFechaTentativa: fechaTentativa || null,
        lanzamientoPromocionTipo: tipo || null,
        lanzamientoPromocionObservaciones: observaciones || null,
        lanzamientoPromocionObservacionesGenerales: observacionesGenerales || null,
        lanzamientoPromocionLinkMinuta: linkMinuta || null,
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
      { etiqueta: 'Fecha 1ra reunión', valor: formatearFechaONull(ficha.lanzamientoPromocionFechaPrimeraReunion) },
      { etiqueta: 'Encargado 1ra reunión', valor: ficha.lanzamientoPromocionEncargadoPrimeraReunion },
      { etiqueta: 'Puntos tratados (1ra reunión)', valor: ficha.lanzamientoPromocionPuntosTratadosPrimera },
      { etiqueta: 'Fecha 2da reunión', valor: formatearFechaONull(ficha.lanzamientoPromocionFechaSegundaReunion) },
      { etiqueta: 'Encargado 2da reunión', valor: ficha.lanzamientoPromocionEncargadoSegundaReunion },
      { etiqueta: 'Acuerdos (2da reunión)', valor: ficha.lanzamientoPromocionAcuerdosSegunda },
      { etiqueta: 'Objetivo comercial', valor: ficha.lanzamientoPromocionObjetivoComercial },
      { etiqueta: 'Participación en ferias', valor: ficha.lanzamientoPromocionParticipacionFerias },
      { etiqueta: 'ISBN', valor: ficha.lanzamientoPromocionIsbn },
      { etiqueta: 'Detalles de proyección', valor: ficha.lanzamientoPromocionDetallesProyeccion },
      { etiqueta: 'Fecha tentativa de lanzamiento', valor: formatearFechaONull(ficha.lanzamientoPromocionFechaTentativa) },
      { etiqueta: 'Tipo de lanzamiento', valor: ficha.lanzamientoPromocionTipo },
      { etiqueta: 'Observaciones de lanzamiento', valor: ficha.lanzamientoPromocionObservaciones },
      { etiqueta: 'Observaciones generales', valor: ficha.lanzamientoPromocionObservacionesGenerales },
      { etiqueta: 'Minuta', valor: ficha.lanzamientoPromocionLinkMinuta },
    ].filter((c): c is { etiqueta: string; valor: string } => c.valor !== null && c.valor !== '');

    return (
      <div className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-medium text-tinta">Proceso de Lanzamiento y Promoción</h3>
        {conValor.length === 0 ? (
          <SinCompletar />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {conValor.map((c) => (
              <CampoFichaTecnica key={c.etiqueta} etiqueta={c.etiqueta} valor={c.valor} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="mb-6 font-medium text-tinta">Proceso de Lanzamiento y Promoción</h3>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Reuniones
        </h3>
        <div className={GRID_2COL_CLASS}>
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="lanzamiento-promocion-fecha-primera-reunion" className={LABEL_CLASS}>
                Fecha 1ra reunión
              </label>
              <input
                id="lanzamiento-promocion-fecha-primera-reunion"
                type="date"
                value={fechaPrimeraReunion}
                onChange={(event) => {
                  setFechaPrimeraReunion(event.target.value);
                  mutacion.reset();
                }}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="lanzamiento-promocion-encargado-primera-reunion" className={LABEL_CLASS}>
                Encargado
              </label>
              <select
                id="lanzamiento-promocion-encargado-primera-reunion"
                value={encargadoPrimeraReunion}
                onChange={(event) => {
                  setEncargadoPrimeraReunion(event.target.value as PropietarioMatrizIngreso);
                  mutacion.reset();
                }}
                className={INPUT_CLASS}
              >
                <option value="">Sin definir</option>
                {OPCIONES_ENCARGADO.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lanzamiento-promocion-puntos-tratados-primera" className={LABEL_CLASS}>
                Puntos tratados
              </label>
              <textarea
                id="lanzamiento-promocion-puntos-tratados-primera"
                rows={3}
                value={puntosTratadosPrimera}
                onChange={(event) => {
                  setPuntosTratadosPrimera(event.target.value);
                  mutacion.reset();
                }}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="lanzamiento-promocion-fecha-segunda-reunion" className={LABEL_CLASS}>
                Fecha 2da reunión
              </label>
              <input
                id="lanzamiento-promocion-fecha-segunda-reunion"
                type="date"
                value={fechaSegundaReunion}
                onChange={(event) => {
                  setFechaSegundaReunion(event.target.value);
                  mutacion.reset();
                }}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="lanzamiento-promocion-encargado-segunda-reunion" className={LABEL_CLASS}>
                Encargado
              </label>
              <select
                id="lanzamiento-promocion-encargado-segunda-reunion"
                value={encargadoSegundaReunion}
                onChange={(event) => {
                  setEncargadoSegundaReunion(event.target.value as PropietarioMatrizIngreso);
                  mutacion.reset();
                }}
                className={INPUT_CLASS}
              >
                <option value="">Sin definir</option>
                {OPCIONES_ENCARGADO.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lanzamiento-promocion-acuerdos-segunda" className={LABEL_CLASS}>
                Acuerdos
              </label>
              <textarea
                id="lanzamiento-promocion-acuerdos-segunda"
                rows={3}
                value={acuerdosSegunda}
                onChange={(event) => {
                  setAcuerdosSegunda(event.target.value);
                  mutacion.reset();
                }}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Proyección del Autor
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-6">
            <label htmlFor="lanzamiento-promocion-objetivo-comercial" className={LABEL_CLASS}>
              Objetivo comercial
            </label>
            <textarea
              id="lanzamiento-promocion-objetivo-comercial"
              rows={2}
              value={objetivoComercial}
              onChange={(event) => {
                setObjetivoComercial(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="lanzamiento-promocion-participacion-ferias" className={LABEL_CLASS}>
              Participación en ferias
            </label>
            <select
              id="lanzamiento-promocion-participacion-ferias"
              value={participacionFerias}
              onChange={(event) => {
                setParticipacionFerias(event.target.value as ParticipacionFerias);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {PARTICIPACIONES_FERIAS.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label htmlFor="lanzamiento-promocion-isbn" className={LABEL_CLASS}>
              ISBN (país)
            </label>
            <select
              id="lanzamiento-promocion-isbn"
              value={isbn}
              onChange={(event) => {
                setIsbn(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {conValorLegacyIncluido(PAISES, isbn).map((pais) => (
                <option key={pais} value={pais}>
                  {pais}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-12">
            <label htmlFor="lanzamiento-promocion-detalles-proyeccion" className={LABEL_CLASS}>
              Detalles
            </label>
            <textarea
              id="lanzamiento-promocion-detalles-proyeccion"
              rows={2}
              value={detallesProyeccion}
              onChange={(event) => {
                setDetallesProyeccion(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Lanzamiento
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-4">
            <label htmlFor="lanzamiento-promocion-fecha-tentativa" className={LABEL_CLASS}>
              Fecha tentativa
            </label>
            <input
              id="lanzamiento-promocion-fecha-tentativa"
              type="date"
              value={fechaTentativa}
              onChange={(event) => {
                setFechaTentativa(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="lanzamiento-promocion-tipo" className={LABEL_CLASS}>
              Tipo de lanzamiento
            </label>
            <input
              id="lanzamiento-promocion-tipo"
              type="text"
              value={tipo}
              onChange={(event) => {
                setTipo(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-12">
            <label htmlFor="lanzamiento-promocion-observaciones" className={LABEL_CLASS}>
              Observaciones
            </label>
            <textarea
              id="lanzamiento-promocion-observaciones"
              rows={2}
              value={observaciones}
              onChange={(event) => {
                setObservaciones(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Observaciones Generales
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-12">
            <label htmlFor="lanzamiento-promocion-observaciones-generales" className={LABEL_CLASS}>
              Notas adicionales
            </label>
            <textarea
              id="lanzamiento-promocion-observaciones-generales"
              rows={3}
              value={observacionesGenerales}
              onChange={(event) => {
                setObservacionesGenerales(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-12">
            <label htmlFor="lanzamiento-promocion-link-minuta" className={LABEL_CLASS}>
              Minuta
            </label>
            <input
              id="lanzamiento-promocion-link-minuta"
              type="text"
              placeholder="Pegar enlace de Google Drive aquí…"
              value={linkMinuta}
              onChange={(event) => {
                setLinkMinuta(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
            <p className={AYUDA_CLASS}>Enlace a la minuta de la reunión de lanzamiento.</p>
          </div>
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
    </form>
  );
}
