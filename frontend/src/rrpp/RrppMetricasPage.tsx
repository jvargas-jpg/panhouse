import { Link, useNavigate } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { CrmSidebarLayout, NAV_ACTIVO, NAV_INACTIVO } from '../layout/CrmSidebarLayout';

function TarjetaKpi({ etiqueta, valor, ayuda }: { etiqueta: string; valor: string; ayuda: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{etiqueta}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{valor}</p>
      <p className="mt-1 text-xs text-gray-400">{ayuda}</p>
    </div>
  );
}

function BarraProgreso({ etiqueta, porcentaje }: { etiqueta: string; porcentaje: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{etiqueta}</span>
        <span className="font-bold text-gray-900">{porcentaje}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-dorado" style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  );
}

const SERVICIOS_DEMANDADOS = [
  { etiqueta: 'Crudo — Tripa', porcentaje: 16 },
  { etiqueta: 'Ghostwriter', porcentaje: 15 },
  { etiqueta: 'Sello Editorial', porcentaje: 13 },
];

const FERIAS_PROYECTADAS = [
  { feria: 'Bogotá', cantidad: 73 },
  { feria: 'Guadalajara', cantidad: 60 },
  { feria: 'Colombia', cantidad: 44 },
  { feria: 'Panamá', cantidad: 17 },
];

// "Panel de Rendimiento: Relaciones Públicas" — a pedido explícito del
// negocio, accesible desde la barra oscura de rrpp (ver el botón
// "Métricas" en RrppHomePage.tsx). Mismo shell (CrmSidebarLayout.tsx)
// que esa pantalla — sin él, navegar acá perdería la barra lateral,
// mismo bug que ya se había corregido una vez para
// comercial/MetricasPage.tsx (ver el comentario de esa pantalla).
//
// Datos estáticos a propósito: el pedido de este round es maquetar la
// pantalla ("puedes usar datos estáticos por ahora"), no agregar el
// cálculo real todavía — cuando exista, reemplazar estas constantes por
// un fetchMetricasRrpp() + useQuery, mismo patrón que
// comercial/metricasApi.ts + MetricasPage.tsx.
export function RrppMetricasPage() {
  const { data: usuario } = useMe();
  const rol = usuario?.rol;
  const navigate = useNavigate();
  // Mismo alcance que el resto del módulo de rrpp
  // (MatrizIngresoPage.tsx/RrppHomePage.tsx): rrpp y jefe_area.
  const puedeVer = rol === 'rrpp' || rol === 'jefe_area';

  if (!puedeVer) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-crema/10 p-6 text-center">
        <p className="text-tinta">No tenés acceso a esta sección.</p>
        <Link to="/" className="text-sm text-dorado hover:underline">
          ← Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <CrmSidebarLayout
      nav={
        <>
          <button onClick={() => navigate('/')} className={NAV_INACTIVO}>
            Proyectos
          </button>
          <button onClick={() => navigate('/')} className={NAV_INACTIVO}>
            Matrices de Ingreso
          </button>

          <div className="my-4 border-t border-gray-800" />

          <button className={NAV_ACTIVO}>
            <span className="h-1.5 w-1.5 rounded-full bg-dorado" />
            Métricas
          </button>
        </>
      }
    >
      <div className="rounded-2xl bg-gray-50 p-6 sm:p-8">
        <h1 className="mb-8 text-2xl font-bold tracking-tight text-gray-900">Panel de Rendimiento: Relaciones Públicas</h1>

        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <TarjetaKpi etiqueta="Total en Radar" valor="353" ayuda="Proyectos históricos en ingreso" />
          <TarjetaKpi etiqueta="Carga Operativa Activa" valor="234" ayuda="Proyectos en asesoramiento y espera de lanzamiento" />
          <TarjetaKpi etiqueta="Cuello de Botella" valor="87.5%" ayuda="Proyectos estancados en 'Reunión de Ingreso'" />
          <TarjetaKpi etiqueta="Satisfacción General" valor="55% Excelente" ayuda="38% Bueno" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-base font-bold text-gray-900">Top Servicios Demandados</h2>
            <div className="space-y-4">
              {SERVICIOS_DEMANDADOS.map((servicio) => (
                <BarraProgreso key={servicio.etiqueta} etiqueta={servicio.etiqueta} porcentaje={servicio.porcentaje} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-base font-bold text-gray-900">Proyección de Ferias</h2>
            <ul className="divide-y divide-gray-100">
              {FERIAS_PROYECTADAS.map((fila) => (
                <li key={fila.feria} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-gray-700">{fila.feria}</span>
                  <span className="font-bold text-gray-900">{fila.cantidad}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="mb-5 text-base font-bold text-gray-900">Cumplimiento Documental</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <BarraProgreso etiqueta="Contrato firmado por RRPP" porcentaje={19} />
              <BarraProgreso etiqueta="Bienvenida generada" porcentaje={53} />
            </div>
          </div>
        </div>
      </div>
    </CrmSidebarLayout>
  );
}
