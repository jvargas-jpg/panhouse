import { MisTrabajosEdicionPage } from './MisTrabajosEdicionPage';

// Fase 5 (5A Edición): antes reutilizaba MisProyectosPage tal cual
// (el Kanban por PROYECTO del especialista) — no reflejaba lo que el
// editor realmente necesita saber ("qué capítulo debo trabajar ahora").
// GET /capitulos/mios (ver MisTrabajosEdicionPage.tsx) resuelve eso a
// nivel de capítulo, priorizado por el backend.
export function EditorHomePage() {
  return <MisTrabajosEdicionPage />;
}
