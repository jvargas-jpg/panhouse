import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AutoresPage } from './autores/AutoresPage';
import { LoginPage } from './auth/LoginPage';
import { RequireAuth } from './auth/RequireAuth';
import { RegistrarPagoPage } from './comercial/RegistrarPagoPage';
import { HomePage } from './HomePage';
import { AppLayout } from './layout/AppLayout';
import { FullscreenLayout } from './layout/FullscreenLayout';
import { AutorHomePage } from './portalAutor/AutorHomePage';
import { AutorLayout } from './portalAutor/AutorLayout';
import { LibroDetalleAutorPage } from './portalAutor/LibroDetalleAutorPage';
import { FichaTrazabilidadPage } from './proyectos/FichaTrazabilidadPage';
import { ProyectoDetallePage } from './proyectos/ProyectoDetallePage';
import { RrppMetricasPage } from './rrpp/RrppMetricasPage';

// Carga perezosa: recharts (usado solo acá) agrega ~370kB al bundle
// principal — nadie más que quien visita Métricas necesita pagar ese
// peso en el primer load de la app.
const MetricasPage = lazy(() => import('./comercial/MetricasPage').then((m) => ({ default: m.MetricasPage })));

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          {/* Rutas explícitas del CRM que antes solo se veía como pestaña
              interna de AutoresPage.tsx en "/" — a pedido explícito del
              negocio, ahora que comercial tiene su propio Inicio
              (ComercialDashboardPage.tsx, ver HomePage.tsx), "Autores" y
              "Proyectos" necesitan un link real al que apuntar desde su
              sidebar. Mismo componente que ya existía, con la pestaña
              inicial fijada por prop — dirección sigue entrando por "/"
              exactamente igual que siempre, sin pasar por acá. */}
          <Route path="/autores" element={<AutoresPage vistaInicial="clientes" />} />
          <Route path="/proyectos" element={<AutoresPage vistaInicial="proyectos" />} />
          <Route path="/comercial/pagos" element={<RegistrarPagoPage />} />
          <Route
            path="/comercial/metricas"
            element={
              <Suspense fallback={<p className="p-6 text-sm text-gray-500">Cargando…</p>}>
                <MetricasPage />
              </Suspense>
            }
          />
          {/* "Panel de Rendimiento: Relaciones Públicas" — accesible desde
              la barra oscura de rrpp (ver el botón "Métricas" en
              RrppHomePage.tsx). Sin carga perezosa: a diferencia de
              /comercial/metricas, esta pantalla no usa recharts todavía
              (datos estáticos, ver el comentario en RrppMetricasPage.tsx). */}
          <Route path="/rrpp/metricas" element={<RrppMetricasPage />} />
        </Route>

        {/* Detalle de proyecto: fuera de AppLayout (sin su <main
            max-w-4xl>) para que el formulario use el 100% del ancho —
            mismo TopBar, layout hermano, no una página sin autenticar. */}
        <Route element={<FullscreenLayout />}>
          <Route path="/proyectos/:id" element={<ProyectoDetallePage />} />
          {/* "Ficha de Trazabilidad": módulo independiente, fuera de la
              vista unificada del proyecto — ver el comentario completo en
              FichaTrazabilidadPage.tsx (antes Fase 1 del stepper, y antes
              de eso "Matriz de Ingreso" en /rrpp/matriz/:proyectoId,
              retirado). Mismo FullscreenLayout que el detalle de proyecto
              (formulario a ancho completo). */}
          <Route path="/proyectos/:id/ficha-trazabilidad" element={<FichaTrazabilidadPage />} />
        </Route>

        {/* Portal del Autor: layout propio (top bar clara), no AppLayout
            (sidebar oscuro interno) — rama hermana bajo el mismo RequireAuth. */}
        <Route element={<AutorLayout />}>
          <Route path="/mis-libros" element={<AutorHomePage />} />
          <Route path="/mis-libros/:id" element={<LibroDetalleAutorPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
