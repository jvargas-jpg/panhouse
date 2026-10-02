import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { CrearAutorForm } from '../../autores/CrearAutorForm';
import { Modal } from '../../autores/Modal';
import { Toast } from '../../autores/Toast';
import { eliminarAutor, fetchAutores } from '../../autores/autoresApi';
import { CrmSidebarLayout } from '../../layout/CrmSidebarLayout';
import { fetchProyectosActivos } from '../../proyectos/proyectosApi';
import type { Autor } from '../../types/api';
import { COMERCIAL_FOOTER, COMERCIAL_LOGO, ComercialSidebarNav } from '../ComercialSidebarNav';
import { AuthorsList, type OrdenAutores } from './AuthorsList';
import { AuthorsToolbar, type FiltroCategoria } from './AuthorsToolbar';

function coincide(autor: Autor, termino: string): boolean {
  const q = termino.trim().toLowerCase();
  if (!q) return true;
  return (
    autor.nombre.toLowerCase().includes(q) ||
    (autor.nombreArtistico ?? '').toLowerCase().includes(q) ||
    (autor.email ?? []).some((correo) => correo.toLowerCase().includes(q)) ||
    (autor.pais ?? '').toLowerCase().includes(q)
  );
}

// "Autores" premium de comercial — a pedido explícito del negocio,
// reemplaza visualmente a ClientesGrid.tsx SOLO para este rol (montado
// desde AutoresPage.tsx con un return temprano, ver el comentario ahí;
// dirección sigue viendo ClientesGrid.tsx tal cual). Responde "¿qué
// autores existen, cómo los encuentro y qué proyectos tienen?" — sin
// KPIs, gráficos ni actividad, eso ya vive en el Dashboard
// (ComercialDashboardPage.tsx).
//
// Datos: fetchAutores (mismo queryKey ['autores'] que ya usaba
// ClientesGrid.tsx/ComercialDashboardPage.tsx — comparte caché, no
// duplica la consulta) + fetchProyectosActivos (mismo queryKey
// ['proyectos', 'activos'] que ComercialDashboardPage.tsx) para el
// conteo de "Proyectos activos" por autor, cruzados en un solo useMemo
// sin request por autor (mismo criterio y mismas dos limitaciones ya
// documentadas en RecentAuthors.tsx: solo cuenta activos, no el
// histórico completo, y solo suma para el autor legacy singular de cada
// proyecto, no toda la coautoría).
//
// Acciones del menú "⋮": solo Editar y Eliminar — son las únicas que ya
// existían en ClientesGrid.tsx. No hay "Ver autor" (no existe una
// pantalla de detalle) ni "Ver proyectos" (no existe una forma de
// filtrar proyectos por autor sin backend nuevo) — no se inventó
// ninguna de las dos.
export function CommercialAuthorsView() {
  const queryClient = useQueryClient();

  const autoresQuery = useQuery({ queryKey: ['autores'], queryFn: fetchAutores });
  const proyectosActivosQuery = useQuery({ queryKey: ['proyectos', 'activos'], queryFn: fetchProyectosActivos });

  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoria>('todos');
  const [orden, setOrden] = useState<OrdenAutores>('recientes');

  const [autorEnEdicion, setAutorEnEdicion] = useState<Autor | null>(null);
  const [modalAutorOpen, setModalAutorOpen] = useState(false);

  const [toastMensaje, setToastMensaje] = useState<string | null>(null);
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
      setToastMensaje('Autor eliminado exitosamente');
    },
    onError: (error) => {
      setToastError(error instanceof Error ? error.message : 'No se pudo eliminar el autor.');
    },
  });

  function handleEliminarAutor(autor: Autor) {
    if (!window.confirm(`¿Eliminar a ${autor.nombre}? Esta acción no se puede deshacer.`)) return;
    mutacionEliminarAutor.mutate(autor.id);
  }

  const proyectosActivosPorAutor = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const proyecto of proyectosActivosQuery.data?.proyectos ?? []) {
      mapa.set(proyecto.autor.id, (mapa.get(proyecto.autor.id) ?? 0) + 1);
    }
    return mapa;
  }, [proyectosActivosQuery.data]);

  const autoresFiltrados = useMemo(() => {
    const lista = autoresQuery.data?.autores ?? [];
    const filtrados = lista
      .filter((autor) => filtroCategoria === 'todos' || autor.categoria === filtroCategoria)
      .filter((autor) => coincide(autor, searchTerm));

    const ordenados = [...filtrados];
    if (orden === 'recientes') ordenados.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (orden === 'antiguos') ordenados.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    else if (orden === 'nombre-asc') ordenados.sort((a, b) => a.nombre.localeCompare(b.nombre));
    else if (orden === 'nombre-desc') ordenados.sort((a, b) => b.nombre.localeCompare(a.nombre));
    return ordenados;
  }, [autoresQuery.data, filtroCategoria, searchTerm, orden]);

  return (
    <CrmSidebarLayout
      logo={COMERCIAL_LOGO}
      footer={COMERCIAL_FOOTER}
      contentMaxWidth="max-w-[1440px]"
      nav={<ComercialSidebarNav activo="autores" />}
      overlays={
        <>
          {modalAutorOpen && (
            <Modal
              titulo={autorEnEdicion ? 'Editar autor' : 'Registrar nuevo autor'}
              subtitulo="Crea el perfil del autor. Sus proyectos se registran posteriormente."
              onClose={() => setModalAutorOpen(false)}
              ancho="4xl"
            >
              <CrearAutorForm
                autorEnEdicion={autorEnEdicion}
                onGuardado={(mensaje) => {
                  setModalAutorOpen(false);
                  setToastMensaje(mensaje);
                }}
                onCancelar={() => setModalAutorOpen(false)}
              />
            </Modal>
          )}
          {toastMensaje && <Toast mensaje={toastMensaje} />}
          {toastError && <Toast mensaje={toastError} variante="error" />}
        </>
      }
    >
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Autores</h1>
          <p className="mt-1 text-sm text-gray-500">Gestiona la base de autores y consulta rápidamente sus proyectos.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAutorEnEdicion(null);
            setModalAutorOpen(true);
          }}
          className="flex-shrink-0 rounded-lg bg-dorado px-4 py-2.5 text-sm font-semibold text-tinta shadow-sm transition-all hover:brightness-95 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40"
        >
          + Nuevo autor
        </button>
      </div>

      <div className="mb-4">
        <AuthorsToolbar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          filtroCategoria={filtroCategoria}
          onFiltroCategoriaChange={setFiltroCategoria}
        />
      </div>

      <AuthorsList
        autores={autoresFiltrados}
        totalSinFiltrar={autoresQuery.data?.autores.length ?? 0}
        proyectosActivosPorAutor={proyectosActivosPorAutor}
        orden={orden}
        onOrdenChange={setOrden}
        cargando={autoresQuery.isLoading}
        huboError={autoresQuery.isError}
        hayBusqueda={searchTerm.trim().length > 0 || filtroCategoria !== 'todos'}
        onReintentar={() => autoresQuery.refetch()}
        onEditar={(autor) => {
          setAutorEnEdicion(autor);
          setModalAutorOpen(true);
        }}
        onEliminar={handleEliminarAutor}
        onNuevoAutor={() => {
          setAutorEnEdicion(null);
          setModalAutorOpen(true);
        }}
      />
    </CrmSidebarLayout>
  );
}
