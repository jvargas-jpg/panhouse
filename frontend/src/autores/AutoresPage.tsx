import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { fetchProyectosPendientesContrato } from '../proyectos/proyectosPendientesApi';
import type { Autor, ProyectoPendienteSeccion1 } from '../types/api';
import { eliminarAutor, fetchAutores } from './autoresApi';
import { ClientesGrid } from './ClientesGrid';
import { CrearAutorForm } from './CrearAutorForm';
import { CrearProyectoModalForm } from './CrearProyectoModalForm';
import { Modal } from './Modal';
import { ProyectosPendientesCrmList } from './ProyectosPendientesCrmList';
import { Toast } from './Toast';

// AppLayout.tsx envuelve toda la app en <TopBar/> + <main className="mx-auto
// max-w-4xl px-4 py-6 sm:px-6">. Igual que en ProyectoDetallePage.tsx,
// sin el breakout horizontal (ml/mr negativos + w-screen) el flex
// h-screen del sidebar quedaría atrapado en esa columna angosta de
// 896px. -my-6 además cancela el padding vertical (py-6 = 24px arriba
// y abajo) de ese <main>, para que el alto de abajo sea exacto.
const FULL_BLEED = 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen -my-6';

// Alto real del <header> de TopBar (medido: 59px, ver TopBar.tsx).
const ALTO_SIDEBAR = 'h-[calc(100vh-59px)]';

const NAV_ACTIVO =
  'w-full flex items-center gap-3 px-4 py-3 bg-dorado/10 text-dorado rounded-xl font-semibold text-sm border border-dorado/20 transition-all text-left';
const NAV_INACTIVO =
  'w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl font-medium text-sm transition-all text-left';

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
      // autor con proyectos asociados" cuando responde 400.
      setToastError(error instanceof Error ? error.message : 'No se pudo eliminar el cliente.');
    },
  });

  function handleEliminarAutor(autor: Autor) {
    if (!window.confirm(`¿Eliminar a ${autor.nombre}? Esta acción no se puede deshacer.`)) return;
    mutacionEliminarAutor.mutate(autor.id);
  }

  function cambiarVista(vista: Vista) {
    setVistaActiva(vista);
    setSearchTerm('');
  }

  const tituloVista = vistaActiva === 'proyectos' ? 'Proyectos Pendientes' : 'Directorio de Clientes';
  const placeholderBusqueda = vistaActiva === 'proyectos' ? 'Buscar por ID, autor o servicio...' : 'Buscar por nombre, correo o país...';

  return (
    <div className={`${FULL_BLEED} ${ALTO_SIDEBAR} flex overflow-hidden bg-[#F8F9FA]`}>
      <aside className="z-20 hidden w-64 flex-shrink-0 flex-col border-r border-gray-800 bg-gray-900 shadow-xl md:flex">
        <div className="flex h-20 items-center border-b border-gray-800 px-6">
          <h1 className="text-xl font-light uppercase tracking-widest text-white">
            Pan<span className="font-bold text-dorado">House</span>
          </h1>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-8">
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
          <button className={NAV_INACTIVO}>Métricas</button>
        </nav>
      </aside>

      {/* AppLayout.tsx ya envuelve el Outlet en un <main> — dos <main> anidados
          no son válidos (landmark duplicado), así que este contenedor de
          scroll independiente es un <div> con las mismas clases. */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-5xl px-6 py-10">
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
        </div>
      </div>

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
    </div>
  );
}
