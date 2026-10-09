import { useMe } from '../../auth/useAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import type { AutorConPerfil, CondicionEspecial, EjecucionServicio, FichaCompleta, PresupuestoServicio, SubtipoCrudo } from '../../types/api';
import { actualizarSeccionProyectoContrato, actualizarSeccionProyectoPerfil } from '../../proyectos/proyectoDetalleApi';
import { fetchCatalogos, reasignarProyecto } from '../../jefatura/jefaturaApi';

export const SUBTIPOS_CRUDO: SubtipoCrudo[] = ['Capítulo', 'Tripa'];

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
export const OPCIONES_CAPITULOS = ['1 a 5', '6 a 10', '11 a 20'] as const;
export const OPCIONES_PAGINAS = ['50', '100', '150', '200'] as const;



export type ProjectIntakeProps = {
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
  rrppEnviadoAt?: string | null;
  actualizando?: boolean;
};

// One form state and the original mutation/permission logic for both presentations.
export function useProjectIntake({ proyectoId, ficha, servicio, puedeEditarContrato, puedeEditarComercial }: ProjectIntakeProps) {
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
  const { data: usuario } = useMe();
  const puedeEditarSubtipoCrudo = usuario?.rol === 'rrpp';

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

  useEffect(() => {
    if (!puedeEditarSubtipoCrudo) setIngresoServicioSubtipoCrudo(ficha.ingresoServicioSubtipoCrudo ?? '');
  }, [ficha.ingresoServicioSubtipoCrudo, puedeEditarSubtipoCrudo]);

  const mutacionServicio = useMutation({
    mutationFn: () => {
      if (!servicioId) throw new Error('Selecciona un servicio válido');
      return reasignarProyecto(proyectoId, { servicioId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['proyectos', 'activos'] });
    },
  });

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionProyectoPerfil(proyectoId, puedeEditarSubtipoCrudo ? { ingresoServicioSubtipoCrudo: ingresoServicioSubtipoCrudo || null } : {
        ingresoFechaIngreso: ingresoFechaIngreso || null,
        ingresoFechaCierre: ingresoFechaCierre || null,
        // El subtipo solo viaja desde RRPP; Comercial y jefatura no lo escriben.
        ...(puedeEditarSubtipoCrudo ? { ingresoServicioSubtipoCrudo: ingresoServicioSubtipoCrudo || null } : {}),
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
      queryClient.invalidateQueries({ queryKey: ['rrpp'] });
      queryClient.invalidateQueries({ queryKey: ['proyectos', 'activos'] });
      queryClient.invalidateQueries({ queryKey: ['fichas-trazabilidad', 'pendientes', 'contrato'] });
      queryClient.invalidateQueries({ queryKey: ['metricas', 'comercial'] });
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
      queryClient.invalidateQueries({ queryKey: ['rrpp'] });
      queryClient.invalidateQueries({ queryKey: ['proyectos', 'activos'] });
      queryClient.invalidateQueries({ queryKey: ['fichas-trazabilidad', 'pendientes', 'contrato'] });
      queryClient.invalidateQueries({ queryKey: ['metricas', 'comercial'] });
    },
  });

  // Comparamos campos editables; la fecha de cierre es calculada.
  const firma = JSON.stringify({
    ...(puedeEditarComercial ? { servicioCodigo, ingresoFechaIngreso, ingresoServicioEjecucion,
      ingresoTiempoExpresMeses, ingresoServicioAlianza, ingresoServicioPresupuesto } : {}),
    ...(puedeEditarContrato ? { capitulosPactados, paginasPactadas, criterioExtra, condicionesEspeciales } : {}),
    ...(puedeEditarSubtipoCrudo ? { ingresoServicioSubtipoCrudo } : {}), ingresoObservaciones,
  });
  const [firmaGuardada, setFirmaGuardada] = useState(firma);
  const cambiosPendientes = firma !== firmaGuardada;
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string>();

  async function handleGuardarBorrador(event: FormEvent) {
    event.preventDefault();
    if (guardando) return;
    const firmaEnviada = firma;
    setGuardando(true);
    setGuardado(false);
    setErrorGuardado(undefined);
    try {
      // Esperar a todas las escrituras, incluso cuando alguna falla.
      const resultados = await Promise.allSettled([
        mutacion.mutateAsync(),
        ...(puedeEditarComercial ? [mutacionServicio.mutateAsync()] : []),
        ...(puedeEditarContrato ? [mutacionContrato.mutateAsync()] : []),
      ]);
      await Promise.all([
        ['ficha', proyectoId], ['proyecto', proyectoId], ['proyectos', 'activos'],
        ['fichas-trazabilidad', 'pendientes', 'contrato'], ['metricas', 'comercial'],
        ['rrpp', 'dashboard'],
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      const fallo = resultados.find((r) => r.status === 'rejected');
      if (fallo?.status === 'rejected') throw fallo.reason;
      setFirmaGuardada(firmaEnviada);
      setGuardado(true);
    } catch (error) {
      setErrorGuardado(error instanceof Error ? error.message : 'Inténtalo nuevamente.');
    } finally { setGuardando(false); }
  }
  const guardadoOk = guardado && !cambiosPendientes && !guardando;
  const huboError = errorGuardado !== undefined;
  const errorMensaje = errorGuardado;

  return {
    puedeEditarSubtipoCrudo, catalogosQuery, servicioCodigo, setServicioCodigo, ingresoFechaIngreso, setIngresoFechaIngreso,
    ingresoFechaCierre, ingresoServicioSubtipoCrudo, setIngresoServicioSubtipoCrudo,
    ingresoServicioEjecucion, setIngresoServicioEjecucion, ingresoTiempoExpresMeses, setIngresoTiempoExpresMeses,
    ingresoServicioAlianza, setIngresoServicioAlianza, ingresoServicioPresupuesto, setIngresoServicioPresupuesto,
    ingresoObservaciones, setIngresoObservaciones, capitulosPactados, setCapitulosPactados,
    paginasPactadas, setPaginasPactadas, criterioExtra, setCriterioExtra, condicionesEspeciales, setCondicionesEspeciales,
    mutacionServicio, mutacion, mutacionContrato, cambiosPendientes, guardando, guardadoOk, huboError, errorMensaje,
    handleGuardarBorrador
  };
}
