import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { formatearFecha } from '../proyectos/campos';
import { Modal } from '../autores/Modal';
import { fetchPagos, verificarPago, type DatosVerificacionPago } from '../comercial/pagosApi';
import type { Pago } from '../types/api';

// Mismo breakout que AutoresPage.tsx/MisProyectosPage.tsx: el layout
// con sidebar necesita el ancho real de la pantalla.
const FULL_BLEED = 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen -my-6';
const ALTO_SIDEBAR = 'h-[calc(100vh-59px)]';

const NAV_ACTIVO =
  'w-full flex items-center gap-3 px-4 py-3 bg-dorado/10 text-dorado rounded-xl font-semibold text-sm border border-dorado/20 transition-all text-left';

type FiltroPagos = 'pendientes' | 'todos';

const PENDIENTE = 'Pendiente de verificación';

function BadgeEstatusPago({ estatus }: { estatus: string }) {
  if (estatus === 'Verificado') {
    return <span className="whitespace-nowrap rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">Verificado</span>;
  }
  if (estatus === 'Rechazado') {
    return <span className="whitespace-nowrap rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">Rechazado</span>;
  }
  return <span className="whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">{estatus}</span>;
}

function FilaPago({
  pago,
  onAprobar,
  onRechazar,
  procesando,
}: {
  pago: Pago;
  onAprobar: (pago: Pago) => void;
  onRechazar: (pago: Pago) => void;
  procesando: boolean;
}) {
  return (
    <tr className="border-b border-gray-100 text-sm text-gray-700 transition-colors last:border-0 hover:bg-gray-50">
      <td className="whitespace-nowrap px-4 py-3">{formatearFecha(pago.fechaPago)}</td>
      <td className="px-4 py-3">
        <p className="font-semibold text-gray-900">{pago.proyecto.titulo ?? pago.proyecto.autorNombre}</p>
        <p className="font-mono text-xs text-gray-400">
          {pago.proyectoId.slice(0, 8)}… · {pago.proyecto.servicioCodigo}
        </p>
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">
        {pago.moneda} {Number(pago.monto).toLocaleString('es', { minimumFractionDigits: 2 })}
      </td>
      <td className="whitespace-nowrap px-4 py-3">{pago.metodoPago}</td>
      <td className="whitespace-nowrap px-4 py-3">{pago.referencia ?? <span className="text-gray-400">—</span>}</td>
      <td className="whitespace-nowrap px-4 py-3">
        {pago.comprobanteUrl ? (
          <a href={pago.comprobanteUrl} target="_blank" rel="noreferrer" className="font-medium text-dorado hover:underline">
            Ver ↗
          </a>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <BadgeEstatusPago estatus={pago.estatus} />
        {pago.estatus === 'Rechazado' && pago.motivoRechazo && (
          <p className="mt-1 max-w-[180px] truncate text-xs text-gray-400" title={pago.motivoRechazo}>
            {pago.motivoRechazo}
          </p>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        {pago.estatus === PENDIENTE ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={procesando}
              onClick={() => onAprobar(pago)}
              className="text-xs font-semibold text-green-700 transition-colors hover:text-green-900 disabled:opacity-50"
            >
              ✔ Aprobar
            </button>
            <button
              type="button"
              disabled={procesando}
              onClick={() => onRechazar(pago)}
              className="text-xs font-semibold text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
            >
              ✖ Rechazar
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
    </tr>
  );
}

// Panel del rol cobranzas: cierra el ciclo de vida del pago abierto en
// RegistrarPagoPage.tsx (Comercial). Mismo patrón de sidebar oscuro,
// un único módulo por ahora ("Auditoría de Pagos" siempre activo) — sin
// vistaActiva/useState de navegación como en MisProyectosPage.tsx
// porque todavía no hay un segundo módulo con el que alternar.
export function AuditoriaPagosPage() {
  const [filtro, setFiltro] = useState<FiltroPagos>('pendientes');
  const [pagoRechazando, setPagoRechazando] = useState<Pago | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  const pagosQuery = useQuery({ queryKey: ['pagos'], queryFn: () => fetchPagos() });
  const queryClient = useQueryClient();

  const mutacionVerificar = useMutation({
    mutationFn: (params: { id: string; datos: DatosVerificacionPago }) => verificarPago(params.id, params.datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      setPagoRechazando(null);
      setMotivoRechazo('');
    },
  });

  function aprobar(pago: Pago) {
    mutacionVerificar.mutate({ id: pago.id, datos: { estatus: 'Verificado' } });
  }

  function confirmarRechazo(event: FormEvent) {
    event.preventDefault();
    if (!pagoRechazando) return;
    mutacionVerificar.mutate({ id: pagoRechazando.id, datos: { estatus: 'Rechazado', motivoRechazo } });
  }

  const pagos = pagosQuery.data?.pagos ?? [];
  const pendientes = pagos.filter((pago) => pago.estatus === PENDIENTE);
  const pagosVisibles = filtro === 'pendientes' ? pendientes : pagos;

  const estaProcesando = (pagoId: string) => mutacionVerificar.isPending && mutacionVerificar.variables?.id === pagoId;

  return (
    <div className={`${FULL_BLEED} ${ALTO_SIDEBAR} flex overflow-hidden bg-[#F8F9FA]`}>
      <aside className="z-20 hidden w-64 flex-shrink-0 flex-col border-r border-gray-800 bg-gray-900 shadow-xl md:flex">
        <div className="px-6 py-8">
          <p className="mb-6 text-xs font-bold uppercase tracking-widest text-gray-500">Panel Financiero</p>
          <nav className="space-y-2">
            <button type="button" className={NAV_ACTIVO}>
              <span className="h-1.5 w-1.5 rounded-full bg-dorado" />
              Auditoría de Pagos
            </button>
          </nav>
        </div>
      </aside>

      {/* AppLayout.tsx ya envuelve el Outlet en un <main> — mismo criterio
          que AutoresPage.tsx/MisProyectosPage.tsx: <div>, no <main>.
          overflow-x-auto (no -hidden, a diferencia de esas dos páginas):
          la tabla de auditoría es más ancha que el viewport en pantallas
          angostas y necesita poder desplazarse, no recortarse. */}
      <div className="flex-1 overflow-y-auto overflow-x-auto bg-[#F4F5F8]">
        <div className="mx-auto max-w-7xl p-6">
          <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900">
            <span className="h-2 w-2 rounded-full bg-dorado" /> Auditoría de Pagos
          </h2>

          <div className="mb-4 inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setFiltro('pendientes')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                filtro === 'pendientes' ? 'bg-tinta text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Pendientes {pendientes.length > 0 && `(${pendientes.length})`}
            </button>
            <button
              type="button"
              onClick={() => setFiltro('todos')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                filtro === 'todos' ? 'bg-tinta text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Historial / Todos
            </button>
          </div>

          {pagosQuery.isLoading && <p className="text-sm text-gray-500">Cargando pagos…</p>}
          {pagosQuery.isError && (
            <p role="alert" className="text-sm text-red-600">
              No se pudieron cargar los pagos{pagosQuery.error instanceof Error ? `: ${pagosQuery.error.message}` : ''}.
            </p>
          )}

          {pagosQuery.data && pagosVisibles.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
              <p className="text-sm text-gray-500">
                {filtro === 'pendientes' ? 'No hay pagos pendientes de verificación.' : 'Todavía no hay pagos registrados.'}
              </p>
            </div>
          )}

          {pagosQuery.data && pagosVisibles.length > 0 && (
            <div className="min-w-[1100px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full border-collapse text-left">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3">Fecha</th>
                    <th className="whitespace-nowrap px-4 py-3">Proyecto</th>
                    <th className="whitespace-nowrap px-4 py-3">Monto</th>
                    <th className="whitespace-nowrap px-4 py-3">Método</th>
                    <th className="whitespace-nowrap px-4 py-3">Referencia</th>
                    <th className="whitespace-nowrap px-4 py-3">Comprobante</th>
                    <th className="whitespace-nowrap px-4 py-3">Estatus</th>
                    <th className="whitespace-nowrap px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pagosVisibles.map((pago) => (
                    <FilaPago key={pago.id} pago={pago} onAprobar={aprobar} onRechazar={setPagoRechazando} procesando={estaProcesando(pago.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {pagoRechazando && (
        <Modal titulo="Rechazar pago" onClose={() => setPagoRechazando(null)}>
          <p className="mb-4 text-sm text-gray-600">
            {pagoRechazando.proyecto.titulo ?? pagoRechazando.proyecto.autorNombre} · {pagoRechazando.moneda}{' '}
            {Number(pagoRechazando.monto).toLocaleString('es', { minimumFractionDigits: 2 })}
          </p>
          <form onSubmit={confirmarRechazo}>
            <label htmlFor="motivo-rechazo" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
              Motivo del rechazo
            </label>
            <textarea
              id="motivo-rechazo"
              required
              rows={3}
              value={motivoRechazo}
              onChange={(event) => setMotivoRechazo(event.target.value)}
              placeholder="Ej. Comprobante ilegible, el monto no coincide…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40"
            />
            <button
              type="submit"
              disabled={mutacionVerificar.isPending}
              className="mt-6 w-full rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 disabled:opacity-50"
            >
              {mutacionVerificar.isPending ? 'Rechazando…' : 'Confirmar rechazo'}
            </button>
            {mutacionVerificar.isError && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                No se pudo rechazar{mutacionVerificar.error instanceof Error ? `: ${mutacionVerificar.error.message}` : ''}.
              </p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
