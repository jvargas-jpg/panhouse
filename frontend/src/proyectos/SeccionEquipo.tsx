import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal } from '../autores/Modal';
import type { ProyectoConRiesgo } from '../types/api';
import { actualizarEquipoProyecto, fetchPersonalEquipo, type DatosEquipoProyecto } from './proyectoDetalleApi';

type RolKey = keyof DatosEquipoProyecto;

const ROLES_EQUIPO: { key: RolKey; label: string }[] = [
  { key: 'jefeAreaId', label: 'Jefe de Área' },
  { key: 'especialistaId', label: 'Coordinación' },
  { key: 'editorId', label: 'Editor/a' },
  { key: 'correctorId', label: 'Corrector/a' },
  { key: 'disenadorId', label: 'Diseñador/a' },
];

// "Equipo asignado" (antes "Escuadrón de Producción", reducido a pedido
// explícito del negocio): las columnas de asignación de proyectos
// (server/db/schema/proyectos.ts) en un solo panel. Calidad/Digital/
// Lanzamiento/Distribución salieron de acá — dejaron de tener un dueño
// individual (ver el comentario completo en schema/proyectos.ts), esas
// secciones ahora dependen solo del rol. jefeAreaId es nuevo: son 2
// personas reales las que se reparten los proyectos entrantes, hacía
// falta trackear cuál. especialistaId se re-etiquetó "Coordinación"
// (la columna/rol siguen llamándose "especialista" en el resto del
// código — Mis Proyectos, permisos de Edición/Corrección, etc. — esto
// es solo el nombre que ve el usuario acá). Visible para todo el equipo
// interno (puedeVerFicha en ProyectoDetallePage.tsx, sin comercial — ver
// integración ahí); solo jefe_area puede reasignar (puedeEditar), el
// resto ve las tarjetas sin el botón "Cambiar"/"Asignar persona". GET
// /usuarios ya está autorizado para los mismos roles que ven este panel,
// así que todos pueden resolver el nombre de quien está asignado, no
// solo quien puede editar.
export function SeccionEquipo({
  proyectoId,
  proyecto,
  puedeEditar,
}: {
  proyectoId: string;
  // Omit<'autor'>: este panel no lee el autor, solo las columnas de
  // asignación — así acepta tanto ProyectoConRiesgo como
  // ProyectoDetalleConAutores (coautoría, ver types/api.ts), que ya no
  // trae `autor` singular.
  proyecto: Omit<ProyectoConRiesgo, 'autor'>;
  puedeEditar: boolean;
}) {
  const personalQuery = useQuery({ queryKey: ['usuarios'], queryFn: fetchPersonalEquipo });
  const queryClient = useQueryClient();

  const [rolEnEdicion, setRolEnEdicion] = useState<{ key: RolKey; label: string } | null>(null);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('');

  const mutacion = useMutation({
    mutationFn: (usuarioId: string | null) => actualizarEquipoProyecto(proyectoId, { [rolEnEdicion!.key]: usuarioId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
      setRolEnEdicion(null);
    },
  });

  function abrirModalAsignacion(rol: { key: RolKey; label: string }) {
    setUsuarioSeleccionado(proyecto[rol.key] ?? '');
    setRolEnEdicion(rol);
  }

  function nombreDe(usuarioId: string | null): string | null {
    if (!usuarioId) return null;
    return personalQuery.data?.usuarios.find((usuario) => usuario.id === usuarioId)?.nombre ?? null;
  }

  return (
    <div className="mb-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <span className="h-2 w-2 rounded-full bg-dorado" /> Equipo asignado
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-5">
        {ROLES_EQUIPO.map((rol) => {
          const usuarioId = proyecto[rol.key];
          const nombre = nombreDe(usuarioId);

          if (usuarioId && nombre) {
            return (
              <div
                key={rol.key}
                className="group relative flex flex-col items-center rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm"
              >
                <span className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">{rol.label}</span>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-tinta text-lg font-bold text-white shadow-inner">
                  {nombre.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-gray-900">{nombre}</span>
                {puedeEditar && (
                  <button
                    onClick={() => abrirModalAsignacion(rol)}
                    className="mt-3 text-xs font-medium text-dorado opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    Cambiar
                  </button>
                )}
              </div>
            );
          }

          return (
            <div
              key={rol.key}
              onClick={puedeEditar ? () => abrirModalAsignacion(rol) : undefined}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-4 text-center transition-colors ${
                puedeEditar ? 'cursor-pointer hover:border-dorado/40 hover:bg-dorado/5' : ''
              }`}
            >
              <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">{rol.label}</span>
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-400">+</div>
              <span className="text-xs font-medium text-gray-500">{puedeEditar ? 'Asignar persona' : 'Sin asignar'}</span>
            </div>
          );
        })}
      </div>

      {rolEnEdicion && (
        <Modal titulo={`Asignar ${rolEnEdicion.label}`} onClose={() => setRolEnEdicion(null)}>
          <div>
            <label htmlFor="equipo-usuario" className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
              {rolEnEdicion.label}
            </label>
            <select
              id="equipo-usuario"
              value={usuarioSeleccionado}
              onChange={(event) => setUsuarioSeleccionado(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40"
            >
              <option value="">Sin asignar</option>
              {personalQuery.data?.usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nombre} ({usuario.rol})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => mutacion.mutate(usuarioSeleccionado || null)}
            disabled={mutacion.isPending}
            className="mt-8 w-full rounded-lg bg-tinta py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
          >
            {mutacion.isPending ? 'Guardando…' : 'Guardar Asignación'}
          </button>
          {mutacion.isError && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              No se pudo guardar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
