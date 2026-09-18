import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { eliminarProyecto } from '../jefatura/jefaturaApi';
import { CrmSidebarLayout, NAV_ACTIVO, NAV_INACTIVO } from '../layout/CrmSidebarLayout';
import { fetchProyectosPendientesContrato } from '../proyectos/proyectosPendientesApi';
import type { Autor, ProyectoPendienteSeccion1 } from '../types/api';
import { eliminarAutor, fetchAutores } from './autoresApi';
import { ClientesGrid } from './ClientesGrid';
import { CrearAutorForm } from './CrearAutorForm';
import { CrearProyectoModalForm } from './CrearProyectoModalForm';
import { Modal } from './Modal';
import { ProyectosPendientesCrmList } from './ProyectosPendientesCrmList';
import { Toast } from './Toast';

type Vista = 'proyectos' | 'clientes';

// CRM modular de la vista Comercial/Dirección: dos entidades, dos
// vistas, cada una con su propio buscador, lista y modal de alta/
// edición. comercial ve las dos pestañas (Proyectos es la línea de
// producción que le importa día a día); dirección solo ve Clientes —
// nunca tuvo acceso a "proyectos pendientes de contrato" (esa lista es
// exclusiva de comercial en el backend), así que mostrarle una pestaña
// "Proyectos" vacía habría sido peor que no mostrarla.
export function AutoresPage() {
  const { data: usuario } = useMe();
  const esComercial = usuario?.rol === 'comercial';
  const navigate = useNavigate();

  const autoresQuery = useQuery({ queryKey: ['autores'], queryFn: fetchAutores });
  const queryClient = useQueryClient();

  const [vistaActiva, setVistaActiva] = useState<Vista>(esComercial ? 'proyectos' : 'clientes');
  const [searchTerm, setSearchTerm] = useState('');

  const [autorEnEdicion, setAutorEnEdicion] = useState<Autor | null>(null);
  const [modalAutorOpen, setModalAutorOpen] = useState(false);

  const [proyectoEnEdicion, setProyectoEnEdicion] = useState<ProyectoPendienteSeccion1 | null>(null);
  const [modalProyectoOpen, setModalProyectoOpen] = useState(false);

  const [toastMensaje, setToastMensaje] = useState<string | null>(null);
  // Separado de toastMensaje (no reutilizado): ese lo dispara onGuardado
  // de los modales de alta/edición, siempre "éxito". Este es solo para
  // el error 400 de "Eliminar cliente" (autor con proyectos asociados)
  // — mismo auto-cierre, ícono y color distintos (ver Toast.tsx).
  const [toastError, setToastError] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMensaje) return;
    const id = setTimeout(() => setToastMensaje(null), 3000);
    return () => clearTimeout(id);
  }, [toastMensaje]);

  useEffect(() => {
    if (!toastError) return;
    const id = setTimeout(() => setToastError(null), 3000);
    return () => clearTimeout(id);
  }, [toastError]);

  const mutacionEliminarAutor = useMutation({
    mutationFn: (autorId: string) => eliminarAutor(autorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autores'] });
      setToastMensaje('Cliente eliminado exitosamente');
    },
    onError: (error) => {
      // ApiError.message ya trae el texto del backend tal cual (ver
      // eliminarAutor en autoresApi.ts) — "No se puede eliminar un
      // autor con proyectos activos. Elimina sus proyectos primero."
      // cuando responde 400.
      setToastError(error instanceof Error ? error.message : 'No se pudo eliminar el cliente.');
    },
  });

  function handleEliminarAutor(autor: Autor) {
    // Nombre real/legal, no el artístico — a pedido explícito del
    // negocio (ver el mismo criterio en ClientesGrid.tsx): es el
    // identificador oficial, así confirma que está por borrar al
    // cliente correcto.
    if (!window.confirm(`¿Eliminar a ${autor.nombre}? Esta acción no se puede deshacer.`)) return;
    mutacionEliminarAutor.mutate(autor.id);
  }

  // Papelera directo en la fila de ProyectosPendientesCrmList.tsx (antes
  // solo se podía borrar entrando al modal de edición) — mismo patrón
  // que mutacionEliminarAutor/handleEliminarAutor de arriba: la
  // confirmación nativa y la mutación viven acá, el componente de lista
  // solo dispara el callback.
  const mutacionEliminarProyecto = useMutation({
    mutationFn: (proyectoId: string) => eliminarProyecto(proyectoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fichas-trazabilidad', 'pendientes', 'contrato'] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      setToastMensaje('Proyecto eliminado exitosamente');
    },
    onError: (error) => {
      setToastError(error instanceof Error ? error.message : 'No se pudo eliminar el proyecto.');
    },
  });

  function handleEliminarProyecto(proyecto: ProyectoPendienteSeccion1) {
    const nombre = proyecto.titulo ?? (proyecto.autores.map((autor) => autor.nombre).join(', ') || 'este proyecto');
    if (!window.confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    mutacionEliminarProyecto.mutate(proyecto.id);
  }

  function cambiarVista(vista: Vista) {
    setVistaActiva(vista);
    setSearchTerm('');
  }

  const tituloVista = vistaActiva === 'proyectos' ? 'Proyectos Pendientes' : 'Directorio de Clientes';
  const placeholderBusqueda = vistaActiva === 'proyectos' ? 'Buscar por ID, autor o servicio...' : 'Buscar por nombre, correo o país...';

  return (
    <CrmSidebarLayout
      nav={
        <>
          {esComercial && (
            <button onClick={() => cambiarVista('proyectos')} className={vistaActiva === 'proyectos' ? NAV_ACTIVO : NAV_INACTIVO}>
              {vistaActiva === 'proyectos' && <span className="h-1.5 w-1.5 rounded-full bg-dorado" />}
              Proyectos
            </button>
          )}

          <button onClick={() => cambiarVista('clientes')} className={vistaActiva === 'clientes' ? NAV_ACTIVO : NAV_INACTIVO}>
            {vistaActiva === 'clientes' && <span className="h-1.5 w-1.5 rounded-full bg-dorado" />}
            Clientes
          </button>

          <div className="my-4 border-t border-gray-800" />

          <button onClick={() => navigate('/comercial/pagos')} className={NAV_INACTIVO}>
            Registrar Pago
          </button>
          <button onClick={() => navigate('/comercial/metricas')} className={NAV_INACTIVO}>
            Métricas
          </button>
        </>
      }
      overlays={
        <>
          {modalAutorOpen && (
            <Modal titulo={autorEnEdicion ? 'Editar Autor' : 'Registrar Nuevo Autor'} onClose={() => setModalAutorOpen(false)}>
              <CrearAutorForm
                autorEnEdicion={autorEnEdicion}
                onGuardado={(mensaje) => {
                  setModalAutorOpen(false);
                  setToastMensaje(mensaje);
                }}
              />
            </Modal>
          )}

          {modalProyectoOpen && (
            <Modal titulo={proyectoEnEdicion ? 'Editar Proyecto' : 'Crear Nuevo Proyecto'} onClose={() => setModalProyectoOpen(false)}>
              <CrearProyectoModalForm
                proyectoEnEdicion={proyectoEnEdicion}
                onGuardado={(mensaje) => {
                  setModalProyectoOpen(false);
                  setToastMensaje(mensaje);
                }}
              />
            </Modal>
          )}

          {toastMensaje && <Toast mensaje={toastMensaje} />}
          {toastError && <Toast mensaje={toastError} variante="error" />}
        </>
      }
    >
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="flex-shrink-0 text-2xl font-semibold tracking-tight text-gray-900">{tituloVista}</h2>

        <div className="flex flex-1 lg:justify-center">
          <input
            type="text"
            placeholder={placeholderBusqueda}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition-all focus:border-dorado focus:ring-2 focus:ring-dorado/40"
          />
        </div>

        <div className="flex-shrink-0">
          {vistaActiva === 'proyectos' ? (
            <button
              onClick={() => {
                setProyectoEnEdicion(null);
                setModalProyectoOpen(true);
              }}
              className="w-full rounded-lg bg-tinta px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 sm:w-auto"
            >
              + Nuevo Proyecto
            </button>
          ) : (
            <button
              onClick={() => {
                setAutorEnEdicion(null);
                setModalAutorOpen(true);
              }}
              className="w-full rounded-lg bg-tinta px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 sm:w-auto"
            >
              + Nuevo Cliente
            </button>
          )}
        </div>
      </div>

      {vistaActiva === 'proyectos' && esComercial && (
        <ProyectosPendientesCrmList
          queryKey={['fichas-trazabilidad', 'pendientes', 'contrato']}
          queryFn={fetchProyectosPendientesContrato}
          mensajeVacio="No hay proyectos pendientes de lo contractual ahora mismo."
          searchTerm={searchTerm}
          onEditarProyecto={(proyecto) => {
            setProyectoEnEdicion(proyecto);
            setModalProyectoOpen(true);
          }}
          onEliminarProyecto={handleEliminarProyecto}
        />
      )}

      {vistaActiva === 'clientes' && (
        <ClientesGrid
          autores={autoresQuery.data?.autores ?? []}
          searchTerm={searchTerm}
          onEditar={(autor) => {
            setAutorEnEdicion(autor);
            setModalAutorOpen(true);
          }}
          onEliminar={handleEliminarAutor}
        />
      )}
    </CrmSidebarLayout>
  );
}
