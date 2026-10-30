import { PanhouseLogo } from '../design-system/Brand';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useLogin, useMe } from './useAuth';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { data: user } = useMe();
  const login = useLogin();

  if (user) {
    return <Navigate to="/" replace />;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    login.mutate(
      { email, password },
      { onSuccess: () => navigate('/', { replace: true }) },
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center overflow-y-auto bg-crema px-4 py-8">

      <div className="w-full max-w-md overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-center bg-gray-900 px-6 py-8"><PanhouseLogo/></div>
        <div className="px-6 pt-6 text-left">
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-gray-900">
            Iniciar sesión
          </h1>
          <p className="text-sm text-gray-500">Ingresa tus credenciales para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6" noValidate>
          <div>
            <label htmlFor="email" className="mb-2 block text-xs font-medium text-gray-600">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-dorado focus:outline-none focus:ring-2 focus:ring-dorado/40"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-xs font-medium text-gray-600">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-dorado focus:outline-none focus:ring-2 focus:ring-dorado/40"
            />
          </div>

          {login.isError && (
            <p role="alert" className="text-sm text-red-700">
              {login.error instanceof Error ? login.error.message : 'No se pudo iniciar sesión'}
            </p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="ph-button ph-button-primary w-full"
          >
            {login.isPending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
