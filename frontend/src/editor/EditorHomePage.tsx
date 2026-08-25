import { MisProyectosPage } from '../proyectos/MisProyectosPage';

// GET /proyectos/mios ya está generalizado por rol (especialista o
// editor, ver server/helpers/alertas.ts) — MisProyectosPage no tiene
// nada específico de especialista, así que se reutiliza tal cual en
// vez de duplicar la misma pantalla.
export function EditorHomePage() {
  return <MisProyectosPage />;
}
