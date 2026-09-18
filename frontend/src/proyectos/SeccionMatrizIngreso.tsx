import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { AutorConPerfil, EstadoReunion, FichaCompleta, PropietarioMatrizIngreso, Servicio } from '../types/api';
import { CampoFichaTecnica, formatearFechaONull, SinCompletar } from './campos';
import { EtiquetasVentaCruzada } from './EtiquetasVentaCruzada';
import { actualizarSeccionMatrizIngreso } from './proyectoDetalleApi';

const INPUT_CLASS =
  'w-full bg-white border border-gray-200 text-gray-900 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-tinta/20 focus:border-tinta transition-all placeholder:text-gray-400';
const LABEL_CLASS = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';
const BLOQUE_CLASS = 'mb-8 pb-6 border-b border-gray-100 last:border-0';
const BLOQUE_TITULO_CLASS = 'text-base font-bold text-gray-900 mb-5 flex items-center gap-2';
const GRID_CLASS = 'grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-5';
const CHECKBOX_CLASS = 'h-4 w-4 rounded border-tinta/20 text-dorado focus:outline-none focus:ring-1 focus:ring-dorado';

const ESTADOS_REUNION: EstadoReunion[] = [
  'Reunión de ingreso',
  'Revisión de objetivos',
  'Reunión creativa',
  'Reunión de promoción, lanzamiento y distribución',
];

const PROPIETARIOS_MATRIZ_INGRESO: PropietarioMatrizIngreso[] = ['Paola Morales', 'Daniel Valente'];

// Código real del servicio "Crudo" en el catálogo — ver
// CODIGOS_SERVICIO_PERMITIDOS_EN_ALTA en server/helpers/proyectos.ts.
const CODIGO_SERVICIO_CRUDO = 'CR';

// Coautoría: varios autores pueden traer el mismo país/nacionalidad —
// se listan sin repetir, mismo criterio que el resto de la app para
// campos agregados de un array de autores.
function valoresUnicos(valores: (string | null)[]): string {
  const limpios = Array.from(new Set(valores.filter((v): v is string => Boolean(v))));
  return limpios.join(', ');
}

// "Servicio Adquirido" (Datos Sincronizados) — campo calculado, sin
// columna propia: para Crudo, el servicio base elegido al crear el
// proyecto no distingue Capítulo/Tripa (ver CODIGOS_SERVICIO_PERMITIDOS_EN_ALTA),
// eso lo define rrpp después en ingresoServicioSubtipoCrudo (Sección 1,
// "Datos de Ingreso" — no es un campo propio de esta matriz). advertencia
// en rojo cuando Crudo todavía no tiene subtipo: es información real que
// falta, no un simple "sin completar".
function calcularServicioAdquirido(servicio: Servicio, subtipoCrudo: string | null): { valor: string; advertencia: boolean } {
  if (servicio.codigo !== CODIGO_SERVICIO_CRUDO) {
    return { valor: servicio.nombre, advertencia: false };
  }
  if (subtipoCrudo) {
    return { valor: `Crudo — ${subtipoCrudo}`, advertencia: false };
  }
  return { valor: 'Crudo — [Esperando selección en ficha de trazabilidad]', advertencia: true };
}

// "Matriz de Ingreso (RRPP)" — dueño rrpp/jefe_area, comercial ve de
// solo lectura (mismo alcance que "Ficha Editorial", ver
// SeccionFichaEditorial.tsx). El Bloque 1 ("Datos Sincronizados") es de
// solo lectura para todos los roles, sin excepción: no tiene columnas
// propias, sale de `autores` y de ingresoFechaIngreso/posibleTituloLibro
// (ver el comentario completo en server/db/schema/trazabilidad.ts) — no
// tendría sentido "editarlo" desde acá, esos valores ya se editan en sus
// propias secciones.
export function SeccionMatrizIngreso({
  proyectoId,
  ficha,
  autores,
  servicio,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  autores: AutorConPerfil[];
  servicio: Servicio;
  puedeEditar: boolean;
}) {
  const [ciudadResidencia, setCiudadResidencia] = useState(ficha.matrizCiudadResidencia ?? '');
  const [estadoReunion, setEstadoReunion] = useState<EstadoReunion | ''>(ficha.matrizEstadoReunion ?? '');
  const [propietario, setPropietario] = useState<PropietarioMatrizIngreso | ''>(ficha.matrizPropietario ?? '');
  const [contratoFirmado, setContratoFirmado] = useState(ficha.matrizContratoFirmado);
  const [bienvenidaGenerada, setBienvenidaGenerada] = useState(ficha.matrizBienvenidaGenerada);
  const [linkResumen, setLinkResumen] = useState(ficha.matrizLinkResumen ?? '');
  const [diagnosticoGenerado, setDiagnosticoGenerado] = useState(ficha.matrizDiagnosticoGenerado);
  const [linkDiagnostico, setLinkDiagnostico] = useState(ficha.matrizLinkDiagnostico ?? '');
  const [ingresoGenerado, setIngresoGenerado] = useState(ficha.matrizIngresoGenerado);
  const [fechaReunionCreativa, setFechaReunionCreativa] = useState(ficha.matrizFechaReunionCreativa ?? '');
  const [ventaCruzada, setVentaCruzada] = useState<string[]>(ficha.matrizVentaCruzada ?? []);
  const [observacionesComerciales, setObservacionesComerciales] = useState(ficha.matrizObservacionesComerciales ?? '');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionMatrizIngreso(proyectoId, {
        matrizCiudadResidencia: ciudadResidencia || null,
        matrizEstadoReunion: estadoReunion || null,
        matrizPropietario: propietario || null,
        matrizContratoFirmado: contratoFirmado,
        matrizBienvenidaGenerada: bienvenidaGenerada,
        matrizLinkResumen: linkResumen || null,
        matrizDiagnosticoGenerado: diagnosticoGenerado,
        matrizLinkDiagnostico: linkDiagnostico || null,
        matrizIngresoGenerado: ingresoGenerado,
        matrizFechaReunionCreativa: fechaReunionCreativa || null,
        matrizVentaCruzada: ventaCruzada.length > 0 ? ventaCruzada : null,
        matrizObservacionesComerciales: observacionesComerciales || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  const servicioAdquirido = calcularServicioAdquirido(servicio, ficha.ingresoServicioSubtipoCrudo);

  const datosSincronizados = [
    { etiqueta: 'Nombre completo del autor', valor: valoresUnicos(autores.map((a) => a.nombre)) || null, advertencia: false },
    { etiqueta: 'Nacionalidad', valor: valoresUnicos(autores.flatMap((a) => a.nacionalidad ?? [])) || null, advertencia: false },
    { etiqueta: 'País de residencia', valor: valoresUnicos(autores.map((a) => a.pais)) || null, advertencia: false },
    { etiqueta: 'Fecha de ingreso', valor: formatearFechaONull(ficha.ingresoFechaIngreso), advertencia: false },
    { etiqueta: 'Título tentativo', valor: ficha.posibleTituloLibro, advertencia: false },
    { etiqueta: 'Servicio adquirido', valor: servicioAdquirido.valor, advertencia: servicioAdquirido.advertencia },
  ].filter((c): c is { etiqueta: string; valor: string; advertencia: boolean } => c.valor !== null && c.valor !== '');

  const bloqueSincronizado = (
    <div className={puedeEditar ? BLOQUE_CLASS : undefined}>
      {puedeEditar && (
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Datos Sincronizados
        </h3>
      )}
      {datosSincronizados.length === 0 ? (
        <SinCompletar />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {datosSincronizados.map((c) => (
            <CampoFichaTecnica key={c.etiqueta} etiqueta={c.etiqueta} valor={c.valor} advertencia={c.advertencia} />
          ))}
        </div>
      )}
    </div>
  );

  if (!puedeEditar) {
    const conValor = [
      { etiqueta: 'Ciudad donde reside', valor: ficha.matrizCiudadResidencia },
      { etiqueta: 'Estado de la reunión', valor: ficha.matrizEstadoReunion },
      { etiqueta: 'Propietario', valor: ficha.matrizPropietario },
      { etiqueta: 'Contrato firmado y enviado', valor: ficha.matrizContratoFirmado ? 'Sí' : 'No' },
      { etiqueta: 'Bienvenida generada', valor: ficha.matrizBienvenidaGenerada ? 'Sí' : 'No' },
      { etiqueta: 'Documento resumen', valor: ficha.matrizLinkResumen },
      { etiqueta: 'Diagnóstico generado', valor: ficha.matrizDiagnosticoGenerado ? 'Sí' : 'No' },
      { etiqueta: 'Documento diagnóstico', valor: ficha.matrizLinkDiagnostico },
      { etiqueta: 'Ingreso generado', valor: ficha.matrizIngresoGenerado ? 'Sí' : 'No' },
      { etiqueta: 'Fecha reunión creativa', valor: formatearFechaONull(ficha.matrizFechaReunionCreativa) },
      {
        etiqueta: 'Venta cruzada',
        valor: ficha.matrizVentaCruzada && ficha.matrizVentaCruzada.length > 0 ? ficha.matrizVentaCruzada.join(', ') : null,
      },
      { etiqueta: 'Observaciones comerciales', valor: ficha.matrizObservacionesComerciales },
    ].filter((c): c is { etiqueta: string; valor: string } => c.valor !== null && c.valor !== '');

    return (
      <div className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-medium text-tinta">Matriz de Ingreso (RRPP)</h3>
        {bloqueSincronizado}
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
      <h3 className="mb-6 font-medium text-tinta">Matriz de Ingreso (RRPP)</h3>

      {bloqueSincronizado}

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Seguimiento del Autor
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-4">
            <label htmlFor="matriz-ingreso-ciudad-residencia" className={LABEL_CLASS}>
              Ciudad donde reside
            </label>
            <input
              id="matriz-ingreso-ciudad-residencia"
              type="text"
              value={ciudadResidencia}
              onChange={(event) => {
                setCiudadResidencia(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="matriz-ingreso-estado-reunion" className={LABEL_CLASS}>
              Estado
            </label>
            <select
              id="matriz-ingreso-estado-reunion"
              value={estadoReunion}
              onChange={(event) => {
                setEstadoReunion(event.target.value as EstadoReunion);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {ESTADOS_REUNION.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <label htmlFor="matriz-ingreso-propietario" className={LABEL_CLASS}>
              Propietario
            </label>
            <select
              id="matriz-ingreso-propietario"
              value={propietario}
              onChange={(event) => {
                setPropietario(event.target.value as PropietarioMatrizIngreso);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {PROPIETARIOS_MATRIZ_INGRESO.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <label htmlFor="matriz-ingreso-fecha-reunion-creativa" className={LABEL_CLASS}>
              Fecha reunión creativa
            </label>
            <input
              id="matriz-ingreso-fecha-reunion-creativa"
              type="date"
              value={fechaReunionCreativa}
              onChange={(event) => {
                setFechaReunionCreativa(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Documentos Generados
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-12 flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <input
                id="matriz-ingreso-contrato-firmado"
                type="checkbox"
                checked={contratoFirmado}
                onChange={(event) => {
                  setContratoFirmado(event.target.checked);
                  mutacion.reset();
                }}
                className={CHECKBOX_CLASS}
              />
              <label htmlFor="matriz-ingreso-contrato-firmado" className="text-sm font-medium text-tinta">
                Contrato firmado y enviado
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="matriz-ingreso-bienvenida-generada"
                type="checkbox"
                checked={bienvenidaGenerada}
                onChange={(event) => {
                  setBienvenidaGenerada(event.target.checked);
                  mutacion.reset();
                }}
                className={CHECKBOX_CLASS}
              />
              <label htmlFor="matriz-ingreso-bienvenida-generada" className="text-sm font-medium text-tinta">
                Bienvenida generada
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="matriz-ingreso-diagnostico-generado"
                type="checkbox"
                checked={diagnosticoGenerado}
                onChange={(event) => {
                  setDiagnosticoGenerado(event.target.checked);
                  mutacion.reset();
                }}
                className={CHECKBOX_CLASS}
              />
              <label htmlFor="matriz-ingreso-diagnostico-generado" className="text-sm font-medium text-tinta">
                Diagnóstico generado
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="matriz-ingreso-ingreso-generado"
                type="checkbox"
                checked={ingresoGenerado}
                onChange={(event) => {
                  setIngresoGenerado(event.target.checked);
                  mutacion.reset();
                }}
                className={CHECKBOX_CLASS}
              />
              <label htmlFor="matriz-ingreso-ingreso-generado" className="text-sm font-medium text-tinta">
                Ingreso generado
              </label>
            </div>
          </div>
          <div className="md:col-span-6">
            <label htmlFor="matriz-ingreso-link-resumen" className={LABEL_CLASS}>
              Documento resumen
            </label>
            <input
              id="matriz-ingreso-link-resumen"
              type="text"
              placeholder="Pegar enlace de Google Drive aquí…"
              value={linkResumen}
              onChange={(event) => {
                setLinkResumen(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-6">
            <label htmlFor="matriz-ingreso-link-diagnostico" className={LABEL_CLASS}>
              Documento diagnóstico
            </label>
            <input
              id="matriz-ingreso-link-diagnostico"
              type="text"
              placeholder="Pegar enlace de Google Drive aquí…"
              value={linkDiagnostico}
              onChange={(event) => {
                setLinkDiagnostico(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Comercial
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-12">
            <label htmlFor="matriz-ingreso-venta-cruzada-entrada" className={LABEL_CLASS}>
              Venta cruzada
            </label>
            <EtiquetasVentaCruzada
              value={ventaCruzada}
              onChange={(etiquetas) => {
                setVentaCruzada(etiquetas);
                mutacion.reset();
              }}
            />
          </div>
          <div className="md:col-span-12">
            <label htmlFor="matriz-ingreso-observaciones-comerciales" className={LABEL_CLASS}>
              Observaciones comerciales
            </label>
            <textarea
              id="matriz-ingreso-observaciones-comerciales"
              rows={3}
              value={observacionesComerciales}
              onChange={(event) => {
                setObservacionesComerciales(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
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
