import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { eliminarProyecto } from '../jefatura/jefaturaApi';
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
// max-w-4xl flex-1 overflow-y-auto px-4 py-6 sm:px-6">. Igual que en
// ProyectoDetallePage.tsx, sin el breakout horizontal (ml/mr negativos +
// w-screen) el flex del sidebar quedaría atrapado en esa columna angosta
// de 896px. -my-6 cancela la posición del padding vertical de ese
// <main> (py-6 = 24px arriba y abajo) empujando el elemento hacia
// arriba — pero SOLO la posición, no el alto: el alto real (ver
// ALTO_LLENO_MAIN más abajo) necesita su propio ajuste aparte.
const FULL_BLEED = 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen -my-6';

// h-full por sí solo deja una franja de 48px de bg-crema sin cubrir en
// el fondo (bug real, confirmado midiendo con Playwright): h-full
// resuelve contra la CAJA DE CONTENIDO de <main> (ya descontado su
// propio padding, py-6 = 24px arriba + 24px abajo = 48px), pero -my-6
// de arriba solo corrige la POSICIÓN (empuja hacia arriba 24px) — un
// margin-bottom negativo no puede "devolver" esos mismos 24px como
// ALTO del elemento, solo afecta a hermanos que vengan después (acá no
// hay ninguno). +3rem (48px) es exactamente ese padding total de
// <main> — si su py-6 cambia alguna vez, este valor cambia con él.
const ALTO_LLENO_MAIN = 'h-[calc(100%+3rem)]';

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
    <div className={`${FULL_BLEED} ${ALTO_LLENO_MAIN} flex overflow-hidden bg-[#F8F9FA]`}>
      <aside className="z-20 hidden h-full w-64 flex-shrink-0 flex-col border-r border-gray-800 bg-gray-900 shadow-xl md:flex">
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
          <button onClick={() => navigate('/comercial/metricas')} className={NAV_INACTIVO}>
            Métricas
          </button>
        </nav>
      </aside>

      {/* AppLayout.tsx ya envuelve el Outlet en un <main> — dos <main> anidados
          no son válidos (landmark duplicado), así que este contenedor de
          scroll independiente es un <div> con las mismas clases. Es la
          ÚNICA región que scrollea acá adentro: el <div> raíz de arriba
          llena exacto el <main> de AppLayout.tsx (ver ALTO_LLENO_MAIN,
          ya acotado a la pantalla) y es overflow-hidden, así que <main>
          nunca ve contenido de sobra y nunca muestra su propio
          scrollbar. */}
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
