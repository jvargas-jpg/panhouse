import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { formatearFecha, hoyISO } from '../proyectos/campos';
import { fetchProyectosActivos } from '../proyectos/proyectosApi';
import type { Pago, ProyectoResumen, Rol } from '../types/api';
import { fetchPagos, registrarPago, type DatosNuevoPago } from './pagosApi';
import { SelectorProyecto } from './SelectorProyecto';
import { Toast } from '../autores/Toast';

// Mismo breakout que AutoresPage.tsx/ProyectoDetallePage.tsx: la
// pantalla dividida (formulario + historial) necesita más ancho que la
// columna centrada de 896px que impone AppLayout.tsx.
const FULL_BLEED = 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen';

// Mismo estilo que CrearProyectoModalForm.tsx (Comercial): acentos
// dorado, no el LABEL_CLASS/INPUT_CLASS de proyectos/campos.tsx (ese es
// el de los paneles "Control" de la ficha, un contexto visual distinto).
const LABEL_CLASS = 'mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-wide text-gray-500';
const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40';

const METODOS_PAGO = ['Transferencia', 'Zelle', 'Tarjeta', 'Efectivo', 'Otro'] as const;

// Mismos roles que autorizan POST/GET /api/pagos en el backend (ver
// server/routes/pagos.routes.ts) — chequeo del lado del cliente para no
// mostrar un formulario que el servidor de todos modos va a rechazar.
const ROLES_PAGOS: Rol[] = ['comercial', 'rrpp', 'cobranzas', 'jefe_area'];

function BadgeEstatusPago({ estatus }: { estatus: string }) {
  const esVerificado = estatus.toLowerCase().includes('verificado') && !estatus.toLowerCase().includes('pendiente');
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        esVerificado ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {estatus}
    </span>
  );
}

function TarjetaPago({ pago }: { pago: Pago }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{pago.proyecto.titulo ?? pago.proyecto.autorNombre}</p>
          <p className="text-xs text-gray-500">
            {pago.proyecto.autorNombre} · {pago.proyecto.servicioCodigo}
          </p>
        </div>
        <BadgeEstatusPago estatus={pago.estatus} />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-gray-900">
          {pago.moneda} {Number(pago.monto).toLocaleString('es', { minimumFractionDigits: 2 })}
        </span>
        <span className="text-xs text-gray-500">{formatearFecha(pago.fechaPago)}</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {pago.metodoPago}
        {pago.referencia ? ` · Ref. ${pago.referencia}` : ''}
      </p>
      {pago.comprobanteUrl && (
        <a
          href={pago.comprobanteUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs font-medium text-dorado hover:underline"
        >
          Ver comprobante ↗
        </a>
      )}
    </div>
  );
}

// Módulo financiero de Comercial: registra abonos por proyecto y
// muestra el historial reciente. Estándar Clean SaaS, pantalla
// dividida — formulario a la izquierda, historial a la derecha.
export function RegistrarPagoPage() {
  const { data: usuario } = useMe();
  const tieneAcceso = Boolean(usuario && ROLES_PAGOS.includes(usuario.rol));

  const proyectosQuery = useQuery({ queryKey: ['proyectos', 'activos'], queryFn: fetchProyectosActivos, enabled: tieneAcceso });
  const pagosQuery = useQuery({ queryKey: ['pagos'], queryFn: () => fetchPagos(), enabled: tieneAcceso });
  const queryClient = useQueryClient();

  const [proyectoSeleccionado, setProyectoSeleccionado] = useState<ProyectoResumen | null>(null);
  const [monto, setMonto] = useState('');
  const [fechaPago, setFechaPago] = useState(hoyISO());
  const [metodoPago, setMetodoPago] = useState<(typeof METODOS_PAGO)[number]>('Transferencia');
  const [referencia, setReferencia] = useState('');
  const [comprobanteUrl, setComprobanteUrl] = useState('');
  const [toastMensaje, setToastMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMensaje) return;
    const id = setTimeout(() => setToastMensaje(null), 3000);
    return () => clearTimeout(id);
  }, [toastMensaje]);

  const mutacion = useMutation({
    mutationFn: () => {
      if (!proyectoSeleccionado) throw new Error('Selecciona un proyecto');
      const datos: DatosNuevoPago = {
        proyectoId: proyectoSeleccionado.id,
        monto,
        fechaPago,
        metodoPago,
        referencia: referencia || null,
        comprobanteUrl: comprobanteUrl || null,
      };
      return registrarPago(datos);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      setToastMensaje('Pago registrado exitosamente');
      setProyectoSeleccionado(null);
      setMonto('');
      setFechaPago(hoyISO());
      setMetodoPago('Transferencia');
      setReferencia('');
      setComprobanteUrl('');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  if (usuario && !tieneAcceso) {
    return (
      <div className={`${FULL_BLEED} mx-auto max-w-3xl px-6 py-16 text-center`}>
        <p className="text-sm text-gray-500">No tienes acceso al módulo de pagos.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-dorado hover:underline">
          ← Volver
        </Link>
      </div>
    );
  }

  return (
    <div className={`${FULL_BLEED} bg-[#F8F9FA]`}>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-900 hover:underline">
          ← Volver
        </Link>

        <h2 className="mb-8 mt-4 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <span className="h-2 w-2 rounded-full bg-dorado" /> Registrar Pago
        </h2>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Columna izquierda — formulario */}
          <div className="h-fit rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-1 text-base font-semibold text-gray-900">Nuevo pago</h3>
            <p className="mb-2 text-xs text-gray-500">Registra un abono recibido para un proyecto activo.</p>

            <form onSubmit={handleSubmit}>
              <label className={LABEL_CLASS}>Proyecto</label>
              <SelectorProyecto
                proyectos={proyectosQuery.data?.proyectos ?? []}
                proyectoSeleccionado={proyectoSeleccionado}
                onSeleccionar={setProyectoSeleccionado}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pago-monto" className={LABEL_CLASS}>
                    Monto (USD)
                  </label>
                  <input
                    id="pago-monto"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={monto}
                    onChange={(event) => setMonto(event.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor="pago-fecha" className={LABEL_CLASS}>
                    Fecha
                  </label>
                  <input
                    id="pago-fecha"
                    type="date"
                    required
                    value={fechaPago}
                    onChange={(event) => setFechaPago(event.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <label htmlFor="pago-metodo" className={LABEL_CLASS}>
                Método de pago
              </label>
              <select
                id="pago-metodo"
                value={metodoPago}
                onChange={(event) => setMetodoPago(event.target.value as (typeof METODOS_PAGO)[number])}
                className={INPUT_CLASS}
              >
                {METODOS_PAGO.map((metodo) => (
                  <option key={metodo} value={metodo}>
                    {metodo}
                  </option>
                ))}
              </select>

              <label htmlFor="pago-referencia" className={LABEL_CLASS}>
                Referencia (nº de recibo o transacción)
              </label>
              <input
                id="pago-referencia"
                type="text"
                value={referencia}
                onChange={(event) => setReferencia(event.target.value)}
                className={INPUT_CLASS}
              />

              {/* No hay almacenamiento de archivos en el backend (mismo
                  criterio que el resto del sistema: fichaDisenoPropuestas.enlace,
                  fichaCalidadFases.pdfUrl — todo por enlace, nunca upload
                  real) — el "botón para subir comprobante" es un campo de
                  enlace, no un <input type="file"> que no tendría a dónde
                  mandar el archivo. */}
              <label htmlFor="pago-comprobante" className={LABEL_CLASS}>
                Comprobante (enlace, opcional)
              </label>
              <input
                id="pago-comprobante"
                type="text"
                placeholder="https://…"
                value={comprobanteUrl}
                onChange={(event) => setComprobanteUrl(event.target.value)}
                className={INPUT_CLASS}
              />

              <button
                type="submit"
                disabled={!proyectoSeleccionado || !monto || mutacion.isPending}
                className="mt-8 w-full rounded-lg bg-tinta py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mutacion.isPending ? 'Guardando…' : 'Registrar Pago'}
              </button>
              {mutacion.isError && (
                <p role="alert" className="mt-3 text-sm text-red-600">
                  No se pudo registrar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
                </p>
              )}
            </form>
          </div>

          {/* Columna derecha — historial reciente */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-900">Historial reciente</h3>

            {pagosQuery.isLoading && <p className="text-sm text-gray-500">Cargando historial…</p>}
            {pagosQuery.isError && (
              <p role="alert" className="text-sm text-red-600">
                No se pudo cargar el historial{pagosQuery.error instanceof Error ? `: ${pagosQuery.error.message}` : ''}.
              </p>
            )}
            {pagosQuery.data && pagosQuery.data.pagos.length === 0 && (
              <p className="text-sm text-gray-500">Todavía no hay pagos registrados.</p>
            )}

            {pagosQuery.data && pagosQuery.data.pagos.length > 0 && (
              <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                {pagosQuery.data.pagos.map((pago) => (
                  <TarjetaPago key={pago.id} pago={pago} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {toastMensaje && <Toast mensaje={toastMensaje} />}
    </div>
  );
}
