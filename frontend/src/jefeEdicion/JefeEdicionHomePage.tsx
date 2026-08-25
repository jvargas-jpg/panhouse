import { ProyectosSinEditor } from './ProyectosSinEditor';

// Primera pantalla de inicio propia de jefe_edicion — antes caía en el
// mensaje genérico de HomePage.tsx.
export function JefeEdicionHomePage() {
  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-tinta sm:text-xl">Panel de jefatura de edición</h1>

      <ProyectosSinEditor />
    </div>
  );
}
