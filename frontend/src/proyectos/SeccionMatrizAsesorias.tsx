import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type {
  AsesoriaEstado,
  AsesoriaFase,
  AsesoriaFeriaAParticipar,
  AsesoriaFeriaProyectada,
  AsesoriaFuturoAutor,
  AsesoriaNivelSatisfaccion,
  AsesoriaResponsableDistribucion,
  AsesoriaResponsableImpresion,
  FichaCompleta,
} from '../types/api';
import { CampoFichaTecnica, conValorLegacyIncluido, formatearFechaONull, SinCompletar } from './campos';
import { PAISES } from './paises';
import { actualizarSeccionMatrizAsesorias } from './proyectoDetalleApi';

const INPUT_CLASS =
  'w-full bg-white border border-gray-200 text-gray-900 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-tinta/20 focus:border-tinta transition-all placeholder:text-gray-400';
const LABEL_CLASS = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';
const BLOQUE_CLASS = 'mb-8 pb-6 border-b border-gray-100 last:border-0';
const BLOQUE_TITULO_CLASS = 'text-base font-bold text-gray-900 mb-5 flex items-center gap-2';
const GRID_CLASS = 'grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-5';
const CHECKBOX_CLASS = 'h-4 w-4 rounded border-tinta/20 text-dorado focus:outline-none focus:ring-1 focus:ring-dorado';
const CHECKBOX_ROW_CLASS = 'flex items-center gap-2';

const ASESORIA_ESTADOS: AsesoriaEstado[] = ['Completado', 'Con fecha de lanzamiento', 'En proceso editorial', 'Finalizado'];
const ASESORIA_NIVELES_SATISFACCION: AsesoriaNivelSatisfaccion[] = ['Bueno', 'Excelente', 'Regular'];
const ASESORIA_FASES: AsesoriaFase[] = ['En asesoramiento', 'Esperando fecha', 'En espera de lanzamiento', 'Culminado'];
const ASESORIA_FERIAS_PROYECTADAS: AsesoriaFeriaProyectada[] = ['Bogotá', 'Colombia', 'Guadalajara', 'Panamá'];
const ASESORIA_FUTURO_AUTOR: AsesoriaFuturoAutor[] = ['Desea ser publicado', 'No desea ser publicado aún', 'Publicado'];
const ASESORIA_FERIAS_A_PARTICIPAR: AsesoriaFeriaAParticipar[] = ['Bogotá', 'Guadalajara', 'Panamá', 'Ambas'];
const ASESORIA_RESPONSABLES_IMPRESION: AsesoriaResponsableImpresion[] = [
  'Barbara Carballo',
  'Impresiones PanHouse - Casa Editorial PanHouse',
  'Paola Morales',
  'Miranda Cedillo',
];
const ASESORIA_RESPONSABLES_DISTRIBUCION: AsesoriaResponsableDistribucion[] = ['Paola Morales', 'Distribución PanHouse'];

// Único nombre real confirmado por el negocio ("select ('Manuela
// Traettino')") — sin una nómina cerrada completa, no se inventan más
// nombres acá. Mismo patrón que asesoriaEspecialistaResponsable en
// schema/trazabilidad.ts: <select> de sugerencias sobre un campo de
// texto libre, con conValorLegacyIncluido como red de seguridad.
const OPCIONES_ESPECIALISTA = ['Manuela Traettino'] as const;

// "Matriz de Asesorías con fechas" — módulo de RRPP, se renderiza en
// FichaTrazabilidadPage.tsx justo debajo de SeccionMatrizIngreso. Dueño
// exclusivo rrpp: esa página deja entrar a jefe_area para ver (mismo
// alcance que el GET del backend), pero puedeEditar ahí ya resuelve
// false para jefatura — el modo lectura de esta sección sí se usa.
export function SeccionMatrizAsesorias({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [estado, setEstado] = useState<AsesoriaEstado | ''>(ficha.asesoriaEstado ?? '');
  const [especialistaResponsable, setEspecialistaResponsable] = useState(ficha.asesoriaEspecialistaResponsable ?? '');
  const [fase, setFase] = useState<AsesoriaFase | ''>(ficha.asesoriaFase ?? '');
  const [nivelSatisfaccion, setNivelSatisfaccion] = useState<AsesoriaNivelSatisfaccion | ''>(ficha.asesoriaNivelSatisfaccion ?? '');
  const [isbnPais, setIsbnPais] = useState(ficha.asesoriaIsbnPais ?? '');

  const [fechaPrimeraReunion, setFechaPrimeraReunion] = useState(ficha.asesoriaFechaPrimeraReunion ?? '');
  const [fechaSegundaReunion, setFechaSegundaReunion] = useState(ficha.asesoriaFechaSegundaReunion ?? '');
  const [fechaAdicional, setFechaAdicional] = useState(ficha.asesoriaFechaAdicional ?? '');
  const [fechaSugeridaGe, setFechaSugeridaGe] = useState(ficha.asesoriaFechaSugeridaGe ?? '');
  const [fechaPautadaAutor, setFechaPautadaAutor] = useState(ficha.asesoriaFechaPautadaAutor ?? '');

  const [linkMinutaGerencia, setLinkMinutaGerencia] = useState(ficha.asesoriaLinkMinutaGerencia ?? '');
  const [rutaPromocionEnviada, setRutaPromocionEnviada] = useState(ficha.asesoriaRutaPromocionEnviada);
  const [linkRutaPromocion, setLinkRutaPromocion] = useState(ficha.asesoriaLinkRutaPromocion ?? '');
  const [futuroAutor, setFuturoAutor] = useState<AsesoriaFuturoAutor | ''>(ficha.asesoriaFuturoAutor ?? '');
  const [notas, setNotas] = useState(ficha.asesoriaNotas ?? '');

  const [feriaProyectada, setFeriaProyectada] = useState<AsesoriaFeriaProyectada | ''>(ficha.asesoriaFeriaProyectada ?? '');
  const [infoFeriaEnviada, setInfoFeriaEnviada] = useState(ficha.asesoriaInfoFeriaEnviada);
  const [participacionFeria, setParticipacionFeria] = useState(ficha.asesoriaParticipacionFeria);
  const [feriaAParticipar, setFeriaAParticipar] = useState<AsesoriaFeriaAParticipar | ''>(ficha.asesoriaFeriaAParticipar ?? '');

  const [cotizacionImpresion, setCotizacionImpresion] = useState(ficha.asesoriaCotizacionImpresion);
  const [responsableImpresion, setResponsableImpresion] = useState<AsesoriaResponsableImpresion | ''>(
    ficha.asesoriaResponsableImpresion ?? '',
  );
  const [fechaCotizacionSolicitada, setFechaCotizacionSolicitada] = useState(ficha.asesoriaFechaCotizacionSolicitada ?? '');
  const [fechaCotizacionEnviada, setFechaCotizacionEnviada] = useState(ficha.asesoriaFechaCotizacionEnviada ?? '');
  const [cotizacionAceptada, setCotizacionAceptada] = useState(ficha.asesoriaCotizacionAceptada);
  const [distribucionAceptada, setDistribucionAceptada] = useState(ficha.asesoriaDistribucionAceptada);
  const [responsableDistribucion, setResponsableDistribucion] = useState<AsesoriaResponsableDistribucion | ''>(
    ficha.asesoriaResponsableDistribucion ?? '',
  );
  const [notaDistribucion, setNotaDistribucion] = useState(ficha.asesoriaNotaDistribucion ?? '');
  const [fechaContratoEnviado, setFechaContratoEnviado] = useState(ficha.asesoriaFechaContratoEnviado ?? '');
  const [contratoRecibidoFirmado, setContratoRecibidoFirmado] = useState(ficha.asesoriaContratoRecibidoFirmado);

  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionMatrizAsesorias(proyectoId, {
        asesoriaEstado: estado || null,
        asesoriaEspecialistaResponsable: especialistaResponsable || null,
        asesoriaFase: fase || null,
        asesoriaNivelSatisfaccion: nivelSatisfaccion || null,
        asesoriaIsbnPais: isbnPais || null,
        asesoriaFechaPrimeraReunion: fechaPrimeraReunion || null,
        asesoriaFechaSegundaReunion: fechaSegundaReunion || null,
        asesoriaFechaAdicional: fechaAdicional || null,
        asesoriaFechaSugeridaGe: fechaSugeridaGe || null,
        asesoriaFechaPautadaAutor: fechaPautadaAutor || null,
        asesoriaLinkMinutaGerencia: linkMinutaGerencia || null,
        asesoriaRutaPromocionEnviada: rutaPromocionEnviada,
        asesoriaLinkRutaPromocion: linkRutaPromocion || null,
        asesoriaFuturoAutor: futuroAutor || null,
        asesoriaNotas: notas || null,
        asesoriaFeriaProyectada: feriaProyectada || null,
        asesoriaInfoFeriaEnviada: infoFeriaEnviada,
        asesoriaParticipacionFeria: participacionFeria,
        asesoriaFeriaAParticipar: feriaAParticipar || null,
        asesoriaCotizacionImpresion: cotizacionImpresion,
        asesoriaResponsableImpresion: responsableImpresion || null,
        asesoriaFechaCotizacionSolicitada: fechaCotizacionSolicitada || null,
        asesoriaFechaCotizacionEnviada: fechaCotizacionEnviada || null,
        asesoriaCotizacionAceptada: cotizacionAceptada,
        asesoriaDistribucionAceptada: distribucionAceptada,
        asesoriaResponsableDistribucion: responsableDistribucion || null,
        asesoriaNotaDistribucion: notaDistribucion || null,
        asesoriaFechaContratoEnviado: fechaContratoEnviado || null,
        asesoriaContratoRecibidoFirmado: contratoRecibidoFirmado,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  const libro = (
    <div className="mb-6">
      <CampoFichaTecnica etiqueta="Libro" valor={ficha.posibleTituloLibro ?? 'Sin definir'} />
    </div>
  );

  if (!puedeEditar) {
    const conValor = [
      { etiqueta: 'Estado', valor: ficha.asesoriaEstado },
      { etiqueta: 'Especialista responsable', valor: ficha.asesoriaEspecialistaResponsable },
      { etiqueta: 'Fase', valor: ficha.asesoriaFase },
      { etiqueta: 'Nivel de satisfacción', valor: ficha.asesoriaNivelSatisfaccion },
      { etiqueta: 'ISBN (país)', valor: ficha.asesoriaIsbnPais },
      { etiqueta: 'Fecha 1ra reunión', valor: formatearFechaONull(ficha.asesoriaFechaPrimeraReunion) },
      { etiqueta: 'Fecha 2da reunión', valor: formatearFechaONull(ficha.asesoriaFechaSegundaReunion) },
      { etiqueta: 'Asesoría adicional', valor: formatearFechaONull(ficha.asesoriaFechaAdicional) },
      { etiqueta: 'Fecha sugerida por GE', valor: formatearFechaONull(ficha.asesoriaFechaSugeridaGe) },
      { etiqueta: 'Fecha pautada por autor', valor: formatearFechaONull(ficha.asesoriaFechaPautadaAutor) },
      { etiqueta: 'Enlace a Minuta de Gerencia', valor: ficha.asesoriaLinkMinutaGerencia },
      { etiqueta: 'Ruta de promoción enviada', valor: ficha.asesoriaRutaPromocionEnviada ? 'Sí' : 'No' },
      { etiqueta: 'Enlace a Ruta de Promoción', valor: ficha.asesoriaLinkRutaPromocion },
      { etiqueta: 'Futuro del autor', valor: ficha.asesoriaFuturoAutor },
      { etiqueta: 'Notas', valor: ficha.asesoriaNotas },
      { etiqueta: 'Feria proyectada', valor: ficha.asesoriaFeriaProyectada },
      { etiqueta: 'Info de feria enviada', valor: ficha.asesoriaInfoFeriaEnviada ? 'Sí' : 'No' },
      { etiqueta: 'Participación en feria', valor: ficha.asesoriaParticipacionFeria ? 'Sí' : 'No' },
      { etiqueta: 'Feria a participar', valor: ficha.asesoriaFeriaAParticipar },
      { etiqueta: 'Cotización de impresión', valor: ficha.asesoriaCotizacionImpresion ? 'Sí' : 'No' },
      { etiqueta: 'Responsable de impresión', valor: ficha.asesoriaResponsableImpresion },
      { etiqueta: 'Fecha cotización solicitada', valor: formatearFechaONull(ficha.asesoriaFechaCotizacionSolicitada) },
      { etiqueta: 'Fecha cotización enviada', valor: formatearFechaONull(ficha.asesoriaFechaCotizacionEnviada) },
      { etiqueta: 'Cotización aceptada', valor: ficha.asesoriaCotizacionAceptada ? 'Sí' : 'No' },
      { etiqueta: 'Distribución aceptada', valor: ficha.asesoriaDistribucionAceptada ? 'Sí' : 'No' },
      { etiqueta: 'Responsable de distribución', valor: ficha.asesoriaResponsableDistribucion },
      { etiqueta: 'Nota de distribución', valor: ficha.asesoriaNotaDistribucion },
      { etiqueta: 'Fecha contrato enviado', valor: formatearFechaONull(ficha.asesoriaFechaContratoEnviado) },
      { etiqueta: 'Contrato recibido y firmado', valor: ficha.asesoriaContratoRecibidoFirmado ? 'Sí' : 'No' },
    ].filter((c): c is { etiqueta: string; valor: string } => c.valor !== null && c.valor !== '');

    return (
      <div className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-medium text-tinta">Matriz de Asesorías con fechas</h3>
        {libro}
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
      <h3 className="mb-6 font-medium text-tinta">Matriz de Asesorías con fechas</h3>

      {libro}

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Estatus y Asignación
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-4">
            <label htmlFor="asesoria-estado" className={LABEL_CLASS}>
              Estado
            </label>
            <select
              id="asesoria-estado"
              value={estado}
              onChange={(event) => {
                setEstado(event.target.value as AsesoriaEstado);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {ASESORIA_ESTADOS.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <label htmlFor="asesoria-especialista-responsable" className={LABEL_CLASS}>
              Especialista responsable
            </label>
            <select
              id="asesoria-especialista-responsable"
              value={especialistaResponsable}
              onChange={(event) => {
                setEspecialistaResponsable(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {conValorLegacyIncluido(OPCIONES_ESPECIALISTA, especialistaResponsable).map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <label htmlFor="asesoria-fase" className={LABEL_CLASS}>
              Fase
            </label>
            <select
              id="asesoria-fase"
              value={fase}
              onChange={(event) => {
                setFase(event.target.value as AsesoriaFase);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {ASESORIA_FASES.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <label htmlFor="asesoria-nivel-satisfaccion" className={LABEL_CLASS}>
              Nivel de satisfacción
            </label>
            <select
              id="asesoria-nivel-satisfaccion"
              value={nivelSatisfaccion}
              onChange={(event) => {
                setNivelSatisfaccion(event.target.value as AsesoriaNivelSatisfaccion);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {ASESORIA_NIVELES_SATISFACCION.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <label htmlFor="asesoria-isbn-pais" className={LABEL_CLASS}>
              ISBN (país)
            </label>
            <select
              id="asesoria-isbn-pais"
              value={isbnPais}
              onChange={(event) => {
                setIsbnPais(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {conValorLegacyIncluido(PAISES, isbnPais).map((pais) => (
                <option key={pais} value={pais}>
                  {pais}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Cronograma de Reuniones y Lanzamiento
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-4">
            <label htmlFor="asesoria-fecha-primera-reunion" className={LABEL_CLASS}>
              Fecha 1ra reunión
            </label>
            <input
              id="asesoria-fecha-primera-reunion"
              type="date"
              value={fechaPrimeraReunion}
              onChange={(event) => {
                setFechaPrimeraReunion(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="asesoria-fecha-segunda-reunion" className={LABEL_CLASS}>
              Fecha 2da reunión
            </label>
            <input
              id="asesoria-fecha-segunda-reunion"
              type="date"
              value={fechaSegundaReunion}
              onChange={(event) => {
                setFechaSegundaReunion(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="asesoria-fecha-adicional" className={LABEL_CLASS}>
              Asesoría adicional
            </label>
            <input
              id="asesoria-fecha-adicional"
              type="date"
              value={fechaAdicional}
              onChange={(event) => {
                setFechaAdicional(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-6">
            <label htmlFor="asesoria-fecha-sugerida-ge" className={LABEL_CLASS}>
              Fecha sugerida por GE
            </label>
            <input
              id="asesoria-fecha-sugerida-ge"
              type="date"
              value={fechaSugeridaGe}
              onChange={(event) => {
                setFechaSugeridaGe(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-6">
            <label htmlFor="asesoria-fecha-pautada-autor" className={LABEL_CLASS}>
              Fecha pautada por autor
            </label>
            <input
              id="asesoria-fecha-pautada-autor"
              type="date"
              value={fechaPautadaAutor}
              onChange={(event) => {
                setFechaPautadaAutor(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Documentación y Promoción
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-6">
            <label htmlFor="asesoria-link-minuta-gerencia" className={LABEL_CLASS}>
              Enlace a Ficha/Minuta
            </label>
            <input
              id="asesoria-link-minuta-gerencia"
              type="url"
              placeholder="Pegar enlace de Google Drive aquí…"
              value={linkMinutaGerencia}
              onChange={(event) => {
                setLinkMinutaGerencia(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-6">
            <label htmlFor="asesoria-link-ruta-promocion" className={LABEL_CLASS}>
              Enlace a Ruta de Promoción
            </label>
            <input
              id="asesoria-link-ruta-promocion"
              type="url"
              placeholder="Pegar enlace de Google Drive aquí…"
              value={linkRutaPromocion}
              onChange={(event) => {
                setLinkRutaPromocion(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-4">
            <div className={CHECKBOX_ROW_CLASS}>
              <input
                id="asesoria-ruta-promocion-enviada"
                type="checkbox"
                checked={rutaPromocionEnviada}
                onChange={(event) => {
                  setRutaPromocionEnviada(event.target.checked);
                  mutacion.reset();
                }}
                className={CHECKBOX_CLASS}
              />
              <label htmlFor="asesoria-ruta-promocion-enviada" className="text-sm font-medium text-tinta">
                Ruta de promoción enviada
              </label>
            </div>
          </div>
          <div className="md:col-span-8">
            <label htmlFor="asesoria-futuro-autor" className={LABEL_CLASS}>
              Futuro del autor
            </label>
            <select
              id="asesoria-futuro-autor"
              value={futuroAutor}
              onChange={(event) => {
                setFuturoAutor(event.target.value as AsesoriaFuturoAutor);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {ASESORIA_FUTURO_AUTOR.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-12">
            <label htmlFor="asesoria-notas" className={LABEL_CLASS}>
              Notas
            </label>
            <textarea
              id="asesoria-notas"
              rows={3}
              value={notas}
              onChange={(event) => {
                setNotas(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Ferias y Eventos
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-6">
            <label htmlFor="asesoria-feria-proyectada" className={LABEL_CLASS}>
              Feria proyectada
            </label>
            <select
              id="asesoria-feria-proyectada"
              value={feriaProyectada}
              onChange={(event) => {
                setFeriaProyectada(event.target.value as AsesoriaFeriaProyectada);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {ASESORIA_FERIAS_PROYECTADAS.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-6">
            <label htmlFor="asesoria-feria-a-participar" className={LABEL_CLASS}>
              Feria a participar
            </label>
            <select
              id="asesoria-feria-a-participar"
              value={feriaAParticipar}
              onChange={(event) => {
                setFeriaAParticipar(event.target.value as AsesoriaFeriaAParticipar);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {ASESORIA_FERIAS_A_PARTICIPAR.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-6">
            <div className={CHECKBOX_ROW_CLASS}>
              <input
                id="asesoria-info-feria-enviada"
                type="checkbox"
                checked={infoFeriaEnviada}
                onChange={(event) => {
                  setInfoFeriaEnviada(event.target.checked);
                  mutacion.reset();
                }}
                className={CHECKBOX_CLASS}
              />
              <label htmlFor="asesoria-info-feria-enviada" className="text-sm font-medium text-tinta">
                Info de feria enviada
              </label>
            </div>
          </div>
          <div className="md:col-span-6">
            <div className={CHECKBOX_ROW_CLASS}>
              <input
                id="asesoria-participacion-feria"
                type="checkbox"
                checked={participacionFeria}
                onChange={(event) => {
                  setParticipacionFeria(event.target.checked);
                  mutacion.reset();
                }}
                className={CHECKBOX_CLASS}
              />
              <label htmlFor="asesoria-participacion-feria" className="text-sm font-medium text-tinta">
                Participación en feria
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Impresión y Distribución
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-6">
            <div className={CHECKBOX_ROW_CLASS}>
              <input
                id="asesoria-cotizacion-impresion"
                type="checkbox"
                checked={cotizacionImpresion}
                onChange={(event) => {
                  setCotizacionImpresion(event.target.checked);
                  mutacion.reset();
                }}
                className={CHECKBOX_CLASS}
              />
              <label htmlFor="asesoria-cotizacion-impresion" className="text-sm font-medium text-tinta">
                Cotización de impresión
              </label>
            </div>
          </div>
          <div className="md:col-span-6">
            <div className={CHECKBOX_ROW_CLASS}>
              <input
                id="asesoria-cotizacion-aceptada"
                type="checkbox"
                checked={cotizacionAceptada}
                onChange={(event) => {
                  setCotizacionAceptada(event.target.checked);
                  mutacion.reset();
                }}
                className={CHECKBOX_CLASS}
              />
              <label htmlFor="asesoria-cotizacion-aceptada" className="text-sm font-medium text-tinta">
                Cotización aceptada
              </label>
            </div>
          </div>
          <div className="md:col-span-6">
            <label htmlFor="asesoria-responsable-impresion" className={LABEL_CLASS}>
              Responsable de impresión
            </label>
            <select
              id="asesoria-responsable-impresion"
              value={responsableImpresion}
              onChange={(event) => {
                setResponsableImpresion(event.target.value as AsesoriaResponsableImpresion);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {ASESORIA_RESPONSABLES_IMPRESION.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label htmlFor="asesoria-fecha-cotizacion-solicitada" className={LABEL_CLASS}>
              Fecha solicitada
            </label>
            <input
              id="asesoria-fecha-cotizacion-solicitada"
              type="date"
              value={fechaCotizacionSolicitada}
              onChange={(event) => {
                setFechaCotizacionSolicitada(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="asesoria-fecha-cotizacion-enviada" className={LABEL_CLASS}>
              Fecha enviada
            </label>
            <input
              id="asesoria-fecha-cotizacion-enviada"
              type="date"
              value={fechaCotizacionEnviada}
              onChange={(event) => {
                setFechaCotizacionEnviada(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>

          <div className="md:col-span-6">
            <div className={CHECKBOX_ROW_CLASS}>
              <input
                id="asesoria-distribucion-aceptada"
                type="checkbox"
                checked={distribucionAceptada}
                onChange={(event) => {
                  setDistribucionAceptada(event.target.checked);
                  mutacion.reset();
                }}
                className={CHECKBOX_CLASS}
              />
              <label htmlFor="asesoria-distribucion-aceptada" className="text-sm font-medium text-tinta">
                Distribución aceptada
              </label>
            </div>
          </div>
          <div className="md:col-span-6">
            <div className={CHECKBOX_ROW_CLASS}>
              <input
                id="asesoria-contrato-recibido-firmado"
                type="checkbox"
                checked={contratoRecibidoFirmado}
                onChange={(event) => {
                  setContratoRecibidoFirmado(event.target.checked);
                  mutacion.reset();
                }}
                className={CHECKBOX_CLASS}
              />
              <label htmlFor="asesoria-contrato-recibido-firmado" className="text-sm font-medium text-tinta">
                Contrato recibido y firmado
              </label>
            </div>
          </div>
          <div className="md:col-span-6">
            <label htmlFor="asesoria-responsable-distribucion" className={LABEL_CLASS}>
              Responsable de distribución
            </label>
            <select
              id="asesoria-responsable-distribucion"
              value={responsableDistribucion}
              onChange={(event) => {
                setResponsableDistribucion(event.target.value as AsesoriaResponsableDistribucion);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {ASESORIA_RESPONSABLES_DISTRIBUCION.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-6">
            <label htmlFor="asesoria-fecha-contrato-enviado" className={LABEL_CLASS}>
              Fecha contrato enviado
            </label>
            <input
              id="asesoria-fecha-contrato-enviado"
              type="date"
              value={fechaContratoEnviado}
              onChange={(event) => {
                setFechaContratoEnviado(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-12">
            <label htmlFor="asesoria-nota-distribucion" className={LABEL_CLASS}>
              Nota de distribución
            </label>
            <textarea
              id="asesoria-nota-distribucion"
              rows={2}
              value={notaDistribucion}
              onChange={(event) => {
                setNotaDistribucion(event.target.value);
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
