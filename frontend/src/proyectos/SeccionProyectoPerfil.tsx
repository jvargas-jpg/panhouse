import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { formatearFechaONull } from './campos';
import type { FichaCompleta } from '../types/api';
import { actualizarSeccionProyectoPerfil, actualizarTituloProyecto } from './proyectoDetalleApi';

function SinCompletar() {
  return <p className="text-sm italic text-tinta/50">Sin completar</p>;
}

const INPUT_CLASS =
  'w-full bg-white border border-gray-200 text-gray-900 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-tinta/20 focus:border-tinta transition-all placeholder:text-gray-400';
const LABEL_CLASS = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';
const BLOQUE_CLASS = 'mb-8 pb-6 border-b border-gray-100 last:border-0';
const BLOQUE_TITULO_CLASS = 'text-base font-bold text-gray-900 mb-5 flex items-center gap-2';
const GRID_CLASS = 'grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-5';

// Mitad de la sección 1 que llena rrpp en el onboarding con el autor.
// La otra mitad (capítulos/páginas pactados) la llena comercial en
// SeccionProyectoContrato — separadas porque las llena gente distinta,
// en momentos distintos. titulo es un caso aparte dentro de esta misma
// mitad: mismo dueño (rrpp) y misma sección visualmente, pero vive en
// proyectos, no en la ficha — por eso tiene su propia mutación y ruta
// (PATCH /proyectos/:id/titulo), separada de perfilAutor/publicoObjetivo/
// objetivosComerciales.
//
// Los campos "ingreso*" son la matriz real de Datos de Ingreso provista
// por el orquestador: se agregan sin tocar perfilAutor/publicoObjetivo/
// objetivosComerciales, que ya eran una función y ruta establecidas.
export function SeccionProyectoPerfil({
  proyectoId,
  ficha,
  titulo,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  titulo: string | null;
  puedeEditar: boolean;
}) {
  const [tituloForm, setTituloForm] = useState(titulo ?? '');
  const [perfilAutor, setPerfilAutor] = useState(ficha.perfilAutor ?? '');
  const [publicoObjetivo, setPublicoObjetivo] = useState(ficha.publicoObjetivo ?? '');
  const [objetivosComerciales, setObjetivosComerciales] = useState(ficha.objetivosComerciales ?? '');

  const [ingresoNombreArtistico, setIngresoNombreArtistico] = useState(ficha.ingresoNombreArtistico ?? '');
  const [ingresoNacionalidad, setIngresoNacionalidad] = useState(ficha.ingresoNacionalidad ?? '');
  const [ingresoFechaNacimiento, setIngresoFechaNacimiento] = useState(ficha.ingresoFechaNacimiento ?? '');
  const [ingresoRedesSociales, setIngresoRedesSociales] = useState(ficha.ingresoRedesSociales ?? '');

  const [ingresoTipoProyecto, setIngresoTipoProyecto] = useState(ficha.ingresoTipoProyecto ?? '');
  const [ingresoTipoProyectoDetalle, setIngresoTipoProyectoDetalle] = useState(ficha.ingresoTipoProyectoDetalle ?? '');
  const [ingresoFechaIngreso, setIngresoFechaIngreso] = useState(ficha.ingresoFechaIngreso ?? '');
  const [ingresoFechaCierre, setIngresoFechaCierre] = useState(ficha.ingresoFechaCierre ?? '');
  const [ingresoFechaDeseada, setIngresoFechaDeseada] = useState(ficha.ingresoFechaDeseada ?? '');
  const [ingresoTemaGeneral, setIngresoTemaGeneral] = useState(ficha.ingresoTemaGeneral ?? '');

  const [ingresoServicioPerfil, setIngresoServicioPerfil] = useState(ficha.ingresoServicioPerfil ?? '');
  const [ingresoServicioEjecucion, setIngresoServicioEjecucion] = useState(ficha.ingresoServicioEjecucion ?? '');
  const [ingresoServicioAlianza, setIngresoServicioAlianza] = useState(ficha.ingresoServicioAlianza ?? '');
  const [ingresoServicioPresupuesto, setIngresoServicioPresupuesto] = useState(ficha.ingresoServicioPresupuesto ?? '');

  const [ingresoOcupacion, setIngresoOcupacion] = useState(ficha.ingresoOcupacion ?? '');
  const [ingresoPersonalidad, setIngresoPersonalidad] = useState(ficha.ingresoPersonalidad ?? '');
  const [ingresoObservaciones, setIngresoObservaciones] = useState(ficha.ingresoObservaciones ?? '');

  const [ingresoPosibleTitulo, setIngresoPosibleTitulo] = useState(ficha.ingresoPosibleTitulo ?? '');
  const [ingresoColeccion, setIngresoColeccion] = useState(ficha.ingresoColeccion ?? '');
  const [ingresoTonoEstilo, setIngresoTonoEstilo] = useState(ficha.ingresoTonoEstilo ?? '');

  const [ingresoPublicoSexo, setIngresoPublicoSexo] = useState(ficha.ingresoPublicoSexo ?? '');
  const [ingresoPublicoEdad, setIngresoPublicoEdad] = useState(ficha.ingresoPublicoEdad ?? '');
  const [ingresoPublicoPerfil, setIngresoPublicoPerfil] = useState(ficha.ingresoPublicoPerfil ?? '');
  const [ingresoPropositoSocial, setIngresoPropositoSocial] = useState(ficha.ingresoPropositoSocial ?? '');
  const [ingresoObjetivoComercial, setIngresoObjetivoComercial] = useState(ficha.ingresoObjetivoComercial ?? '');

  const [ingresoCriterioExtra, setIngresoCriterioExtra] = useState(ficha.ingresoCriterioExtra ?? '');
  const [ingresoCondicionesEspeciales, setIngresoCondicionesEspeciales] = useState(ficha.ingresoCondicionesEspeciales ?? '');
  const [ingresoObservacionesEquipo, setIngresoObservacionesEquipo] = useState(ficha.ingresoObservacionesEquipo ?? '');

  const [ingresoCoordinador, setIngresoCoordinador] = useState(ficha.ingresoCoordinador ?? '');
  const [ingresoJefeDepartamento, setIngresoJefeDepartamento] = useState(ficha.ingresoJefeDepartamento ?? '');
  const [ingresoEditor, setIngresoEditor] = useState(ficha.ingresoEditor ?? '');
  const [ingresoCorrector, setIngresoCorrector] = useState(ficha.ingresoCorrector ?? '');
  const [ingresoDisenador, setIngresoDisenador] = useState(ficha.ingresoDisenador ?? '');
  const [ingresoCalidad, setIngresoCalidad] = useState(ficha.ingresoCalidad ?? '');

  const queryClient = useQueryClient();

  const mutacionTitulo = useMutation({
    mutationFn: () => actualizarTituloProyecto(proyectoId, tituloForm || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
    },
  });

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionProyectoPerfil(proyectoId, {
        perfilAutor: perfilAutor || null,
        publicoObjetivo: publicoObjetivo || null,
        objetivosComerciales: objetivosComerciales || null,
        ingresoNombreArtistico: ingresoNombreArtistico || null,
        ingresoNacionalidad: ingresoNacionalidad || null,
        ingresoFechaNacimiento: ingresoFechaNacimiento || null,
        ingresoRedesSociales: ingresoRedesSociales || null,
        ingresoTipoProyecto: ingresoTipoProyecto || null,
        ingresoTipoProyectoDetalle: ingresoTipoProyectoDetalle || null,
        ingresoFechaIngreso: ingresoFechaIngreso || null,
        ingresoFechaCierre: ingresoFechaCierre || null,
        ingresoFechaDeseada: ingresoFechaDeseada || null,
        ingresoTemaGeneral: ingresoTemaGeneral || null,
        ingresoServicioPerfil: ingresoServicioPerfil || null,
        ingresoServicioEjecucion: ingresoServicioEjecucion || null,
        ingresoServicioAlianza: ingresoServicioAlianza || null,
        ingresoServicioPresupuesto: ingresoServicioPresupuesto || null,
        ingresoOcupacion: ingresoOcupacion || null,
        ingresoPersonalidad: ingresoPersonalidad || null,
        ingresoObservaciones: ingresoObservaciones || null,
        ingresoPosibleTitulo: ingresoPosibleTitulo || null,
        ingresoColeccion: ingresoColeccion || null,
        ingresoTonoEstilo: ingresoTonoEstilo || null,
        ingresoPublicoSexo: ingresoPublicoSexo || null,
        ingresoPublicoEdad: ingresoPublicoEdad || null,
        ingresoPublicoPerfil: ingresoPublicoPerfil || null,
        ingresoPropositoSocial: ingresoPropositoSocial || null,
        ingresoObjetivoComercial: ingresoObjetivoComercial || null,
        ingresoCriterioExtra: ingresoCriterioExtra || null,
        ingresoCondicionesEspeciales: ingresoCondicionesEspeciales || null,
        ingresoObservacionesEquipo: ingresoObservacionesEquipo || null,
        ingresoCoordinador: ingresoCoordinador || null,
        ingresoJefeDepartamento: ingresoJefeDepartamento || null,
        ingresoEditor: ingresoEditor || null,
        ingresoCorrector: ingresoCorrector || null,
        ingresoDisenador: ingresoDisenador || null,
        ingresoCalidad: ingresoCalidad || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacionTitulo.mutate();
    mutacion.mutate();
  }

  if (!puedeEditar) {
    const conValor = [
      { etiqueta: 'Título', valor: titulo },
      { etiqueta: 'Nombre artístico', valor: ficha.ingresoNombreArtistico },
      { etiqueta: 'Nacionalidad', valor: ficha.ingresoNacionalidad },
      { etiqueta: 'Fecha de nacimiento', valor: formatearFechaONull(ficha.ingresoFechaNacimiento) },
      { etiqueta: 'Redes sociales', valor: ficha.ingresoRedesSociales },
      { etiqueta: 'Tipo de proyecto', valor: ficha.ingresoTipoProyecto },
      { etiqueta: 'Detalle del tipo de proyecto', valor: ficha.ingresoTipoProyectoDetalle },
      { etiqueta: 'Fecha de ingreso', valor: formatearFechaONull(ficha.ingresoFechaIngreso) },
      { etiqueta: 'Fecha de cierre', valor: formatearFechaONull(ficha.ingresoFechaCierre) },
      { etiqueta: 'Fecha deseada', valor: formatearFechaONull(ficha.ingresoFechaDeseada) },
      { etiqueta: 'Tema general', valor: ficha.ingresoTemaGeneral },
      { etiqueta: 'Servicio — Perfil', valor: ficha.ingresoServicioPerfil },
      { etiqueta: 'Servicio — Ejecución', valor: ficha.ingresoServicioEjecucion },
      { etiqueta: 'Servicio — Alianza comercial', valor: ficha.ingresoServicioAlianza },
      { etiqueta: 'Servicio — Presupuesto', valor: ficha.ingresoServicioPresupuesto },
      { etiqueta: 'Ocupación', valor: ficha.ingresoOcupacion },
      { etiqueta: 'Personalidad', valor: ficha.ingresoPersonalidad },
      { etiqueta: 'Observaciones', valor: ficha.ingresoObservaciones },
      { etiqueta: 'Posible título del libro', valor: ficha.ingresoPosibleTitulo },
      { etiqueta: 'Colección PanHouse', valor: ficha.ingresoColeccion },
      { etiqueta: 'Tono y estilo', valor: ficha.ingresoTonoEstilo },
      { etiqueta: 'Público objetivo — Sexo', valor: ficha.ingresoPublicoSexo },
      { etiqueta: 'Público objetivo — Edad', valor: ficha.ingresoPublicoEdad },
      { etiqueta: 'Público objetivo — Perfil/Ocupación', valor: ficha.ingresoPublicoPerfil },
      { etiqueta: 'Propósito social', valor: ficha.ingresoPropositoSocial },
      { etiqueta: 'Objetivo comercial', valor: ficha.ingresoObjetivoComercial },
      { etiqueta: 'Criterios extra (diagramación/capítulos)', valor: ficha.ingresoCriterioExtra },
      { etiqueta: 'Condiciones especiales', valor: ficha.ingresoCondicionesEspeciales },
      { etiqueta: 'Observaciones sobre el equipo', valor: ficha.ingresoObservacionesEquipo },
      { etiqueta: 'Coordinador editorial', valor: ficha.ingresoCoordinador },
      { etiqueta: 'Jefe del departamento', valor: ficha.ingresoJefeDepartamento },
      { etiqueta: 'Editor', valor: ficha.ingresoEditor },
      { etiqueta: 'Corrector', valor: ficha.ingresoCorrector },
      { etiqueta: 'Diseñador', valor: ficha.ingresoDisenador },
      { etiqueta: 'Calidad editorial', valor: ficha.ingresoCalidad },
      { etiqueta: 'Perfil del autor', valor: ficha.perfilAutor },
      { etiqueta: 'Público objetivo', valor: ficha.publicoObjetivo },
      { etiqueta: 'Objetivos comerciales', valor: ficha.objetivosComerciales },
    ].filter((c) => c.valor !== null && c.valor !== '');

    return (
      <div className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-medium text-tinta">1. Proyecto — Perfil</h3>
        {conValor.length === 0 ? (
          <SinCompletar />
        ) : (
          <dl className="space-y-1 text-sm">
            {conValor.map((c) => (
              <div key={c.etiqueta}>
                <dt className="inline font-medium text-tinta/70">{c.etiqueta}: </dt>
                <dd className="inline text-tinta">{c.valor}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="mb-6 font-medium text-tinta">1. Proyecto — Perfil</h3>

      <div className="mb-8">
        <label htmlFor="proyecto-titulo" className={LABEL_CLASS}>
          Título
        </label>
        <input
          id="proyecto-titulo"
          type="text"
          value={tituloForm}
          onChange={(event) => {
            setTituloForm(event.target.value);
            mutacionTitulo.reset();
          }}
          className={INPUT_CLASS}
        />
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Datos Personales
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-5">
            <label htmlFor="ingreso-nombre-artistico" className={LABEL_CLASS}>
              Nombre artístico
            </label>
            <input
              id="ingreso-nombre-artistico"
              type="text"
              value={ingresoNombreArtistico}
              onChange={(event) => {
                setIngresoNombreArtistico(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="ingreso-nacionalidad" className={LABEL_CLASS}>
              Nacionalidad
            </label>
            <input
              id="ingreso-nacionalidad"
              type="text"
              value={ingresoNacionalidad}
              onChange={(event) => {
                setIngresoNacionalidad(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="ingreso-fecha-nacimiento" className={LABEL_CLASS}>
              Fecha de nacimiento
            </label>
            <input
              id="ingreso-fecha-nacimiento"
              type="date"
              value={ingresoFechaNacimiento}
              onChange={(event) => {
                setIngresoFechaNacimiento(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-12">
            <label htmlFor="ingreso-redes-sociales" className={LABEL_CLASS}>
              Redes sociales
            </label>
            <input
              id="ingreso-redes-sociales"
              type="text"
              value={ingresoRedesSociales}
              onChange={(event) => {
                setIngresoRedesSociales(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Detalles del Proyecto
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-4">
            <label htmlFor="ingreso-tipo-proyecto" className={LABEL_CLASS}>
              Tipo de proyecto
            </label>
            <input
              id="ingreso-tipo-proyecto"
              type="text"
              placeholder="Ej. Crudo"
              value={ingresoTipoProyecto}
              onChange={(event) => {
                setIngresoTipoProyecto(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="ingreso-tipo-proyecto-detalle" className={LABEL_CLASS}>
              Detalle (tripa/capítulo)
            </label>
            <input
              id="ingreso-tipo-proyecto-detalle"
              type="text"
              value={ingresoTipoProyectoDetalle}
              onChange={(event) => {
                setIngresoTipoProyectoDetalle(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="ingreso-fecha-ingreso" className={LABEL_CLASS}>
              Fecha de ingreso
            </label>
            <input
              id="ingreso-fecha-ingreso"
              type="date"
              value={ingresoFechaIngreso}
              onChange={(event) => {
                setIngresoFechaIngreso(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-6">
            <label htmlFor="ingreso-fecha-cierre" className={LABEL_CLASS}>
              Fecha de cierre
            </label>
            <input
              id="ingreso-fecha-cierre"
              type="date"
              value={ingresoFechaCierre}
              onChange={(event) => {
                setIngresoFechaCierre(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-6">
            <label htmlFor="ingreso-fecha-deseada" className={LABEL_CLASS}>
              Fecha deseada
            </label>
            <input
              id="ingreso-fecha-deseada"
              type="date"
              value={ingresoFechaDeseada}
              onChange={(event) => {
                setIngresoFechaDeseada(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-12">
            <label htmlFor="ingreso-tema-general" className={LABEL_CLASS}>
              Tema general
            </label>
            <input
              id="ingreso-tema-general"
              type="text"
              value={ingresoTemaGeneral}
              onChange={(event) => {
                setIngresoTemaGeneral(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Especificaciones del Servicio
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-3">
            <label htmlFor="ingreso-servicio-perfil" className={LABEL_CLASS}>
              Perfil
            </label>
            <input
              id="ingreso-servicio-perfil"
              type="text"
              value={ingresoServicioPerfil}
              onChange={(event) => {
                setIngresoServicioPerfil(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="ingreso-servicio-ejecucion" className={LABEL_CLASS}>
              Ejecución
            </label>
            <input
              id="ingreso-servicio-ejecucion"
              type="text"
              value={ingresoServicioEjecucion}
              onChange={(event) => {
                setIngresoServicioEjecucion(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="ingreso-servicio-alianza" className={LABEL_CLASS}>
              Alianza comercial
            </label>
            <input
              id="ingreso-servicio-alianza"
              type="text"
              value={ingresoServicioAlianza}
              onChange={(event) => {
                setIngresoServicioAlianza(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="ingreso-servicio-presupuesto" className={LABEL_CLASS}>
              Presupuesto
            </label>
            <input
              id="ingreso-servicio-presupuesto"
              type="text"
              value={ingresoServicioPresupuesto}
              onChange={(event) => {
                setIngresoServicioPresupuesto(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Perfil del Autor
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-12">
            <label htmlFor="ingreso-ocupacion" className={LABEL_CLASS}>
              Ocupación
            </label>
            <input
              id="ingreso-ocupacion"
              type="text"
              placeholder="A qué se dedica el autor"
              value={ingresoOcupacion}
              onChange={(event) => {
                setIngresoOcupacion(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-12">
            <label htmlFor="ingreso-personalidad" className={LABEL_CLASS}>
              Personalidad
            </label>
            <input
              id="ingreso-personalidad"
              type="text"
              value={ingresoPersonalidad}
              onChange={(event) => {
                setIngresoPersonalidad(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-12">
            <label htmlFor="ingreso-observaciones" className={LABEL_CLASS}>
              Observaciones
            </label>
            <textarea
              id="ingreso-observaciones"
              rows={2}
              value={ingresoObservaciones}
              onChange={(event) => {
                setIngresoObservaciones(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Detalles Editoriales
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-6">
            <label htmlFor="ingreso-posible-titulo" className={LABEL_CLASS}>
              Posible título del libro
            </label>
            <input
              id="ingreso-posible-titulo"
              type="text"
              value={ingresoPosibleTitulo}
              onChange={(event) => {
                setIngresoPosibleTitulo(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-6">
            <label htmlFor="ingreso-coleccion" className={LABEL_CLASS}>
              Colección PanHouse
            </label>
            <input
              id="ingreso-coleccion"
              type="text"
              value={ingresoColeccion}
              onChange={(event) => {
                setIngresoColeccion(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-12">
            <label htmlFor="ingreso-tono-estilo" className={LABEL_CLASS}>
              Tono y estilo
            </label>
            <input
              id="ingreso-tono-estilo"
              type="text"
              value={ingresoTonoEstilo}
              onChange={(event) => {
                setIngresoTonoEstilo(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Audiencia y Propósito
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-4">
            <label htmlFor="ingreso-publico-sexo" className={LABEL_CLASS}>
              Público objetivo: Sexo
            </label>
            <input
              id="ingreso-publico-sexo"
              type="text"
              value={ingresoPublicoSexo}
              onChange={(event) => {
                setIngresoPublicoSexo(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="ingreso-publico-edad" className={LABEL_CLASS}>
              Público objetivo: Edad
            </label>
            <input
              id="ingreso-publico-edad"
              type="text"
              value={ingresoPublicoEdad}
              onChange={(event) => {
                setIngresoPublicoEdad(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="ingreso-publico-perfil" className={LABEL_CLASS}>
              Público objetivo: Perfil/Ocupación
            </label>
            <input
              id="ingreso-publico-perfil"
              type="text"
              value={ingresoPublicoPerfil}
              onChange={(event) => {
                setIngresoPublicoPerfil(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-6">
            <label htmlFor="ingreso-proposito-social" className={LABEL_CLASS}>
              Propósito social
            </label>
            <input
              id="ingreso-proposito-social"
              type="text"
              value={ingresoPropositoSocial}
              onChange={(event) => {
                setIngresoPropositoSocial(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-6">
            <label htmlFor="ingreso-objetivo-comercial" className={LABEL_CLASS}>
              Objetivo comercial
            </label>
            <input
              id="ingreso-objetivo-comercial"
              type="text"
              value={ingresoObjetivoComercial}
              onChange={(event) => {
                setIngresoObjetivoComercial(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Parámetros Técnicos y Equipo
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-6">
            <label htmlFor="ingreso-criterio-extra" className={LABEL_CLASS}>
              Criterios extra (diagramación/capítulos)
            </label>
            <input
              id="ingreso-criterio-extra"
              type="text"
              value={ingresoCriterioExtra}
              onChange={(event) => {
                setIngresoCriterioExtra(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-6">
            <label htmlFor="ingreso-condiciones-especiales" className={LABEL_CLASS}>
              Condiciones especiales
            </label>
            <input
              id="ingreso-condiciones-especiales"
              type="text"
              value={ingresoCondicionesEspeciales}
              onChange={(event) => {
                setIngresoCondicionesEspeciales(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-12">
            <label htmlFor="ingreso-observaciones-equipo" className={LABEL_CLASS}>
              Observaciones sobre el equipo
            </label>
            <textarea
              id="ingreso-observaciones-equipo"
              rows={2}
              value={ingresoObservacionesEquipo}
              onChange={(event) => {
                setIngresoObservacionesEquipo(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Equipo Editorial (Ingreso)
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-4">
            <label htmlFor="ingreso-coordinador" className={LABEL_CLASS}>
              Coordinador editorial
            </label>
            <input
              id="ingreso-coordinador"
              type="text"
              value={ingresoCoordinador}
              onChange={(event) => {
                setIngresoCoordinador(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="ingreso-jefe-departamento" className={LABEL_CLASS}>
              Jefe del departamento
            </label>
            <input
              id="ingreso-jefe-departamento"
              type="text"
              value={ingresoJefeDepartamento}
              onChange={(event) => {
                setIngresoJefeDepartamento(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="ingreso-editor" className={LABEL_CLASS}>
              Editor
            </label>
            <input
              id="ingreso-editor"
              type="text"
              value={ingresoEditor}
              onChange={(event) => {
                setIngresoEditor(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="ingreso-corrector" className={LABEL_CLASS}>
              Corrector
            </label>
            <input
              id="ingreso-corrector"
              type="text"
              value={ingresoCorrector}
              onChange={(event) => {
                setIngresoCorrector(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="ingreso-disenador" className={LABEL_CLASS}>
              Diseñador
            </label>
            <input
              id="ingreso-disenador"
              type="text"
              value={ingresoDisenador}
              onChange={(event) => {
                setIngresoDisenador(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="ingreso-calidad" className={LABEL_CLASS}>
              Calidad editorial
            </label>
            <input
              id="ingreso-calidad"
              type="text"
              value={ingresoCalidad}
              onChange={(event) => {
                setIngresoCalidad(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className={BLOQUE_CLASS}>
        <h3 className={BLOQUE_TITULO_CLASS}>
          <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Resumen y Objetivos
        </h3>
        <div className={GRID_CLASS}>
          <div className="md:col-span-12">
            <label htmlFor="perfil-autor" className={LABEL_CLASS}>
              Perfil del autor
            </label>
            <textarea
              id="perfil-autor"
              rows={2}
              value={perfilAutor}
              onChange={(event) => {
                setPerfilAutor(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-12">
            <label htmlFor="publico-objetivo" className={LABEL_CLASS}>
              Público objetivo
            </label>
            <textarea
              id="publico-objetivo"
              rows={2}
              value={publicoObjetivo}
              onChange={(event) => {
                setPublicoObjetivo(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-12">
            <label htmlFor="objetivos-comerciales" className={LABEL_CLASS}>
              Objetivos comerciales
            </label>
            <textarea
              id="objetivos-comerciales"
              rows={2}
              value={objetivosComerciales}
              onChange={(event) => {
                setObjetivosComerciales(event.target.value);
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
          disabled={mutacion.isPending || mutacionTitulo.isPending}
          className="rounded-md bg-dorado px-4 py-2 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
        >
          {mutacion.isPending || mutacionTitulo.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        {mutacion.isSuccess && mutacionTitulo.isSuccess && <span className="text-sm text-green-700">Guardado ✓</span>}
        {(mutacion.isError || mutacionTitulo.isError) && (
          <span role="alert" className="text-sm text-red-600">
            No se pudo guardar
            {mutacion.error instanceof Error
              ? `: ${mutacion.error.message}`
              : mutacionTitulo.error instanceof Error
                ? `: ${mutacionTitulo.error.message}`
                : ''}
            .
          </span>
        )}
      </div>
    </form>
  );
}
