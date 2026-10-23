import { EditorialWorkQueue } from './EditorialWorkQueue';

// La misma proyección de intervenciones que consume Jefe de Edición,
// acotada en servidor al Editor de la sesión; incluye la asignación
// inicial antes del primer capítulo y el feedback que vuelve a trabajo.
export function EditorHomePage() {
  return <EditorialWorkQueue />;
}
