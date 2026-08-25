# Panhouse Gestor Editorial — frontend

React 18 + Vite + TypeScript + Tailwind CSS + TanStack Query. Primera
vuelta: login real + layout autenticado + "Mis proyectos" (rol
especialista). Construido contra la API en `../server`, ya probada.

## Levantar el entorno local

Con el backend ya corriendo (`npm run dev` en la raíz del repo, ver
[../README.md](../README.md)):

```bash
cp .env.example .env
npm install
npm run dev
```

Queda en `http://localhost:5173`. En dev, Vite reenvía `/api/*` al
backend (`VITE_API_PROXY_TARGET` en `.env`, por defecto
`http://localhost:3000`) — así el navegador solo habla con el origen
de Vite y la cookie httpOnly de sesión funciona sin configurar CORS en
el backend.

## Estructura

```
src/
  lib/         cliente API (fetch + credentials) y QueryClient
  types/       espejo manual del contrato de server/routes/ (sin monorepo)
  auth/        login, sesión (useMe/useLogin/useLogout), guard de rutas
  layout/      barra superior + área de contenido autenticada
  proyectos/   "Mis proyectos" (GET /api/proyectos/mios)
```

## Identidad de marca

Colores en `tailwind.config.ts` (`dorado`, `tinta`, `crema`) — usar
siempre esas clases, nunca el valor hex suelto en el código.

## Pendiente (fuera de alcance de esta vuelta)

Torre de control, portal de autores, y cualquier otra pantalla más
allá de login + Mis Proyectos. Sin dirección visual final elegida
todavía — el estilo actual es limpio y funcional, pensado para
ajustarse después sin rehacer la estructura.
