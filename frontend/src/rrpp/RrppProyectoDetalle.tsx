import { useRef, useState, type ReactNode } from 'react';
import { Link, type SetURLSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ErrorIngreso } from './RrppIngresosPage';
import { RrppIcon } from './RrppIcons';
import { fechaActividad } from './RrppDashboardCards';
import { ReviewConceptsModal } from './ReviewConceptsModal';
import type { ConceptosRrpp } from './rrppDashboardApi';
import {
  ESTADOS_ETAPA,
  ESTADOS_MACRO,
  fetchHistorialProyecto,
  fetchResumenProyecto,
  type EventoConsulta,
  type ResumenProyectoConsulta,
} from './rrppProyectosApi';
import './rrppProyectos.css';

const TABS = [
  ['resumen', 'Resumen'],
  ['comercial', 'Contexto comercial'],
  ['diagnostico', 'Diagnóstico RRPP'],
  ['creativa', 'Creativa'],
  ['produccion', 'Producción'],
  ['lanzamiento', 'Lanzamiento'],
  ['historial', 'Historial'],
] as const;
const boton =
  'inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold text-slate-900 hover:bg-slate-50';
export function BadgeConsulta({
  estado,
  children,
  compacto = false,
}: {
  estado: string;
  children: ReactNode;
  compacto?: boolean;
}) {
  const color = ['completado', 'culminado', 'en_proceso', 'enviado'].includes(
    estado,
  )
    ? 'bg-emerald-50 text-emerald-700'
    : ['en_progreso', 'ingreso', 'conceptos'].includes(estado)
      ? 'bg-blue-50 text-blue-700'
      : ['bloqueado', 'retrasado', 'pausado'].includes(estado)
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-100 text-slate-600';
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-md px-2 ${compacto ? 'py-0.5' : 'py-1'} text-[10px] font-medium leading-3 ${color}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
      />
      <span>{children}</span>
    </span>
  );
}
export function ConsultaSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando proyectos"
      className="animate-pulse space-y-5 p-5"
    >
      <div className="h-6 w-2/3 rounded bg-slate-100" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 rounded bg-slate-100" />
      ))}
    </div>
  );
}
function Card({
  titulo,
  icono,
  children,
  accion,
}: {
  titulo: string;
  icono: Parameters<typeof RrppIcon>[0]['nombre'];
  children: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200/80 bg-white p-4">
      <div className="mb-3 flex items-center gap-3">
        <RrppIcon
          nombre={icono}
          className="h-[18px] w-[18px] shrink-0 text-slate-900"
        />
        <h3 className="text-xs font-bold text-slate-900">{titulo}</h3>
        {accion && (
          <div className="ml-auto shrink-0 text-[10px] text-blue-600">
            {accion}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
function fecha(valor?: string | null) {
  return valor
    ? new Date(
        valor.length === 10 ? `${valor}T12:00:00Z` : valor,
      ).toLocaleDateString('es-VE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
}
function vencimiento(valor: string | null) {
  return valor && valor.length > 10
    ? new Date(valor).toLocaleString('es-VE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : fecha(valor);
}
function Datos({ filas }: { filas: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(100px,42%)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[11px] leading-4">
      {filas.map(([label, valor]) => (
        <div key={label} className="contents">
          <dt className="text-slate-500">{label}</dt>
          <dd className="min-w-0 whitespace-pre-wrap break-words text-slate-900">
            {valor === null || valor === undefined || valor === ''
              ? '—'
              : valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function Timeline({ eventos }: { eventos: EventoConsulta[] }) {
  return eventos.length ? (
    <ol className="ml-1 border-l border-slate-200">
      {eventos.map((e) => (
        <li key={e.id} className="relative pb-3 pl-6 last:pb-0">
          <span
            aria-hidden="true"
            className={`absolute -left-[4.5px] top-1 h-2 w-2 rounded-full ${e.area === 'RRPP' ? 'bg-emerald-500' : e.area === 'Comercial' ? 'bg-amber-500' : 'bg-blue-500'}`}
          />
          <p className="text-[11px] font-medium leading-4 text-slate-900">
            {e.titulo}
          </p>
          <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
            {e.area} ·{' '}
            <time
              dateTime={e.fecha}
              title={new Date(e.fecha).toLocaleString('es-VE')}
            >
              {fechaActividad(e.fecha)}
            </time>
          </p>
        </li>
      ))}
    </ol>
  ) : (
    <p className="text-xs text-slate-500">
      No hay actividad de negocio registrada.
    </p>
  );
}
function Historial({ id }: { id: string }) {
  const [pagina, setPagina] = useState(1);
  const query = useQuery({
    queryKey: ['rrpp', 'proyecto-historial', id, pagina],
    queryFn: () => fetchHistorialProyecto(id, pagina),
    staleTime: 0,
  });
  return (
    <Card titulo="Historial del proyecto" icono="actividad">
      {query.isLoading ? (
        <ConsultaSkeleton />
      ) : query.isError ? (
        <ErrorIngreso
          error={query.error}
          reintentar={() => void query.refetch()}
        />
      ) : (
        <>
          <Timeline eventos={query.data?.eventos ?? []} />
          {query.data && query.data.paginas > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-xs">
              <button
                disabled={pagina === 1}
                onClick={() => setPagina((p) => p - 1)}
                className={boton}
              >
                Anterior
              </button>
              <span>
                {pagina} / {query.data.paginas}
              </span>
              <button
                disabled={pagina >= query.data.paginas}
                onClick={() => setPagina((p) => p + 1)}
                className={boton}
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
function servicio(p: ResumenProyectoConsulta) {
  return p.servicio.codigo === 'CR'
    ? `CR — Crudo ${p.subtipoCrudo ? `· ${p.subtipoCrudo}` : '· pendiente de clasificación'}`
    : `${p.servicio.codigo} — ${p.servicio.nombre}`;
}
export function RrppProyectoDetalle({
  id,
  params,
  setParams,
}: {
  id: string;
  params: URLSearchParams;
  setParams: SetURLSearchParams;
}) {
  const query = useQuery({
    queryKey: ['rrpp', 'proyecto-resumen', id],
    queryFn: () => fetchResumenProyecto(id),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });
  const [revision, setRevision] = useState<ConceptosRrpp | null>(null);
  const [aviso, setAviso] = useState('');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tab = TABS.some(([key]) => key === params.get('tab'))
    ? params.get('tab')!
    : 'resumen';
  function elegir(key: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === 'resumen') next.delete('tab');
      else next.set('tab', key);
      return next;
    });
  }
  const p = query.data;
  const fichaHref = `/proyectos/${id}/ficha-trazabilidad`;
  const ingresoHref = `/rrpp/ingresos?proyecto=${id}`;
  return (
    <article
      aria-label="Detalle del proyecto"
      className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm min-[1200px]:max-h-[calc(100dvh-240px)] min-[1200px]:min-h-[360px] min-[1200px]:overflow-y-auto"
    >
      <button
        onClick={() =>
          setParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('proyecto');
            next.delete('tab');
            return next;
          })
        }
        className="m-4 text-xs font-semibold text-blue-600 min-[1200px]:hidden"
      >
        ← Volver a proyectos
      </button>
      {query.isLoading ? (
        <ConsultaSkeleton />
      ) : query.isError ? (
        <div className="p-5">
          <ErrorIngreso
            error={query.error}
            reintentar={() => void query.refetch()}
          />
        </div>
      ) : (
        p && (
          <>
            <header className="p-4 pb-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-xl font-bold leading-7 tracking-tight text-slate-900">
                    {p.nombre} —{' '}
                    <span className="whitespace-nowrap">#{p.codigo}</span>
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">{servicio(p)}</p>
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <Link
                    to={fichaHref}
                    className={`${boton} hidden sm:inline-flex`}
                  >
                    <RrppIcon nombre="externo" className="h-3.5 w-3.5" /> Ver ficha completa
                  </Link>
                  <details className="relative">
                    <summary
                      aria-label="Más opciones del proyecto"
                      className="cursor-pointer list-none rounded p-2 text-xl leading-5 text-slate-700"
                    >
                      ⋮
                    </summary>
                    <div className="absolute right-0 z-10 mt-2 w-44 rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-lg">
                      <Link
                        to={fichaHref}
                        className="block rounded px-2 py-2 hover:bg-slate-50"
                      >
                        Ver ficha completa
                      </Link>
                      <button
                        onClick={(e) => {
                          elegir('historial');
                          e.currentTarget
                            .closest('details')
                            ?.removeAttribute('open');
                        }}
                        className="block w-full rounded px-2 py-2 text-left hover:bg-slate-50"
                      >
                        Ver historial
                      </button>
                      {p.abrirIngreso && (
                        <Link
                          to={ingresoHref}
                          className="block rounded px-2 py-2 hover:bg-slate-50"
                        >
                          Abrir ingreso
                        </Link>
                      )}
                    </div>
                  </details>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[10px] sm:grid-cols-4">
                <div>
                  <dt className="mb-1.5 text-slate-500">Estado general</dt>
                  <dd>
                    <BadgeConsulta estado={p.estado}>
                      {ESTADOS_MACRO[p.estado]}
                    </BadgeConsulta>
                  </dd>
                </div>
                <div>
                  <dt className="mb-1.5 text-slate-500">Estado RRPP</dt>
                  <dd>
                    <BadgeConsulta estado={p.contextoRrpp}>
                      {p.contextoEtiqueta}
                    </BadgeConsulta>
                  </dd>
                </div>
                <div>
                  <dt className="mb-1.5 text-slate-500">Responsable actual</dt>
                  <dd
                    className="font-medium leading-4 text-slate-900"
                    title={p.areasActuales
                      .map(
                        (a) =>
                          `${a.area}${a.personas.length ? `: ${a.personas.join(', ')}` : ''}`,
                      )
                      .join(' · ')}
                  >
                    {p.responsableActual}
                  </dd>
                </div>
                <div>
                  <dt className="mb-1.5 text-slate-500">Fecha de ingreso</dt>
                  <dd className="flex items-center gap-2 text-[11px] text-slate-900">
                    <RrppIcon nombre="calendario" className="h-4 w-4" />
                    {fecha(p.fechas.ingreso)}
                  </dd>
                </div>
              </dl>
            </header>
            <div
              role="tablist"
              aria-label="Secciones del proyecto"
              className="flex overflow-x-auto border-y border-slate-100 bg-slate-50/40 px-3"
            >
              {TABS.map(([key, label], index) => (
                <button
                  key={key}
                  ref={(element) => {
                    tabRefs.current[index] = element;
                  }}
                  id={`tab-${key}`}
                  aria-controls={`panel-${key}`}
                  role="tab"
                  aria-selected={tab === key}
                  tabIndex={tab === key ? 0 : -1}
                  onClick={() => elegir(key)}
                  onKeyDown={(event) => {
                    let destino = index;
                    if (event.key === 'ArrowRight')
                      destino = (index + 1) % TABS.length;
                    else if (event.key === 'ArrowLeft')
                      destino = (index + TABS.length - 1) % TABS.length;
                    else if (event.key === 'Home') destino = 0;
                    else if (event.key === 'End') destino = TABS.length - 1;
                    else return;
                    event.preventDefault();
                    elegir(TABS[destino][0]);
                    tabRefs.current[destino]?.focus();
                  }}
                  className={`shrink-0 border-b-2 px-2.5 py-3.5 text-[11px] ${tab === key ? 'border-dorado font-semibold text-slate-900' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id={`panel-${tab}`}
              aria-labelledby={`tab-${tab}`}
              tabIndex={0}
              className="p-3 sm:p-4"
            >
              {tab === 'resumen' && (
                <div className="grid items-start gap-3 min-[1400px]:grid-cols-[minmax(0,49fr)_minmax(0,51fr)]">
                  <div className="grid gap-3">
                    <Card titulo="Información general" icono="proyectos">
                      <Datos
                        filas={[
                          ['Autor principal', p.informacion.autorPrincipal],
                          ['Coautores', p.informacion.coautores.join(', ')],
                          ['Servicio', servicio(p)],
                          ['Colección', p.informacion.coleccion],
                          ['Tema central', p.informacion.tema],
                          ['Público objetivo', p.informacion.publico],
                          ['Posible título', p.informacion.posibleTitulo],
                          ...(p.informacion.titulo
                            ? [
                                ['Título registrado', p.informacion.titulo] as [
                                  string,
                                  ReactNode,
                                ],
                              ]
                            : []),
                          [
                            'Estado del proyecto',
                            <BadgeConsulta estado={p.estado}>
                              {ESTADOS_MACRO[p.estado]}
                            </BadgeConsulta>,
                          ],
                        ]}
                      />
                    </Card>
                    <Card
                      titulo="Últimas actualizaciones relevantes"
                      icono="actividad"
                      accion={
                        <button onClick={() => elegir('historial')}>
                          Ver todo
                        </button>
                      }
                    >
                      <Timeline eventos={p.eventos} />
                    </Card>
                  </div>
                  <div className="grid gap-3">
                    <Card titulo="Progreso por etapa" icono="proceso">
                      <div className="space-y-1.5">
                        {p.stages.map((s) => (
                          <div
                            key={s.key}
                            className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 text-[11px]"
                          >
                            <span className="text-slate-500">{s.label}</span>
                            {s.progress !== null ? (
                              <div className="flex items-center gap-2">
                                <div
                                  role="progressbar"
                                  aria-label="Completitud de ingreso RRPP"
                                  aria-valuenow={s.progress}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  title="Requisitos obligatorios completos / requisitos aplicables"
                                  className="h-1.5 min-w-8 flex-1 overflow-hidden rounded bg-slate-100"
                                >
                                  <div
                                    className={`h-full rounded ${s.progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                    style={{ width: `${s.progress}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-700">
                                  {s.progress}%
                                </span>
                              </div>
                            ) : (
                              <div>
                                <BadgeConsulta estado={s.estado} compacto>
                                  {s.registrado && !s.instancias
                                    ? s.registrado
                                    : ESTADOS_ETAPA[s.estado]}
                                </BadgeConsulta>
                                {s.bloqueadas > 0 &&
                                  s.estado === 'en_progreso' && (
                                    <span className="ml-1 text-[9px] text-amber-700">
                                      {s.bloqueadas} bloqueada(s)
                                    </span>
                                  )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-[9px] leading-3 text-slate-400">
                        Las etapas pueden avanzar en paralelo. El porcentaje
                        corresponde a los requisitos del ingreso.
                      </p>
                    </Card>
                    <Card titulo="Fechas clave" icono="calendario">
                      <Datos
                        filas={[
                          ['Fecha de ingreso', fecha(p.fechas.ingreso)],
                          ['Fin proyectado', fecha(p.fechas.proyectada)],
                          ...(p.fechas.deseadaAutor
                            ? [
                                [
                                  'Fecha deseada autor',
                                  fecha(p.fechas.deseadaAutor),
                                ] as [string, ReactNode],
                              ]
                            : []),
                          [
                            'Lanzamiento tentativo',
                            fecha(p.fechas.lanzamiento),
                          ],
                          [
                            'Última actividad',
                            p.fechas.ultimaActividad
                              ? fechaActividad(p.fechas.ultimaActividad)
                              : 'Sin registro',
                          ],
                        ]}
                      />
                    </Card>
                    <Card titulo="Acciones rápidas" icono="rapido">
                      <div className="flex flex-wrap gap-2">
                        <Link to={fichaHref} className={boton}>
                          Ver ficha completa
                        </Link>
                        <button
                          onClick={() => elegir('historial')}
                          className={boton}
                        >
                          Ver historial
                        </button>
                        {p.abrirIngreso && (
                          <Link
                            to={ingresoHref}
                            className={`${boton} !border-slate-900 !bg-slate-900 !text-white`}
                          >
                            Abrir ingreso
                          </Link>
                        )}
                      </div>
                    </Card>
                  </div>
                </div>
              )}
              {tab === 'comercial' && (
                <Card titulo="Contexto comercial" icono="ingreso">
                  <p className="mb-4 text-xs text-slate-500">
                    Los cambios guardados por Comercial se reflejan aquí al
                    actualizar la consulta.
                  </p>
                  {p.contexto ? (
                    <Datos
                      filas={[
                        ['Autor principal', p.contexto.autorPrincipal],
                        ['Coautores', p.contexto.coautores.join(', ')],
                        ['Servicio', servicio(p)],
                        ['Fecha de ingreso', fecha(p.contexto.fechaIngreso)],
                        ['Ejecución', p.contexto.ejecucion],
                        ['Express (meses)', p.contexto.tiempoExpresMeses],
                        [
                          'Alianza comercial',
                          p.contexto.alianza === null
                            ? null
                            : p.contexto.alianza
                              ? 'Sí'
                              : 'No',
                        ],
                        ['Presupuesto', p.contexto.presupuesto],
                        ['Capítulos pactados', p.contexto.capitulos],
                        ['Páginas pactadas', p.contexto.paginas],
                        [
                          'Condiciones especiales',
                          p.contexto.condiciones?.join(', '),
                        ],
                        ['Criterio extra', p.contexto.criterioExtra],
                        ['Observaciones comerciales', p.contexto.observaciones],
                      ]}
                    />
                  ) : (
                    <p className="text-xs text-slate-500">
                      No hay ficha comercial registrada.
                    </p>
                  )}
                </Card>
              )}
              {tab === 'diagnostico' && (
                <Card
                  titulo="Diagnóstico RRPP"
                  icono="proceso"
                  accion={
                    p.abrirIngreso && (
                      <Link to={ingresoHref}>Abrir ingreso ↗</Link>
                    )
                  }
                >
                  {p.diagnostico ? (
                    <>
                      <Datos
                        filas={[
                          ...(p.servicio.codigo === 'CR'
                            ? [
                                [
                                  'Clasificación Crudo',
                                  p.subtipoCrudo ??
                                    'Pendiente de clasificación',
                                ] as [string, ReactNode],
                              ]
                            : []),
                          ['Colección', p.informacion.coleccion],
                          ['Tema central', p.informacion.tema],
                          ['Público objetivo', p.informacion.publico],
                          [
                            'Tono y estilo',
                            String(p.diagnostico.tonoEstilo ?? ''),
                          ],
                          ['Posible título', p.informacion.posibleTitulo],
                          [
                            'Fecha deseada',
                            fecha(
                              String(
                                p.diagnostico.fechaDeseadaCulminacion ?? '',
                              ) || null,
                            ),
                          ],
                          [
                            'Propósito social',
                            String(p.diagnostico.propositoSocial ?? ''),
                          ],
                          [
                            'Objetivo comercial',
                            Array.isArray(p.diagnostico.objetivoComercial)
                              ? p.diagnostico.objetivoComercial.join(', ')
                              : null,
                          ],
                          [
                            'Diagnóstico generado',
                            p.diagnostico.matrizDiagnosticoGenerado
                              ? 'Sí'
                              : 'No',
                          ],
                          [
                            'Ingreso generado',
                            p.diagnostico.matrizIngresoGenerado ? 'Sí' : 'No',
                          ],
                          [
                            'Observaciones RRPP',
                            String(
                              p.diagnostico.matrizObservacionesComerciales ??
                                '',
                            ),
                          ],
                        ]}
                      />
                      {p.preparacion && (
                        <p className="mt-4 text-xs text-slate-500">
                          {p.preparacion.listoParaJefatura
                            ? 'Requisitos del diagnóstico completos.'
                            : `Requisitos pendientes: ${p.preparacion.faltantes.map((f) => f.etiqueta).join(' · ')}`}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No hay diagnóstico RRPP registrado.
                    </p>
                  )}
                </Card>
              )}
              {tab === 'creativa' && (
                <div className="grid gap-3">
                  <Card titulo="Dirección Creativa" icono="conceptos">
                    {p.creativa.intervenciones.length ? (
                      p.creativa.intervenciones.map((d) => (
                        <div key={d.id} className="mb-4 last:mb-0">
                          <Datos
                            filas={[
                              [
                                'Intervención',
                                d.tipo === 'concepto_portada'
                                  ? 'Concepto de portada'
                                  : d.tipo === 'revision_cubierta'
                                    ? 'Revisión de cubierta'
                                    : d.tipo,
                              ],
                              [
                                'Estado',
                                ESTADOS_ETAPA[d.estado ?? ''] ??
                                  'Sin estado registrado',
                              ],
                              ['Reunión creativa', fecha(d.fechaReunion)],
                              ['Fecha de cierre', fecha(d.fechaCierre)],
                              ['Resultado', d.resultado],
                            ]}
                          />
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">
                        No hay intervenciones creativas registradas.
                      </p>
                    )}
                  </Card>
                  {p.creativa.revision.map((g) => (
                    <button
                      key={g.direccionId}
                      onClick={() =>
                        setRevision({
                          ...g,
                          actualizadoAt: p.actualizadoAt ?? '',
                          proyecto: {
                            id: p.id,
                            codigo: p.codigo,
                            nombre: p.nombre,
                            autores: [
                              { nombre: p.informacion.autorPrincipal },
                              ...p.informacion.coautores.map((nombre) => ({
                                nombre,
                              })),
                            ],
                            servicio: p.servicio,
                            subtipoCrudo: p.subtipoCrudo,
                          },
                        })
                      }
                      className={`${boton} !border-dorado !bg-amber-50 !text-amber-800`}
                    >
                      Revisar conceptos · {g.propuestas.length} pendiente(s)
                    </button>
                  ))}
                  <Card titulo="Conceptos de portada" icono="conceptos">
                    {p.creativa.propuestas.length ? (
                      <div className="space-y-4">
                        {p.creativa.propuestas.map((pr, i) => (
                          <div
                            key={pr.id}
                            className="border-b border-slate-100 pb-3 last:border-0"
                          >
                            <h4 className="text-xs font-semibold text-slate-900">
                              Propuesta {i + 1}
                            </h4>
                            <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">
                              {pr.descripcion ?? 'Sin descripción'}
                            </p>
                            <p className="mt-2 text-[11px] text-slate-500">
                              {pr.fechaAutor
                                ? `Aprobada por el autor · ${fecha(pr.fechaAutor)}`
                                : pr.fechaRrpp
                                  ? `Aprobada por RRPP · ${fecha(pr.fechaRrpp)}`
                                  : (pr.estado ?? 'Sin decisión registrada')}
                            </p>
                            {pr.enlace && (
                              <a
                                href={pr.enlace}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-block text-xs text-blue-600 underline"
                              >
                                Ver propuesta ↗
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        No hay conceptos de portada registrados.
                      </p>
                    )}
                  </Card>
                </div>
              )}
              {tab === 'produccion' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {p.stages
                    .filter((s) =>
                      ['edicion', 'correccion', 'diseno', 'calidad'].includes(
                        s.key,
                      ),
                    )
                    .map((s) => (
                      <Card key={s.key} titulo={s.label} icono="proceso">
                        <Datos
                          filas={[
                            [
                              'Estado',
                              <BadgeConsulta estado={s.estado}>
                                {s.registrado && !s.instancias
                                  ? s.registrado
                                  : ESTADOS_ETAPA[s.estado]}
                              </BadgeConsulta>,
                            ],
                            [
                              'Responsable',
                              s.responsables.length
                                ? s.responsables.join(', ')
                                : s.key === 'calidad' && s.activas
                                  ? 'Equipo de soporte editorial'
                                  : 'Sin asignación registrada',
                            ],
                            ['Trabajo abierto', s.activas],
                            ['Vencimiento', vencimiento(s.dueAt)],
                            [
                              'Última actividad',
                              s.ultimaActividad
                                ? fechaActividad(s.ultimaActividad)
                                : 'Sin registro',
                            ],
                            ...(s.key === 'edicion'
                              ? [
                                  [
                                    'Capítulos registrados',
                                    p.produccion.capitulos.cantidad,
                                  ] as [string, ReactNode],
                                  [
                                    'Entregados por editor',
                                    p.produccion.capitulos.entregados,
                                  ] as [string, ReactNode],
                                ]
                              : []),
                          ]}
                        />
                      </Card>
                    ))}
                </div>
              )}
              {tab === 'lanzamiento' && (
                <Card
                  titulo="Lanzamiento y promoción"
                  icono="lanzamiento"
                  accion={
                    p.lanzamiento && (
                      <Link to={`${fichaHref}#lanzamiento`}>
                        Abrir gestión ↗
                      </Link>
                    )
                  }
                >
                  {p.lanzamiento ? (
                    <>
                      <Datos
                        filas={[
                          ['Estado registrado', p.lanzamiento.estatus],
                          [
                            'Primera reunión',
                            fecha(p.lanzamiento.primeraReunion),
                          ],
                          ['Puntos tratados', p.lanzamiento.puntosPrimera],
                          [
                            'Segunda reunión',
                            fecha(p.lanzamiento.segundaReunion),
                          ],
                          ['Acuerdos', p.lanzamiento.acuerdosSegunda],
                          ['Fecha tentativa', fecha(p.fechas.lanzamiento)],
                          ['Tipo de lanzamiento', p.lanzamiento.tipo],
                          ['Objetivo comercial', p.lanzamiento.objetivo],
                          ['Participación en ferias', p.lanzamiento.ferias],
                          ['Observaciones', p.lanzamiento.observaciones],
                        ]}
                      />
                      <div className="mt-5">
                        <h4 className="mb-3 text-xs font-semibold text-slate-900">
                          Reuniones registradas
                        </h4>
                        {p.lanzamiento.reuniones.length ? (
                          p.lanzamiento.reuniones.map((r) => (
                            <div
                              key={r.id}
                              className="mb-3 rounded-lg border border-slate-100 p-3"
                            >
                              <Datos
                                filas={[
                                  ['Fecha', fecha(r.fecha)],
                                  ['Puntos tratados', r.puntos],
                                  ['Acuerdos', r.acuerdos],
                                ]}
                              />
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-500">
                            No hay reuniones adicionales registradas.
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No hay información de lanzamiento registrada.
                    </p>
                  )}
                </Card>
              )}
              {tab === 'historial' && <Historial id={id} />}
            </div>
            {aviso && (
              <p role="status" className="px-5 pb-4 text-xs text-emerald-700">
                {aviso}
              </p>
            )}
            {revision && (
              <ReviewConceptsModal
                grupo={revision}
                onClose={() => setRevision(null)}
                onGuardado={(mensaje) => {
                  setRevision(null);
                  setAviso(mensaje);
                  void query.refetch();
                }}
              />
            )}
          </>
        )
      )}
    </article>
  );
}
