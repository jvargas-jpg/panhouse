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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-gray-900 via-tinta to-black px-4">
      <div className="pointer-events-none absolute left-[-10%] top-[-10%] h-96 w-96 rounded-full bg-dorado/10 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-96 w-96 rounded-full bg-green-500/10 blur-[100px]" />

      <div className="z-10 w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-light tracking-tight text-white">
            Bienvenido a <span className="font-bold text-dorado">Panhouse</span>
          </h1>
          <p className="text-sm text-white/50">Ingresa tus credenciales para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="email" className="mb-2 block text-xs font-bold uppercase tracking-wider text-dorado">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white transition-all focus:border-dorado focus:outline-none focus:ring-2 focus:ring-dorado/50"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-xs font-bold uppercase tracking-wider text-dorado">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white transition-all focus:border-dorado focus:outline-none focus:ring-2 focus:ring-dorado/50"
            />
          </div>

          {login.isError && (
            <p role="alert" className="text-sm text-red-400">
              {login.error instanceof Error ? login.error.message : 'No se pudo iniciar sesión'}
            </p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-dorado to-yellow-500 px-4 py-3 font-bold text-tinta shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(234,179,8,0.5)] disabled:opacity-60 disabled:hover:scale-100"
          >
            {login.isPending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
