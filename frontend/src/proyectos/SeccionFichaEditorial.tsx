import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { CampoFichaTecnica, conValorLegacyIncluido, formatearFechaONull, SinCompletar } from './campos';
import type { ColeccionPanhouse, FichaCompleta, PublicoSexo } from '../types/api';
import { actualizarSeccionFichaEditorial } from './proyectoDetalleApi';
import { EtiquetasObjetivoComercial } from './EtiquetasObjetivoComercial';

const INPUT_CLASS =
  'w-full bg-white border border-gray-200 text-gray-900 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-tinta/20 focus:border-tinta transition-all placeholder:text-gray-400';
const LABEL_CLASS = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';
const AYUDA_CLASS = 'mt-1 text-xs text-gray-500';
const BLOQUE_CLASS = 'mb-8 pb-6 border-b border-gray-100 last:border-0';
const BLOQUE_TITULO_CLASS = 'text-base font-bold text-gray-900 mb-5 flex items-center gap-2';
const GRID_CLASS = 'grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-5';

const COLECCIONES_PANHOUSE: ColeccionPanhouse[] = [
  'Crecimiento Espiritual',
  'Emprendimiento y Crecimiento Personal',
  'Literatura',
  'Salud y Bienestar',
  'Sin asignar',
  'Liderazgo',
  'Ciencias sociales',
  'PanHouse Kids',
];

const PUBLICOS_SEXO: PublicoSexo[] = ['Masculino', 'Femenino', 'Mixto'];

// Rangos estándar, no un catálogo cerrado confirmado — mismo criterio
// que capitulosPactados/paginasPactadas en SeccionProyectoPerfil.tsx:
// texto libre en la base, <select> de sugerencias en el frontend.
const OPCIONES_EDAD = ['18-25', '26-35', '36-45', '46-55', '56-65', '65+'] as const;
const OPCIONES_TONO = ['Académico', 'Inspiracional', 'Narrativo', 'Técnico', 'Conversacional', 'Motivacional'] as const;

// "Ficha Editorial (Completado por RRPP)" — a pedido explícito del
// negocio, revive campos que existían en una ronda anterior de "Datos de
// Ingreso" (ver el comentario completo en server/db/schema/trazabilidad.ts)
// pero ahora bajo un dueño distinto: rrpp/jefe_area, no comercial —
// comercial ve esta sección en modo lectura, la misma "Ficha Técnica"
// (CampoFichaTecnica, ver campos.tsx) que el resto de la app usa para
// bloques que un rol no puede editar.
export function SeccionFichaEditorial({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [fechaDeseadaCulminacion, setFechaDeseadaCulminacion] = useState(ficha.fechaDeseadaCulminacion ?? '');
  const [temaGeneral, setTemaGeneral] = useState(ficha.temaGeneral ?? '');
  const [posibleTituloLibro, setPosibleTituloLibro] = useState(ficha.posibleTituloLibro ?? '');
  const [coleccionPanhouse, setColeccionPanhouse] = useState<ColeccionPanhouse | ''>(ficha.coleccionPanhouse ?? '');
  const [tonoEstilo, setTonoEstilo] = useState(ficha.tonoEstilo ?? '');
  const [publicoSexo, setPublicoSexo] = useState<PublicoSexo | ''>(ficha.publicoSexo ?? '');
  const [publicoEdad, setPublicoEdad] = useState(ficha.publicoEdad ?? '');
  const [publicoPerfil, setPublicoPerfil] = useState(ficha.publicoPerfil ?? '');
  const [propositoSocial, setPropositoSocial] = useState(ficha.propositoSocial ?? '');
  const [objetivoComercial, setObjetivoComercial] = useState<string[]>(ficha.objetivoComercial ?? []);
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionFichaEditorial(proyectoId, {
        fechaDeseadaCulminacion: fechaDeseadaCulminacion || null,
        temaGeneral: temaGeneral || null,
        posibleTituloLibro: posibleTituloLibro || null,
        coleccionPanhouse: coleccionPanhouse || null,
        tonoEstilo: tonoEstilo || null,
        publicoSexo: publicoSexo || null,
        publicoEdad: publicoEdad || null,
        publicoPerfil: publicoPerfil || null,
        propositoSocial: propositoSocial || null,
        objetivoComercial: objetivoComercial.length > 0 ? objetivoComercial : null,
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
      { etiqueta: 'Fecha deseada de culminación', valor: formatearFechaONull(ficha.fechaDeseadaCulminacion) },
      { etiqueta: 'Tema general', valor: ficha.temaGeneral },
      { etiqueta: 'Posible título del libro', valor: ficha.posibleTituloLibro },
      { etiqueta: 'Colección PanHouse', valor: ficha.coleccionPanhouse },
      { etiqueta: 'Tono y estilo', valor: ficha.tonoEstilo },
      { etiqueta: 'Público objetivo — Sexo', valor: ficha.publicoSexo },
      { etiqueta: 'Público objetivo — Rango de edad', valor: ficha.publicoEdad },
      { etiqueta: 'Público objetivo — Perfil/Ocupación', valor: ficha.publicoPerfil },
      { etiqueta: 'Propósito social', valor: ficha.propositoSocial },
      {
        etiqueta: 'Objetivo comercial',
        valor: ficha.objetivoComercial && ficha.objetivoComercial.length > 0 ? ficha.objetivoComercial.join(', ') : null,
      },
    ].filter((c): c is { etiqueta: string; valor: string } => c.valor !== null && c.valor !== '');

    return (
      <div className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-medium text-tinta">Ficha Editorial (Completado por RRPP)</h3>
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
      <h3 className="mb-6 font-medium text-tinta">Ficha Editorial (Completado por RRPP)</h3>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Detalles del Libro
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-4">
            <label htmlFor="ficha-editorial-fecha-culminacion" className={LABEL_CLASS}>
              Fecha deseada de culminación
            </label>
            <input
              id="ficha-editorial-fecha-culminacion"
              type="date"
              value={fechaDeseadaCulminacion}
              onChange={(event) => {
                setFechaDeseadaCulminacion(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
            <p className={AYUDA_CLASS}>Indicar fecha propuesta por el autor o equipo para finalizar el proyecto.</p>
          </div>
          <div className="md:col-span-4">
            <label htmlFor="ficha-editorial-tema-general" className={LABEL_CLASS}>
              Tema general
            </label>
            <input
              id="ficha-editorial-tema-general"
              type="text"
              value={temaGeneral}
              onChange={(event) => {
                setTemaGeneral(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
            <p className={AYUDA_CLASS}>Escribe el tema principal en el que se centra el libro según lo indicado por el autor.</p>
          </div>
          <div className="md:col-span-4">
            <label htmlFor="ficha-editorial-posible-titulo" className={LABEL_CLASS}>
              Posible título del libro
            </label>
            <input
              id="ficha-editorial-posible-titulo"
              type="text"
              value={posibleTituloLibro}
              onChange={(event) => {
                setPosibleTituloLibro(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
            <p className={AYUDA_CLASS}>Escribe el titulo que te indique el autor.</p>
          </div>
          <div className="md:col-span-6">
            <label htmlFor="ficha-editorial-coleccion" className={LABEL_CLASS}>
              Colección PanHouse
            </label>
            <select
              id="ficha-editorial-coleccion"
              value={coleccionPanhouse}
              onChange={(event) => {
                setColeccionPanhouse(event.target.value as ColeccionPanhouse);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {COLECCIONES_PANHOUSE.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-6">
            <label htmlFor="ficha-editorial-tono-estilo" className={LABEL_CLASS}>
              Tono y estilo
            </label>
            <select
              id="ficha-editorial-tono-estilo"
              value={tonoEstilo}
              onChange={(event) => {
                setTonoEstilo(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {conValorLegacyIncluido(OPCIONES_TONO, tonoEstilo).map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Público Objetivo
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-3">
            <label htmlFor="ficha-editorial-publico-sexo" className={LABEL_CLASS}>
              Sexo
            </label>
            <select
              id="ficha-editorial-publico-sexo"
              value={publicoSexo}
              onChange={(event) => {
                setPublicoSexo(event.target.value as PublicoSexo);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {PUBLICOS_SEXO.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label htmlFor="ficha-editorial-publico-edad" className={LABEL_CLASS}>
              Rango de edad
            </label>
            <select
              id="ficha-editorial-publico-edad"
              value={publicoEdad}
              onChange={(event) => {
                setPublicoEdad(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {conValorLegacyIncluido(OPCIONES_EDAD, publicoEdad).map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-6">
            <label htmlFor="ficha-editorial-publico-perfil" className={LABEL_CLASS}>
              Perfil / ocupación
            </label>
            <textarea
              id="ficha-editorial-publico-perfil"
              rows={2}
              value={publicoPerfil}
              onChange={(event) => {
                setPublicoPerfil(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
            <p className={AYUDA_CLASS}>Describe el tipo de lector esperado según su perfil profesional, educativo o intereses.</p>
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Propósito y Objetivos
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-6">
            <label htmlFor="ficha-editorial-proposito-social" className={LABEL_CLASS}>
              Propósito social
            </label>
            <textarea
              id="ficha-editorial-proposito-social"
              rows={2}
              value={propositoSocial}
              onChange={(event) => {
                setPropositoSocial(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
            <p className={AYUDA_CLASS}>Explica de forma breve si el proyecto busca tener algún impacto o beneficio social.</p>
          </div>
          <div className="md:col-span-6">
            <label htmlFor="ficha-editorial-objetivo-comercial-entrada" className={LABEL_CLASS}>
              Objetivo comercial
            </label>
            <EtiquetasObjetivoComercial
              value={objetivoComercial}
              onChange={(etiquetas) => {
                setObjetivoComercial(etiquetas);
                mutacion.reset();
              }}
            />
            <p className={AYUDA_CLASS}>Selecciona las opciones que apliquen a fines comerciales del autor.</p>
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
