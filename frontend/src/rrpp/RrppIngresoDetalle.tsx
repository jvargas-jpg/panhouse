import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../autores/Modal';
import { fechaActividad } from './RrppDashboardCards';
import { RrppIcon } from './RrppIcons';
import { iniciarDiagnostico } from './rrppDashboardApi';
import {
  ErrorIngreso,
  IngresoSkeleton,
  type BorradoresIngreso,
} from './RrppIngresosPage';
import {
  enviarIngreso,
  ESTADOS_INGRESO,
  fetchIngreso,
  guardarIngreso,
  type CatalogosIngreso,
  type DatosIngreso,
} from './rrppIngresosApi';

const INPUT =
  'w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 disabled:bg-slate-50 disabled:text-slate-500';
const BTN =
  'rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const TEXTOS = [
  [
    'publicoPerfil',
    'Público objetivo',
    'Jóvenes adultos, profesionales, público general…',
  ],
  ['temaGeneral', 'Tema central', 'Desarrollo personal, historia, negocios…'],
  ['tonoEstilo', 'Tono y estilo', 'Cercano, académico, divulgativo…'],
  ['posibleTituloLibro', 'Posible título', 'Ingresa un posible título'],
] as const;
const ADICIONALES = [
  ['matrizCiudadResidencia', 'Ciudad de residencia', 'text'],
  ['matrizLinkResumen', 'Enlace al resumen / minuta', 'text'],
  ['matrizLinkDiagnostico', 'Enlace al diagnóstico', 'text'],
  ['matrizFechaReunionCreativa', 'Fecha de reunión creativa', 'date'],
] as const;
export function RrppIngresoDetalle({
  id,
  catalogos,
  borradores,
}: {
  id: string;
  catalogos?: CatalogosIngreso;
  borradores: BorradoresIngreso;
}) {
  const cliente = useQueryClient();
  const query = useQuery({
    queryKey: ['rrpp', 'ingreso', id],
    queryFn: () => fetchIngreso(id),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const [datos, setDatos] = useState<DatosIngreso | null>(
    borradores.get(id)?.datos ?? null,
  );
  const base = useRef(borradores.get(id)?.base ?? '');
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      query.data &&
      window.matchMedia('(min-width: 768px) and (max-width: 1199px)').matches
    ) {
      panel.current?.scrollIntoView({ block: 'start' });
    }
  }, [query.data?.id, !!datos]);
  const [confirmacion, setConfirmacion] = useState(false);
  const [aviso, setAviso] = useState('');
  const lock = useRef(false);
  const dirty = datos !== null && JSON.stringify(datos) !== base.current;
  useEffect(() => {
    if (!query.data) return;
    // Refocus actualiza el contexto, pero nunca pisa un borrador propio pendiente.
    if (!datos || JSON.stringify(datos) === base.current) {
      base.current = JSON.stringify(query.data.datos);
      setDatos(query.data.datos);
      borradores.set(id, { datos: query.data.datos, base: base.current });
    }
  }, [query.data]);
  function campo(clave: string, valor: DatosIngreso[string]) {
    if (!datos) return;
    const nuevo = { ...datos, [clave]: valor };
    setDatos(nuevo);
    borradores.set(id, { datos: nuevo, base: base.current });
    setAviso('');
  }
  async function invalidar() {
    await Promise.all(
      [
        ['rrpp'],
        ['ficha', id],
        ['proyecto', id],
        ['fichas-trazabilidad', 'enviados-a-rrpp'],
      ].map((queryKey) => cliente.invalidateQueries({ queryKey })),
    );
  }
  const guardar = useMutation({
    mutationFn: (payload: DatosIngreso) => guardarIngreso(id, payload),
    onSuccess: async (respuesta) => {
      base.current = JSON.stringify(respuesta.datos);
      setDatos(respuesta.datos);
      borradores.set(id, { datos: respuesta.datos, base: base.current });
      cliente.setQueryData(['rrpp', 'ingreso', id], respuesta);
      setAviso('Cambios guardados.');
      await invalidar();
    },
  });
  const iniciar = useMutation({
    mutationFn: () => iniciarDiagnostico(id),
    onSuccess: async () => {
      setAviso('Diagnóstico iniciado.');
      await invalidar();
    },
  });
  const enviar = useMutation({
    mutationFn: () => enviarIngreso(id),
    onSuccess: async () => {
      setConfirmacion(false);
      setAviso('Proyecto enviado a Jefatura.');
      borradores.delete(id);
      await invalidar();
    },
    onError: async () => {
      await invalidar();
    },
  });
  const ocupado = guardar.isPending || iniciar.isPending || enviar.isPending;
  async function accion(tipo: 'guardar' | 'iniciar' | 'enviar') {
    if (lock.current || ocupado) return;
    lock.current = true;
    try {
      if (tipo === 'guardar' && datos) await guardar.mutateAsync({ ...datos });
      else if (tipo === 'iniciar') await iniciar.mutateAsync();
      else if (
        tipo === 'enviar' &&
        !dirty &&
        query.data?.preparacion.listoParaJefatura &&
        query.data.editable
      )
        await enviar.mutateAsync();
    } catch {
      /* El error local conserva los datos. */
    } finally {
      lock.current = false;
    }
  }
  if (query.isPending || (!datos && !query.isError))
    return <IngresoSkeleton detalle />;
  if (query.isError && !query.data)
    return (
      <ErrorIngreso
        error={query.error}
        reintentar={() => {
          void query.refetch();
        }}
      />
    );
  const i = query.data;
  if (!i || !datos) return null;
  const c = i.contexto;
  const estado = ESTADOS_INGRESO[i.estado];
  const disabled = !i.editable || ocupado;
  const texto = (clave: string) =>
    typeof datos[clave] === 'string' ? (datos[clave] as string) : '';
  const etiqueta = (
    clave: string,
    nombre: string,
    tipo = 'text',
    placeholder?: string,
  ) => (
    <label
      className="block min-w-0 text-xs font-medium text-slate-700"
      key={clave}
    >
      {nombre}
      <input
        type={tipo}
        value={texto(clave)}
        onChange={(e) => campo(clave, e.target.value || null)}
        disabled={disabled}
        placeholder={placeholder}
        className={`${INPUT} mt-1.5`}
      />
    </label>
  );
  const select = (clave: string, nombre: string, opciones: string[] = []) => (
    <label
      className="block min-w-0 text-xs font-medium text-slate-700"
      key={clave}
    >
      {nombre}
      <select
        value={texto(clave)}
        onChange={(e) => campo(clave, e.target.value || null)}
        disabled={disabled || !catalogos}
        className={`${INPUT} mt-1.5`}
      >
        <option value="">Selecciona {nombre.toLocaleLowerCase()}</option>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
  const contexto = [
    ['Autor principal', c.autorPrincipal],
    ...(c.coautores.length ? [['Coautores', c.coautores.join(', ')]] : []),
    ['Servicio', `${i.servicio.codigo} — ${i.servicio.nombre}`],
    ['Fecha de ingreso', c.fechaIngreso],
    [
      'Ejecución',
      `${c.ejecucion}${c.ejecucion === 'Express' && c.tiempoExpresMeses ? ` · ${c.tiempoExpresMeses} meses` : ''}`,
    ],
    ['Alianza comercial', c.alianza ? 'Sí' : 'No'],
    ['Presupuesto', c.presupuesto],
    ['Capítulos pactados', c.capitulos],
    ['Páginas pactadas', c.paginas],
  ];
  return (
    <div
      ref={panel}
      className="relative rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-bold tracking-tight text-slate-950">
              {i.nombre} —{' '}
              <span className="whitespace-nowrap">#{i.codigo}</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {i.servicio.codigo} — {i.servicio.nombre}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${estado.color}`}
            >
              {estado.nombre}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] text-slate-600">
              ↻ Sincronizado con Comercial
            </span>
          </div>
        </div>
        {i.estado === 'enviado' && (
          <p className="mt-3 text-xs text-slate-500">
            Enviado a Jefatura
            {i.enviadoAt
              ? ` · ${new Date(i.enviadoAt).toLocaleString('es')}`
              : ' · Fecha de envío no registrada'}
            . Disponible para consulta.
          </p>
        )}
        <section className="mt-5 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
              <RrppIcon nombre="ingreso" className="h-5 w-5" />
              Contexto Comercial
            </h3>
            <p className="text-[11px] leading-5 text-slate-500">
              Los cambios guardados por Comercial se reflejan automáticamente
              aquí.
            </p>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl bg-slate-50 p-4 min-[700px]:grid-cols-2">
            {contexto.map(([nombre, valor]) => (
              <div
                key={nombre}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 text-[11px] leading-5"
              >
                <dt className="font-medium text-slate-700">{nombre}</dt>
                <dd className="break-words text-slate-600">
                  {valor || 'Sin registrar'}
                </dd>
              </div>
            ))}
            {[
              [
                'Condiciones adicionales',
                [c.condiciones?.join(', '), c.criterioExtra]
                  .filter(Boolean)
                  .join(' · '),
              ],
              ['Observaciones comerciales', c.observaciones],
            ]
              .filter(([, valor]) => valor)
              .map(([nombre, valor]) => (
                <div key={nombre} className="min-w-0 min-[700px]:col-span-2">
                  <dt className="text-[11px] font-medium text-slate-700">
                    {nombre}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">
                    {valor}
                  </dd>
                </div>
              ))}
          </dl>
        </section>
        <section className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
            <RrppIcon nombre="proceso" className="h-5 w-5" />
            Diagnóstico RRPP
          </h3>
          {i.estado === 'nuevo' && i.editable && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 p-3">
              <p className="text-xs text-amber-800">
                Proyecto recibido. Inicia el diagnóstico para registrar el
                trabajo del equipo.
              </p>
              <button
                disabled={ocupado}
                onClick={() => {
                  void accion('iniciar');
                }}
                className={`${BTN} border-amber-400 bg-amber-400 text-slate-900`}
              >
                {iniciar.isPending ? 'Iniciando…' : 'Iniciar diagnóstico'}
              </button>
            </div>
          )}
          <div className="mt-4 grid items-start gap-4 min-[1500px]:grid-cols-[minmax(0,1fr)_210px]">
            <fieldset
              disabled={disabled}
              className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2"
            >
              {i.servicio.codigo === 'CR' && (
                <div>
                  {select(
                    'ingresoServicioSubtipoCrudo',
                    'Subtipo de crudo',
                    catalogos?.subtiposCrudo,
                  )}
                  <p className="mt-1 text-[10px] leading-4 text-slate-400">
                    Definido por RRPP según el contenido recibido.
                  </p>
                </div>
              )}
              {select('coleccionPanhouse', 'Colección', catalogos?.colecciones)}
              {TEXTOS.map(([clave, nombre, ejemplo]) =>
                etiqueta(clave, nombre, 'text', ejemplo),
              )}
              {select('publicoSexo', 'Público · sexo', catalogos?.publicosSexo)}
              {etiqueta(
                'publicoEdad',
                'Público · rango de edad',
                'text',
                'Ej. 18 a 35 años',
              )}
              {etiqueta(
                'propositoSocial',
                'Propósito social',
                'text',
                'Aporte del libro a su comunidad',
              )}
              <label className="min-w-0 text-xs font-medium text-slate-700">
                Objetivos comerciales
                <textarea
                  disabled={disabled}
                  value={
                    Array.isArray(datos.objetivoComercial)
                      ? datos.objetivoComercial.join('\n')
                      : ''
                  }
                  onChange={(e) =>
                    campo('objetivoComercial', e.target.value.split('\n'))
                  }
                  placeholder="Un objetivo por línea"
                  rows={2}
                  className={`${INPUT} mt-1.5 resize-y`}
                />
              </label>
              {etiqueta(
                'fechaDeseadaCulminacion',
                'Fecha deseada de culminación',
                'date',
              )}
              <div className="min-w-0 text-xs">
                <p className="font-medium text-slate-700">
                  Fecha proyectada de cierre
                </p>
                <p className="mt-2 text-slate-500">
                  {i.fechaProyectada ??
                    'Pendiente de clasificación / fecha de ingreso'}
                </p>
                {dirty && (
                  <p className="mt-1 text-[10px] text-amber-700">
                    Se actualiza al guardar.
                  </p>
                )}
              </div>
            </fieldset>
            <aside
              className={`rounded-xl p-4 ${i.preparacion.listoParaJefatura ? 'bg-green-50' : 'bg-amber-50/80'}`}
            >
              <h4
                className={`text-xs font-semibold ${i.preparacion.listoParaJefatura ? 'text-green-700' : 'text-amber-700'}`}
              >
                {i.preparacion.listoParaJefatura
                  ? '✓ Pendientes resueltos'
                  : '⚠ Pendientes para completar'}
              </h4>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                {i.estado === 'enviado'
                  ? 'Handoff registrado.'
                  : 'Completa y guarda el diagnóstico para poder enviar a Jefatura.'}
              </p>
              <ul className="mt-3 space-y-3">
                {i.preparacion.checklist.map((p) => (
                  <li
                    key={p.campo}
                    className={`flex items-start gap-2 text-[11px] leading-4 ${p.completo ? 'text-slate-400' : 'text-slate-700'}`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${p.completo ? 'border-green-500 bg-green-500 text-white' : 'border-amber-500'}`}
                    >
                      {p.completo && '✓'}
                    </span>
                    <span className={p.completo ? 'line-through' : ''}>
                      {p.etiqueta}
                    </span>
                  </li>
                ))}
              </ul>
              {dirty && (
                <p className="mt-3 text-[10px] text-amber-700">
                  El progreso corresponde al último guardado.
                </p>
              )}
            </aside>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <h4 className="text-xs font-semibold text-slate-800">
              Documentos de ingreso
            </h4>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
              {[
                ['matrizDiagnosticoGenerado', 'Diagnóstico generado'],
                ['matrizIngresoGenerado', 'Documento de ingreso generado'],
                ['matrizBienvenidaGenerada', 'Bienvenida generada'],
                ['matrizContratoFirmado', 'Contrato firmado'],
              ].map(([clave, nombre]) => (
                <label
                  key={clave}
                  className="flex items-center gap-2 text-xs text-slate-600"
                >
                  <input
                    disabled={disabled}
                    type="checkbox"
                    checked={datos[clave] === true}
                    onChange={(e) => campo(clave, e.target.checked)}
                    className="h-4 w-4 accent-amber-500"
                  />
                  {nombre}
                </label>
              ))}
            </div>
          </div>
          <details className="mt-4 rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700">
              Seguimiento y especificaciones de ingreso
            </summary>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {ADICIONALES.map(([clave, nombre, tipo]) =>
                etiqueta(clave, nombre, tipo),
              )}
              {select(
                'matrizEstadoReunion',
                'Estado de reunión',
                catalogos?.estadosReunion,
              )}
              {select(
                'matrizPropietario',
                'Responsable del ingreso',
                catalogos?.propietarios,
              )}
              <label className="min-w-0 text-xs font-medium text-slate-700 sm:col-span-2">
                Venta cruzada
                <textarea
                  disabled={disabled}
                  value={
                    Array.isArray(datos.matrizVentaCruzada)
                      ? datos.matrizVentaCruzada.join('\n')
                      : ''
                  }
                  onChange={(e) =>
                    campo('matrizVentaCruzada', e.target.value.split('\n'))
                  }
                  placeholder="Una oportunidad por línea"
                  rows={2}
                  className={`${INPUT} mt-1.5 resize-y`}
                />
              </label>
            </div>
          </details>
          <label className="mt-4 block text-xs font-medium text-slate-700">
            Observaciones RRPP
            <textarea
              value={texto('matrizObservacionesComerciales')}
              onChange={(e) =>
                campo('matrizObservacionesComerciales', e.target.value || null)
              }
              disabled={disabled}
              rows={3}
              placeholder="Agrega notas o consideraciones del diagnóstico para Jefatura…"
              className={`${INPUT} mt-1.5 resize-y`}
            />
          </label>
        </section>
        {query.isError && (
          <div className="mt-4">
            <ErrorIngreso
              error={query.error}
              reintentar={() => {
                void query.refetch();
              }}
            />
          </div>
        )}
        {(guardar.error || iniciar.error) && (
          <p role="alert" className="mt-3 text-xs text-red-700">
            {(guardar.error ?? iniciar.error)?.message}. Puedes reintentar la
            acción.
          </p>
        )}
        {aviso && (
          <p role="status" className="mt-3 text-xs text-green-700">
            {aviso}
          </p>
        )}
        <Link
          to={`/proyectos/${id}/ficha-trazabilidad`}
          className="mt-4 inline-block text-xs text-slate-500 underline"
        >
          Consultar ficha completa
        </Link>
      </div>
      <footer className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-slate-200 bg-white/95 px-5 py-3 shadow-[0_-3px_10px_rgba(15,23,42,0.03)] backdrop-blur sm:px-6">
        <p className="flex items-center gap-2 text-[11px] text-slate-500">
          <RrppIcon nombre="actividad" className="h-4 w-4" />
          {dirty
            ? 'Cambios sin guardar'
            : i.guardadoAt
              ? `Último guardado ${fechaActividad(i.guardadoAt)}`
              : 'Sin guardados RRPP registrados'}
        </p>
        <div className="flex flex-wrap gap-2">
          {i.editable && (
            <button
              disabled={!dirty || ocupado}
              onClick={() => {
                void accion('guardar');
              }}
              className={`${BTN} border-slate-300 bg-white text-slate-900 hover:bg-slate-50`}
            >
              {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          )}
          {i.editable && i.preparacion.listoParaJefatura && (
            <button
              disabled={dirty || ocupado}
              onClick={() => setConfirmacion(true)}
              className={`${BTN} border-amber-400 bg-amber-400 text-slate-900 hover:bg-amber-500`}
            >
              Enviar a Jefatura
            </button>
          )}
        </div>
      </footer>
      {confirmacion && (
        <Modal
          titulo="Enviar proyecto a Jefatura"
          onClose={() => {
            if (!enviar.isPending) setConfirmacion(false);
          }}
        >
          <div className="p-6">
            <p className="text-sm leading-6 text-slate-600">
              Jefatura recibirá el proyecto para revisar la carga del equipo y
              asignar un Especialista.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Después del envío, RRPP podrá seguir consultando la información
              correspondiente a su área.
            </p>
            {enviar.error && (
              <p role="alert" className="mt-3 text-xs text-red-700">
                {enviar.error.message}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                disabled={enviar.isPending}
                onClick={() => setConfirmacion(false)}
                className={`${BTN} border-slate-300`}
              >
                Cancelar
              </button>
              <button
                disabled={
                  ocupado ||
                  dirty ||
                  !i.preparacion.listoParaJefatura ||
                  !i.editable
                }
                onClick={() => {
                  void accion('enviar');
                }}
                className={`${BTN} border-amber-400 bg-amber-400`}
              >
                {enviar.isPending ? 'Enviando…' : 'Confirmar envío'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
