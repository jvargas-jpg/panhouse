import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './auth/LoginPage';
import { RequireAuth } from './auth/RequireAuth';
import { RegistrarPagoPage } from './comercial/RegistrarPagoPage';
import { HomePage } from './HomePage';
import { AppLayout } from './layout/AppLayout';
import { ProyectoDetallePage } from './proyectos/ProyectoDetallePage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/proyectos/:id" element={<ProyectoDetallePage />} />
          <Route path="/comercial/pagos" element={<RegistrarPagoPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
