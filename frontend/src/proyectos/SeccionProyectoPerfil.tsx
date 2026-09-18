import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { CampoFichaTecnica, conValorLegacyIncluido, formatearFechaONull } from './campos';
import type { AutorConPerfil, CondicionEspecial, EjecucionServicio, FichaCompleta, PresupuestoServicio, SubtipoCrudo } from '../types/api';
import { actualizarSeccionProyectoContrato, actualizarSeccionProyectoPerfil } from './proyectoDetalleApi';
import { fetchCatalogos, notificarRrpp, reasignarProyecto } from '../jefatura/jefaturaApi';
import { CategoriaBadge } from '../autores/CategoriaBadge';
import { SelectorMultipleCondicionesEspeciales } from './SelectorMultipleCondicionesEspeciales';

function SinCompletar() {
  return <p className="text-sm italic text-tinta/50">Sin completar</p>;
}

// "Instagram: @x, X: @y" — solo las plataformas que el autor completó
// (RedesSociales en server/db/schema/autores.ts, seis todas opcionales).
function formatearRedesSociales(redes: AutorConPerfil['redesSociales']): string | null {
  if (!redes) return null;
  const etiquetas: Record<keyof NonNullable<AutorConPerfil['redesSociales']>, string> = {
    instagram: 'Instagram',
    x: 'X',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok',
    youtube: 'YouTube',
  };
  const partes = (Object.keys(etiquetas) as (keyof typeof etiquetas)[])
    .filter((clave) => redes[clave])
    .map((clave) => `${etiquetas[clave]}: ${redes[clave]}`);
  return partes.length > 0 ? partes.join(', ') : null;
}

// Tarjeta de solo lectura: el perfil del autor (nombre artístico,
// nacionalidad, fecha de nacimiento, redes, ocupación, personalidad) ya
// no se pide como input acá — esos datos viven en `autores` y se editan
// desde el CRM (ClientesGrid.tsx), no desde la ficha de un proyecto
// puntual. Esto es solo una referencia rápida para quien llena el resto
// de la Sección 1 (rrpp), no un formulario — nada de esto viaja en
// actualizarSeccionProyectoPerfil. Itera sobre `autores` (coautoría, ver
// proyectos_autores) para que ningún coautor quede sin mostrarse.
function TarjetaPerfilAutores({ autores }: { autores: AutorConPerfil[] }) {
  if (autores.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-tinta/10 bg-gray-50 p-4 sm:p-6">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
        <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Perfil del Autor
      </h3>
      <div className="space-y-4">
        {autores.map((autor) => {
          const campos = [
            { etiqueta: 'Nacionalidad', valor: autor.nacionalidad && autor.nacionalidad.length > 0 ? autor.nacionalidad.join(', ') : null },
            { etiqueta: 'Fecha de nacimiento', valor: formatearFechaONull(autor.fechaNacimiento) },
            { etiqueta: 'Redes sociales', valor: formatearRedesSociales(autor.redesSociales) },
            { etiqueta: 'Ocupación', valor: autor.ocupacion },
            { etiqueta: 'Personalidad', valor: autor.personalidad && autor.personalidad.length > 0 ? autor.personalidad.join(', ') : null },
          ].filter((c) => c.valor !== null && c.valor !== '');

          return (
            <div key={autor.id}>
              {/* Nombre real/legal como título principal — a pedido
                  explícito del negocio se abandonó el nombre artístico
                  como identificador principal en toda la app (antes era
                  al revés, ver el mismo criterio en el encabezado de
                  ProyectoDetallePage.tsx y ClientesGrid.tsx). El nombre
                  artístico, cuando existe, queda como referencia
                  secundaria debajo, no desaparece. Badge de categoría al
                  lado del nombre: el equipo ve el estatus VIP/Estándar sin
                  tener que ir a Clientes. */}
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-gray-800">{autor.nombre}</p>
                <CategoriaBadge categoria={autor.categoria} />
              </div>
              {autor.nombreArtistico && <p className="mb-1.5 text-xs text-tinta/50">Nombre artístico: {autor.nombreArtistico}</p>}
              {campos.length === 0 ? (
                <SinCompletar />
              ) : (
                <dl className="space-y-1 text-sm">
                  {campos.map((c) => (
                    <div key={c.etiqueta}>
                      <dt className="inline font-medium text-tinta/70">{c.etiqueta}: </dt>
                      <dd className="inline text-tinta">{c.valor}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const INPUT_CLASS =
  'w-full bg-white border border-gray-200 text-gray-900 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-tinta/20 focus:border-tinta transition-all placeholder:text-gray-400';
const LABEL_CLASS = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';
const AYUDA_CLASS = 'mt-1 text-xs text-gray-500';
const BLOQUE_CLASS = 'mb-8 pb-6 border-b border-gray-100 last:border-0';
const BLOQUE_TITULO_CLASS = 'text-base font-bold text-gray-900 mb-5 flex items-center gap-2';
const GRID_CLASS = 'grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-5';

const SUBTIPOS_CRUDO: SubtipoCrudo[] = ['Capítulo', 'Tripa'];

// Traducción de la fórmula de Excel provista por el negocio. Comercial
// solo elige la categoría general del servicio al crear el proyecto
// (Sello editorial/Escritura fantasma/Crudo, ver CODIGOS_SERVICIO_ALTA
// en CrearProyectoModalForm.tsx) — EEC/EET (las categorías de la
// primera versión, "Capítulo"/"Tripa" como servicios separados) se
// desactivaron en el catálogo (server/db/seed.ts), reemplazadas por
// 'Crudo'.
//
// Si el servicio es 'CR', el plazo depende del subtipo que define rrpp
// (fichasTrazabilidad.ingresoServicioSubtipoCrudo, ver el <select>
// "Especificación de Crudo" en Detalles del Proyecto más abajo) — sin
// ese subtipo todavía elegido, esta función devuelve null a propósito
// (el useEffect de más abajo lo interpreta como "no calcular", deja
// Fecha de Cierre vacía en vez de inventar un valor).
//
// EEC/EET se mantienen como rama de compatibilidad: el único proyecto
// real que ya tenía uno de los dos asignado antes de este cambio sigue
// calculando con el mismo valor fijo de siempre — desactivarlos en el
// catálogo (para que nadie los vuelva a elegir) no les rompe el cálculo
// retroactivamente.
const DIAS_POR_SERVICIO_LEGACY: Record<string, number> = {
  EEC: 150,
  EET: 90,
};
const DIAS_POR_DEFECTO = 90;

function diasDePlazoPorServicio(servicioCodigo: string, subtipoCrudo: SubtipoCrudo | ''): number | null {
  if (servicioCodigo === 'SE') return 60;
  if (servicioCodigo === 'EF') return 180;
  if (servicioCodigo === 'CR') {
    if (subtipoCrudo === 'Capítulo') return 150;
    if (subtipoCrudo === 'Tripa') return 90;
    return null;
  }
  return DIAS_POR_SERVICIO_LEGACY[servicioCodigo] ?? DIAS_POR_DEFECTO;
}

// Aritmética en UTC a propósito: fechaISO llega como 'YYYY-MM-DD' (mismo
// formato que <input type="date">) — construir con `new Date(fechaISO)`
// a secas y sumar con setDate() opera en hora LOCAL, lo que puede
// correr un día hacia atrás/adelante según la zona horaria del
// navegador al volver a leer el resultado. Date.UTC/getUTC*/setUTCDate
// evitan ese corrimiento por completo: el cálculo nunca toca la zona
// horaria local.
function sumarDiasISO(fechaISO: string, dias: number): string {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

// Rangos temporales, no números exactos: comercial todavía no define la
// cantidad real de capítulos/páginas al vender. Placeholder funcional a
// pedido explícito del negocio, mientras se define el catálogo real de
// rangos.
const OPCIONES_CAPITULOS = ['1 a 5', '6 a 10', '11 a 20'] as const;
const OPCIONES_PAGINAS = ['50', '100', '150', '200'] as const;


// Sección 1 completa — antes partida en dos tarjetas (Perfil, a cargo de
// rrpp, y Contrato, a cargo de comercial), unificada a pedido explícito
// del negocio en una sola tarjeta/formulario con un único botón
// Guardar. El permiso para ver el formulario completo (vs. el resumen de
// solo lectura) sigue siendo puedeEditar (comercial/rrpp/jefe_area,
// igual que antes en Perfil) — pero dentro de ese formulario, Capítulos
// y páginas / Criterio extra / Condiciones especiales (antes solo
// editables por comercial) quedan deshabilitados para quien no sea
// comercial (puedeEditarContrato), mismo control de acceso que existía
// separado, ahora aplicado campo por campo en vez de tarjeta por
// tarjeta. Al guardar, se disparan dos o tres mutaciones PATCH según
// corresponda (mutacionServicio + mutacion siempre; mutacionContrato
// solo si puedeEditarContrato) — cada una sigue escribiendo en su propio
// endpoint/columnas, la fusión es solo visual.
//
// Sin campo de título: el negocio lo retiró (ver el comentario de la
// columna en server/db/schema/proyectos.ts, y también su antigua ruta
// PATCH /proyectos/:id/titulo, eliminada junto con él) — el nombre
// visual del proyecto ahora se genera solo (autores + codigo), ver el
// encabezado de ProyectoDetallePage.tsx.
//
// Los seis campos de perfil del autor (nombre artístico, nacionalidad,
// fecha de nacimiento, redes sociales, ocupación, personalidad) que
// vivían acá se eliminaron de este formulario — duplicaban uno a uno
// los campos que ya existen en `autores` (ver TarjetaPerfilAutores más
// arriba, que los muestra de solo lectura desde ahí). "Perfil"
// (Estándar/VIP a nivel de proyecto), "Audiencia y Propósito",
// "Parámetros Técnicos y Equipo", "Equipo Editorial (Ingreso)" y
// "Resumen y Objetivos" también se eliminaron a pedido explícito del
// negocio: bloques de una matriz de Excel vieja sin uso real en
// producción (ver el comentario en server/db/schema/trazabilidad.ts).
export function SeccionProyectoPerfil({
  proyectoId,
  ficha,
  autores,
  servicio,
  puedeEditar,
  puedeEditarContrato,
  puedeEditarComercial,
  puedeNotificarRrpp,
  notificadoRrpp,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  autores: AutorConPerfil[];
  servicio: { id: string; codigo: string; nombre: string };
  puedeEditar: boolean;
  // Comercial-only (ver ProyectoDetallePage.tsx) — gatea Capítulos y
  // páginas/Criterio extra/Condiciones especiales.
  puedeEditarContrato: boolean;
  // Mismo guard que PATCH /api/proyectos/:id/reasignar en el backend
  // (requireRole('comercial', 'jefe_area')) — más angosto que puedeEditar
  // (que también incluye rrpp). A pedido explícito del negocio, gatea
  // TODO el bloque comercial (Tipo de servicio, Fecha de ingreso,
  // Ejecución, Alianza comercial, Presupuesto): rrpp los ve como texto
  // estático, no como <select>/<input> editable — solo "Observaciones"
  // (más abajo) y "Especificación de Crudo" (dentro de Detalles del
  // Proyecto, cuando el servicio es 'CR') quedan editables para rrpp.
  puedeEditarComercial: boolean;
  // Solo comercial (mismo dueño que puedeEditarContrato) ve el botón
  // "Enviar a RRPP" — el resto de los roles con puedeEditar en true
  // (rrpp, jefe_area) solo ven "Guardar" liso, ver el botón al final.
  puedeNotificarRrpp: boolean;
  // Ya se envió antes (proyecto.notificadoRrpp) — una vez enviado, no
  // tiene sentido reofrecer "Enviar a RRPP" (idempotente, mismo criterio
  // que BotonNotificarTransicion.tsx): el formulario vuelve a mostrar
  // "Guardar" liso para seguir corrigiendo datos sin reenviar.
  notificadoRrpp: boolean;
}) {
  const catalogosQuery = useQuery({ queryKey: ['catalogos'], queryFn: fetchCatalogos });

  const [servicioCodigo, setServicioCodigo] = useState(servicio.codigo);

  const [ingresoFechaIngreso, setIngresoFechaIngreso] = useState(ficha.ingresoFechaIngreso ?? '');
  const [ingresoFechaCierre, setIngresoFechaCierre] = useState(ficha.ingresoFechaCierre ?? '');
  // Dueño rrpp (junto con Observaciones) — a diferencia del resto de esta
  // sección, editable para rrpp incluso con puedeEditarComercial en
  // false. Solo aplica cuando servicioCodigo === 'CR', ver el <select>
  // "Especificación de Crudo" en Detalles del Proyecto más abajo.
  const [ingresoServicioSubtipoCrudo, setIngresoServicioSubtipoCrudo] = useState<SubtipoCrudo | ''>(
    ficha.ingresoServicioSubtipoCrudo ?? '',
  );

  const [ingresoServicioEjecucion, setIngresoServicioEjecucion] = useState<EjecucionServicio>(ficha.ingresoServicioEjecucion);
  // Texto (no number) para que el input pueda estar vacío mientras el
  // usuario escribe — mismo patrón que capitulosPactados/paginasPactadas
  // más abajo. Solo se renderiza y se manda cuando
  // ingresoServicioEjecucion === 'Express' (ver más abajo).
  const [ingresoTiempoExpresMeses, setIngresoTiempoExpresMeses] = useState(ficha.ingresoTiempoExpresMeses?.toString() ?? '');
  const [ingresoServicioAlianza, setIngresoServicioAlianza] = useState(ficha.ingresoServicioAlianza);
  const [ingresoServicioPresupuesto, setIngresoServicioPresupuesto] = useState<PresupuestoServicio | ''>(
    ficha.ingresoServicioPresupuesto ?? '',
  );

  const [ingresoObservaciones, setIngresoObservaciones] = useState(ficha.ingresoObservaciones ?? '');

  // Dueño comercial (puedeEditarContrato) — ver el comentario de la
  // función arriba.
  const [capitulosPactados, setCapitulosPactados] = useState(ficha.capitulosPactados ?? '');
  const [paginasPactadas, setPaginasPactadas] = useState(ficha.paginasPactadas ?? '');
  const [criterioExtra, setCriterioExtra] = useState(ficha.criterioExtra ?? '');
  const [condicionesEspeciales, setCondicionesEspeciales] = useState<CondicionEspecial[]>(ficha.condicionesEspeciales ?? []);

  // Fecha de cierre automática: equivalente a un watch(['ingresoFechaIngreso',
  // 'servicioCodigo', 'ingresoServicioSubtipoCrudo']) + setValue('ingresoFechaCierre', ...)
  // de react-hook-form (esta base de código no usa esa librería, ver el
  // resto del archivo: todo useState liso) — recalcula y sobreescribe
  // cada vez que cambia cualquiera de los tres, incluso al cargar la
  // ficha por primera vez. El campo queda deshabilitado en el JSX de más
  // abajo para que nadie la edite a mano — el objetivo explícito de esta
  // regla es eliminar el error de cálculo humano, así que el valor
  // mostrado SIEMPRE es el calculado, nunca el que haya quedado
  // guardado antes de esta automatización. Nada de esto se persiste
  // solo — como el resto de la sección, hace falta apretar Guardar.
  //
  // Si el servicio es 'CR' y todavía no hay subtipo elegido,
  // diasDePlazoPorServicio devuelve null — acá eso se traduce en limpiar
  // Fecha de Cierre (nunca queda un valor viejo de otro servicio
  // pegado), no en inventar un número. El input lo muestra como
  // "Pendiente de selección por RRPP" más abajo. En cuanto rrpp elige
  // Capítulo o Tripa (el <select> de más abajo), este mismo efecto
  // recalcula la fecha real de inmediato, sin esperar a Guardar.
  useEffect(() => {
    if (!ingresoFechaIngreso) return;
    const dias = diasDePlazoPorServicio(servicioCodigo, ingresoServicioSubtipoCrudo);
    setIngresoFechaCierre(dias === null ? '' : sumarDiasISO(ingresoFechaIngreso, dias));
  }, [ingresoFechaIngreso, servicioCodigo, ingresoServicioSubtipoCrudo]);

  const queryClient = useQueryClient();

  // El servicio vive en `proyectos` (no en la ficha de trazabilidad) —
  // mismo mecanismo de escritura que CrearProyectoModalForm.tsx en modo
  // edición: PATCH /:id/reasignar, ya acepta servicioId solo.
  //
  // Si servicioCodigo sigue siendo el servicio real de la ficha (nadie
  // tocó el <select>, ver el <option> agregado a mano más abajo cuando
  // ese servicio está desactivado), su id no sale de catalogosQuery
  // (filtra activo=true) — se usa servicio.id directamente para no
  // depender del catálogo activo en ese caso puntual.
  const servicioId =
    servicioCodigo === servicio.codigo
      ? servicio.id
      : catalogosQuery.data?.servicios.find((s) => s.codigo === servicioCodigo)?.id;

  const mutacionServicio = useMutation({
    mutationFn: () => {
      if (!servicioId) throw new Error('Selecciona un servicio válido');
      return reasignarProyecto(proyectoId, { servicioId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
    },
  });

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionProyectoPerfil(proyectoId, {
        ingresoFechaIngreso: ingresoFechaIngreso || null,
        ingresoFechaCierre: ingresoFechaCierre || null,
        // Editable para rrpp aunque el resto de esta mutación no lo sea
        // (ver puedeEditarComercial) — es justamente el campo que rrpp
        // necesita completar para que se recalcule Fecha de Cierre.
        ingresoServicioSubtipoCrudo: ingresoServicioSubtipoCrudo || null,
        ingresoServicioEjecucion,
        // Siempre null cuando la ejecución no es Express, aunque el
        // input todavía tenga un número escrito de una selección
        // anterior — evita mandar un tiempoExpresMeses obsoleto para un
        // proyecto que ya volvió a 'Normal'.
        ingresoTiempoExpresMeses:
          ingresoServicioEjecucion === 'Express' && ingresoTiempoExpresMeses ? Number(ingresoTiempoExpresMeses) : null,
        ingresoServicioAlianza,
        ingresoServicioPresupuesto: ingresoServicioPresupuesto || null,
        ingresoObservaciones: ingresoObservaciones || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
    },
  });

  const mutacionContrato = useMutation({
    mutationFn: () =>
      actualizarSeccionProyectoContrato(proyectoId, {
        capitulosPactados: capitulosPactados || null,
        paginasPactadas: paginasPactadas || null,
        criterioExtra: criterioExtra || null,
        condicionesEspeciales: condicionesEspeciales.length > 0 ? condicionesEspeciales : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
    },
  });

  // Mismo endpoint/mecánica que el antiguo botón separado "Notificar a
  // RRPP" (BotonNotificarTransicion.tsx, ver ProyectoDetallePage.tsx):
  // el backend ya responde 409 si ya se había notificado antes
  // (idempotencia vía proyecto.notificadoRrpp) — acá ni siquiera se
  // ofrece el botón una vez notificadoRrpp=true, ver el JSX más abajo.
  const mutacionNotificarRrpp = useMutation({
    mutationFn: () => notificarRrpp(proyectoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
    },
  });

  // 'enviar' vs 'guardar' distingue qué mutaciones cuentan para el
  // mensaje de éxito/error de abajo: mutacionNotificarRrpp solo se
  // dispara al hacer clic en "Enviar a RRPP", nunca en "Guardar
  // borrador" — sin este guard, mutacionNotificarRrpp se quedaría en
  // 'idle' tras un "Guardar borrador" y el AND de guardadoOk nunca
  // sería true para ese caso.
  const [accionEnCurso, setAccionEnCurso] = useState<'guardar' | 'enviar' | null>(null);

  // Sin estos dos guards, un rol que no puede tocar ese bloque (rrpp no
  // edita el comercial, ver puedeEditarComercial arriba; rrpp/jefe_area
  // no editan el contrato, ver puedeEditarContrato) vería igual el
  // guard 403 del backend en cada Guardar, aunque los campos estén
  // como texto estático y nadie los haya tocado.
  function guardarCampos() {
    mutacion.mutate();
    if (puedeEditarComercial) mutacionServicio.mutate();
    if (puedeEditarContrato) mutacionContrato.mutate();
  }

  function handleGuardarBorrador(event: FormEvent) {
    event.preventDefault();
    setAccionEnCurso('guardar');
    guardarCampos();
  }

  function handleEnviarRrpp() {
    if (!window.confirm('¿Estás seguro de enviar este proyecto a RRPP? Asegúrate de que los datos del contrato estén correctos.')) {
      return;
    }
    setAccionEnCurso('enviar');
    guardarCampos();
    mutacionNotificarRrpp.mutate();
  }

  // Ídem guardarCampos: una mutación que nunca se dispara para este rol
  // o esta acción se queda en estado 'idle' para siempre — no debe
  // contar ni para el mensaje de éxito ni para el de error de todo el
  // formulario.
  const notificarCuenta = accionEnCurso === 'enviar';
  const guardando =
    mutacion.isPending ||
    (puedeEditarComercial && mutacionServicio.isPending) ||
    (puedeEditarContrato && mutacionContrato.isPending) ||
    (notificarCuenta && mutacionNotificarRrpp.isPending);
  const guardadoOk =
    mutacion.isSuccess &&
    (!puedeEditarComercial || mutacionServicio.isSuccess) &&
    (!puedeEditarContrato || mutacionContrato.isSuccess) &&
    (!notificarCuenta || mutacionNotificarRrpp.isSuccess);
  const huboError =
    mutacion.isError ||
    (puedeEditarComercial && mutacionServicio.isError) ||
    (puedeEditarContrato && mutacionContrato.isError) ||
    (notificarCuenta && mutacionNotificarRrpp.isError);
  const errorMensaje =
    mutacion.error instanceof Error
      ? mutacion.error.message
      : puedeEditarComercial && mutacionServicio.error instanceof Error
        ? mutacionServicio.error.message
        : puedeEditarContrato && mutacionContrato.error instanceof Error
          ? mutacionContrato.error.message
          : notificarCuenta && mutacionNotificarRrpp.error instanceof Error
            ? mutacionNotificarRrpp.error.message
            : undefined;

  if (!puedeEditar) {
    const conValor = [
      { etiqueta: 'Tipo de servicio', valor: `${servicio.codigo} — ${servicio.nombre}` },
      { etiqueta: 'Fecha de ingreso', valor: formatearFechaONull(ficha.ingresoFechaIngreso) },
      {
        etiqueta: 'Fecha de cierre',
        // Mismo criterio que el input deshabilitado del formulario: si
        // el servicio es Crudo y todavía no hay subtipo elegido, no hay
        // fecha calculada que mostrar — se dice explícitamente en vez de
        // dejar que la fila desaparezca (valor null se filtra más abajo)
        // como si el dato nunca hubiera existido. En cuanto rrpp elige
        // el subtipo, esta fila ya muestra la fecha real.
        valor:
          servicio.codigo === 'CR' && !ficha.ingresoServicioSubtipoCrudo
            ? 'Pendiente de selección por RRPP'
            : formatearFechaONull(ficha.ingresoFechaCierre),
      },
      { etiqueta: 'Especificación de Crudo', valor: ficha.ingresoServicioSubtipoCrudo },
      { etiqueta: 'Servicio — Ejecución', valor: ficha.ingresoServicioEjecucion },
      { etiqueta: 'Tiempo Exprés (meses)', valor: ficha.ingresoTiempoExpresMeses },
      { etiqueta: 'Servicio — Alianza comercial', valor: ficha.ingresoServicioAlianza ? 'Sí' : 'No' },
      { etiqueta: 'Servicio — Presupuesto', valor: ficha.ingresoServicioPresupuesto },
      { etiqueta: 'Cantidad de capítulos', valor: ficha.capitulosPactados },
      { etiqueta: 'Hojas diagramadas', valor: ficha.paginasPactadas },
      { etiqueta: 'Criterio extra', valor: ficha.criterioExtra },
      { etiqueta: 'Condiciones especiales', valor: ficha.condicionesEspeciales && ficha.condicionesEspeciales.length > 0 ? ficha.condicionesEspeciales.join(', ') : null },
      { etiqueta: 'Observaciones', valor: ficha.ingresoObservaciones },
    ].filter((c) => c.valor !== null && c.valor !== '');

    return (
      <div>
        <TarjetaPerfilAutores autores={autores} />
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
      </div>
    );
  }

  return (
    <div>
      <TarjetaPerfilAutores autores={autores} />
      <form onSubmit={handleGuardarBorrador} className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="mb-6 font-medium text-tinta">1. Proyecto — Perfil</h3>

        <div className={BLOQUE_CLASS}>
          <h3 className={BLOQUE_TITULO_CLASS}>
            <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Detalles del Proyecto
          </h3>
          {/* Solo comercial/jefe_area (puedeEditarComercial) edita este
              bloque como formulario — para rrpp, "Ficha Técnica": una
              tarjeta de solo lectura por campo (a pedido explícito del
              negocio, en vez de texto plano suelto). */}
          {puedeEditarComercial ? (
            <div className={GRID_CLASS}>
              <div className="md:col-span-4">
                <label htmlFor="proyecto-servicio" className={LABEL_CLASS}>
                  Tipo de servicio
                </label>
                <select
                  id="proyecto-servicio"
                  required
                  value={servicioCodigo}
                  onChange={(event) => {
                    setServicioCodigo(event.target.value);
                    mutacionServicio.reset();
                  }}
                  className={INPUT_CLASS}
                >
                  <option value="" disabled>
                    Selecciona el servicio a contratar...
                  </option>
                  {/* GET /catalogos solo trae servicios activo=true (EEC/EET
                      se desactivaron, ver server/db/seed.ts) — un proyecto
                      legacy ya asignado a uno de esos códigos no tendría
                      <option> que matchee su value, y el <select> nativo cae
                      al primer <option> de la lista SIN avisar (servicioCodigo
                      en React sigue teniendo el valor real, pero servicioId
                      más arriba se computa como undefined contra ese mismo
                      catálogo filtrado, así que Guardar tira "Selecciona un
                      servicio válido" aunque nadie haya tocado este campo).
                      Se agrega el servicio real de la ficha a mano si el
                      catálogo activo no lo trae, para que tanto el <select>
                      como el guardado sigan viendo el valor correcto. */}
                  {catalogosQuery.data?.servicios.some((s) => s.codigo === servicio.codigo) ? null : (
                    <option value={servicio.codigo}>
                      {servicio.codigo} — {servicio.nombre}
                    </option>
                  )}
                  {catalogosQuery.data?.servicios.map((s) => (
                    <option key={s.id} value={s.codigo}>
                      {s.codigo} — {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-4">
                <label htmlFor="ingreso-fecha-ingreso" className={LABEL_CLASS}>
                  Fecha de ingreso
                </label>
                {/* Mismo campo que "Fecha de ingreso" en el modal de alta
                    (CrearProyectoModalForm.tsx) — arranca igual (ver el seed
                    en crearProyectoConCodigo, helpers/proyectos.ts) y
                    cambiarlo acá sincroniza proyectos.fechaProgramadaInicio
                    también (ver actualizarSeccionProyectoPerfil,
                    helpers/trazabilidad.ts), así que sigue siendo la misma
                    fecha para cronograma.ts/alertas.ts. */}
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
              <div className="md:col-span-4">
                <label htmlFor="ingreso-fecha-cierre" className={LABEL_CLASS}>
                  Fecha de cierre
                </label>
                {/* Deshabilitado para TODOS los roles a propósito: se
                    calcula solo a partir de Fecha de ingreso + servicio +
                    subtipo de Crudo (ver el useEffect de arriba), nadie la
                    edita a mano — eso es exactamente lo que esta
                    automatización busca eliminar. Si el servicio es Crudo
                    y todavía no hay subtipo elegido (ver el <select> más
                    abajo), no hay nada que calcular todavía; por ahora se
                    muestra un input de texto con el mensaje de "pendiente"
                    en vez del selector de fecha (un <input type="date"> no
                    puede mostrar un placeholder de texto libre). */}
                {servicioCodigo === 'CR' && !ingresoServicioSubtipoCrudo ? (
                  <input
                    type="text"
                    disabled
                    value="Pendiente de selección por RRPP"
                    className={`${INPUT_CLASS} cursor-not-allowed bg-gray-100 italic text-gray-400`}
                  />
                ) : (
                  <input
                    id="ingreso-fecha-cierre"
                    type="date"
                    value={ingresoFechaCierre}
                    disabled
                    className={`${INPUT_CLASS} cursor-not-allowed bg-gray-100 text-gray-500`}
                  />
                )}
                <p className={AYUDA_CLASS}>Se calcula automáticamente a partir de la fecha de ingreso y el servicio.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <CampoFichaTecnica etiqueta="Tipo de servicio" valor={`${servicio.codigo} — ${servicio.nombre}`} />
              <CampoFichaTecnica etiqueta="Fecha de ingreso" valor={formatearFechaONull(ingresoFechaIngreso) ?? 'Sin definir'} />
              {/* Mismo criterio "pendiente" que la rama editable de arriba:
                  si el servicio es Crudo y todavía no hay subtipo elegido
                  (ver el <select> más abajo, siempre editable para rrpp),
                  no hay fecha calculada que mostrar todavía. En cuanto se
                  elige, esta misma tarjeta cae a la fecha real, sin
                  recargar ni guardar primero. */}
              <CampoFichaTecnica
                etiqueta="Fecha de cierre"
                valor={
                  servicioCodigo === 'CR' && !ingresoServicioSubtipoCrudo
                    ? 'Pendiente de selección por RRPP'
                    : (formatearFechaONull(ingresoFechaCierre) ?? 'Sin definir')
                }
              />
            </div>
          )}
          {/* Editable para rrpp (y comercial) sin importar
              puedeEditarComercial — a diferencia del resto de este
              bloque, definir el subtipo de Crudo es justamente la tarea
              de rrpp que este formulario existe para habilitar. Solo
              aparece cuando el servicio contratado es 'Crudo': para
              Sello editorial/Escritura fantasma/EEC/EET no hay subtipo
              que elegir. Fuera de los dos grids de arriba a propósito
              (uno editable, uno "Ficha Técnica") — este campo es siempre
              el mismo <select> real sin importar el rol. */}
          {servicioCodigo === 'CR' && (
            <div className="mt-4 max-w-xs">
              <label htmlFor="ingreso-servicio-subtipo-crudo" className={LABEL_CLASS}>
                Especificación de Crudo (Capítulo/Tripa)
              </label>
              <select
                id="ingreso-servicio-subtipo-crudo"
                value={ingresoServicioSubtipoCrudo}
                onChange={(event) => {
                  setIngresoServicioSubtipoCrudo(event.target.value as SubtipoCrudo);
                  mutacion.reset();
                }}
                className={INPUT_CLASS}
              >
                <option value="">Sin definir</option>
                {SUBTIPOS_CRUDO.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
              <p className={AYUDA_CLASS}>Define cuál de los dos subtipos es — la Fecha de Cierre se calcula sola al elegir.</p>
            </div>
          )}
        </div>

        <div className={BLOQUE_CLASS}>
          <h3 className={BLOQUE_TITULO_CLASS}>
            <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Especificaciones del Servicio
          </h3>
          {puedeEditarComercial ? (
            <div className={GRID_CLASS}>
              {/* Sin selector de Perfil (Estándar/VIP) acá a propósito: ese
                  dato ya vive a nivel de Cliente (autor.categoria, ver
                  CategoriaBadge en TarjetaPerfilAutores más arriba) —
                  volver a pedirlo por proyecto era redundante y una fuente
                  de datos que no coincidían entre sí. */}
              <div className="md:col-span-3">
                <label htmlFor="ingreso-servicio-ejecucion" className={LABEL_CLASS}>
                  Ejecución
                </label>
                <select
                  id="ingreso-servicio-ejecucion"
                  value={ingresoServicioEjecucion}
                  onChange={(event) => {
                    setIngresoServicioEjecucion(event.target.value as EjecucionServicio);
                    mutacion.reset();
                  }}
                  className={INPUT_CLASS}
                >
                  <option value="Normal">Normal</option>
                  <option value="Express">Express</option>
                </select>
              </div>
              {/* Solo aparece con Ejecución = Express — equivalente a un
                  watch('ejecucion') de react-hook-form (esta base de código
                  no usa esa librería en ningún formulario, ver el resto de
                  este archivo: todo es useState liso), acá el mismo efecto
                  sale de leer directo el estado de ingresoServicioEjecucion. */}
              {ingresoServicioEjecucion === 'Express' && (
                <div className="md:col-span-3">
                  <label htmlFor="ingreso-tiempo-expres-meses" className={LABEL_CLASS}>
                    Tiempo Exprés (meses)
                  </label>
                  <input
                    id="ingreso-tiempo-expres-meses"
                    type="number"
                    min={1}
                    required
                    value={ingresoTiempoExpresMeses}
                    onChange={(event) => {
                      setIngresoTiempoExpresMeses(event.target.value);
                      mutacion.reset();
                    }}
                    className={INPUT_CLASS}
                  />
                </div>
              )}
              <div className="md:col-span-3">
                <label htmlFor="ingreso-servicio-alianza" className={LABEL_CLASS}>
                  Alianza comercial
                </label>
                <select
                  id="ingreso-servicio-alianza"
                  value={ingresoServicioAlianza ? 'Sí' : 'No'}
                  onChange={(event) => {
                    setIngresoServicioAlianza(event.target.value === 'Sí');
                    mutacion.reset();
                  }}
                  className={INPUT_CLASS}
                >
                  <option value="No">No</option>
                  <option value="Sí">Sí</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label htmlFor="ingreso-servicio-presupuesto" className={LABEL_CLASS}>
                  Presupuesto
                </label>
                <select
                  id="ingreso-servicio-presupuesto"
                  value={ingresoServicioPresupuesto}
                  onChange={(event) => {
                    setIngresoServicioPresupuesto(event.target.value as PresupuestoServicio);
                    mutacion.reset();
                  }}
                  className={INPUT_CLASS}
                >
                  <option value="">Sin definir</option>
                  <option value="Plata">Plata</option>
                  <option value="Oro">Oro</option>
                  <option value="Platinium">Platinium</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <CampoFichaTecnica etiqueta="Ejecución" valor={ingresoServicioEjecucion} />
              {ingresoServicioEjecucion === 'Express' && (
                <CampoFichaTecnica etiqueta="Tiempo Exprés (meses)" valor={ingresoTiempoExpresMeses || 'Sin definir'} />
              )}
              <CampoFichaTecnica etiqueta="Alianza comercial" valor={ingresoServicioAlianza ? 'Sí' : 'No'} />
              <CampoFichaTecnica etiqueta="Presupuesto" valor={ingresoServicioPresupuesto || 'Sin definir'} />
            </div>
          )}
        </div>

        <div className={BLOQUE_CLASS}>
          <h3 className={BLOQUE_TITULO_CLASS}>
            <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Capítulos y páginas
          </h3>
          {/* Editable solo por comercial (puedeEditarContrato) — mismo
              control de acceso que antes tenía su propia tarjeta
              "Proyecto — Contrato" (PATCH /proyecto-contrato,
              requireRole('comercial') en el backend), ahora aplicado
              campo por campo dentro de esta misma tarjeta unificada: para
              quien no sea comercial, "Ficha Técnica" en vez de un
              <select>/<textarea> deshabilitado. */}
          {puedeEditarContrato ? (
            <div className={GRID_CLASS}>
              <div className="md:col-span-6">
                <label htmlFor="capitulos-pactados" className={LABEL_CLASS}>
                  Cantidad de capítulos
                </label>
                <select
                  id="capitulos-pactados"
                  value={capitulosPactados}
                  onChange={(event) => {
                    setCapitulosPactados(event.target.value);
                    mutacionContrato.reset();
                  }}
                  className={INPUT_CLASS}
                >
                  <option value="">Sin definir</option>
                  {conValorLegacyIncluido(OPCIONES_CAPITULOS, capitulosPactados).map((opcion) => (
                    <option key={opcion} value={opcion}>
                      {opcion}
                    </option>
                  ))}
                </select>
                <p className={AYUDA_CLASS}>
                  Indica la cantidad de capítulos estipulados por contrato seleccionando una de las opciones de la
                  lista desplegable.
                </p>
              </div>
              <div className="md:col-span-6">
                <label htmlFor="paginas-pactadas" className={LABEL_CLASS}>
                  Hojas diagramadas
                </label>
                <select
                  id="paginas-pactadas"
                  value={paginasPactadas}
                  onChange={(event) => {
                    setPaginasPactadas(event.target.value);
                    mutacionContrato.reset();
                  }}
                  className={INPUT_CLASS}
                >
                  <option value="">Sin definir</option>
                  {conValorLegacyIncluido(OPCIONES_PAGINAS, paginasPactadas).map((opcion) => (
                    <option key={opcion} value={opcion}>
                      {opcion}
                    </option>
                  ))}
                </select>
                <p className={AYUDA_CLASS}>
                  Indica la cantidad de páginas diagramadas estipuladas por contrato seleccionando una de las
                  opciones.
                </p>
              </div>
              <div className="md:col-span-12">
                <label htmlFor="criterio-extra" className={LABEL_CLASS}>
                  Criterio extra
                </label>
                <textarea
                  id="criterio-extra"
                  rows={2}
                  value={criterioExtra}
                  onChange={(event) => {
                    setCriterioExtra(event.target.value);
                    mutacionContrato.reset();
                  }}
                  className={INPUT_CLASS}
                />
                <p className={AYUDA_CLASS}>Menciona cualquier criterio especial a considerar (ej: no incluye ilustraciones, es un cuento, etc.).</p>
              </div>
              <div className="md:col-span-12">
                <label htmlFor="condiciones-especiales" className={LABEL_CLASS}>
                  Condiciones especiales
                </label>
                <SelectorMultipleCondicionesEspeciales
                  value={condicionesEspeciales}
                  onChange={(condiciones) => {
                    setCondicionesEspeciales(condiciones);
                    mutacionContrato.reset();
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <CampoFichaTecnica etiqueta="Cantidad de capítulos" valor={capitulosPactados || 'Sin definir'} />
              <CampoFichaTecnica etiqueta="Hojas diagramadas" valor={paginasPactadas || 'Sin definir'} />
              <CampoFichaTecnica etiqueta="Criterio extra" valor={criterioExtra || 'Sin completar'} />
              <CampoFichaTecnica
                etiqueta="Condiciones especiales"
                valor={condicionesEspeciales.length > 0 ? condicionesEspeciales.join(', ') : 'Ninguna'}
              />
            </div>
          )}
        </div>

        <div className={BLOQUE_CLASS}>
          <h3 className={BLOQUE_TITULO_CLASS}>
            <span className="h-1.5 w-1.5 rounded-full bg-dorado" /> Observaciones del Ingreso
          </h3>
          {/* A pedido explícito del negocio: ahora también bloqueado para
              rrpp (antes era el único campo de esta sección editable para
              ese rol) — mismo permiso que el resto del bloque comercial
              (puedeEditarComercial). rrpp lo ve en un bloque de texto
              (no una tarjeta pequeña como el resto de "Ficha Técnica":
              una observación puede ser un párrafo largo, whitespace-pre-wrap
              conserva los saltos de línea que el <textarea> ya permitía). */}
          {puedeEditarComercial ? (
            <div className={GRID_CLASS}>
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
          ) : (
            <div className="whitespace-pre-wrap rounded-md bg-gray-50 p-4 text-sm text-gray-900">
              {ingresoObservaciones || 'Sin completar'}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Traspaso Comercial → RRPP: solo comercial (puedeNotificarRrpp)
              y solo mientras no se haya enviado antes (notificadoRrpp) —
              una vez enviado, "Guardar" liso alcanza para seguir
              corrigiendo datos sin reenviar (ver el else de abajo). */}
          {puedeNotificarRrpp && !notificadoRrpp ? (
            <>
              <button
                type="button"
                onClick={handleEnviarRrpp}
                disabled={guardando}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {guardando && accionEnCurso === 'enviar' ? 'Enviando…' : 'Enviar a RRPP'}
              </button>
              {/* Guarda los mismos campos que "Enviar a RRPP" pero sin
                  notificar — para cuando comercial todavía no terminó de
                  llenar todo y quiere guardar el avance sin pasarle el
                  turno a RRPP. */}
              <button
                type="submit"
                disabled={guardando}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-500 transition hover:text-gray-700 disabled:opacity-60"
              >
                {guardando && accionEnCurso === 'guardar' ? 'Guardando…' : 'Guardar borrador'}
              </button>
            </>
          ) : (
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-dorado px-4 py-2 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          )}
          {guardadoOk && (
            <span className="text-sm text-green-700">{accionEnCurso === 'enviar' ? 'Enviado a RRPP ✓' : 'Guardado ✓'}</span>
          )}
          {huboError && (
            <span role="alert" className="text-sm text-red-600">
              No se pudo guardar{errorMensaje ? `: ${errorMensaje}` : ''}.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
