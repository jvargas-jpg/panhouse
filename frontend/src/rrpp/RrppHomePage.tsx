import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CrmSidebarLayout, NAV_ACTIVO, NAV_INACTIVO } from '../layout/CrmSidebarLayout';
import { ListaProyectosPendientes } from '../proyectos/ListaProyectosPendientes';
import { fetchProyectosEnviadosARrpp } from '../proyectos/proyectosPendientesApi';

type Vista = 'proyectos' | 'matrices';

// Primera pantalla de inicio propia de rrpp — antes caía en el mensaje
// genérico de HomePage.tsx.
//
// Mismo shell de barra lateral oscura que AutoresPage.tsx
// (Comercial/Dirección) — CrmSidebarLayout.tsx, extraído de ahí a
// pedido explícito del negocio: "menú lateral" se refería a esa barra
// global (logo PanHouse + navegación), no a un submenú propio dentro de
// la página (el grid grid-cols-12 con fondo claro de la ronda
// anterior, ya eliminado). No se agregó "Clientes" acá: aunque rrpp
// puede leer /api/autores (ROLES_LECTURA_AUTORES), nunca tuvo una
// pantalla de Clientes propia y el pedido lo dejó como opcional — se
// suma fácil más adelante si el negocio lo confirma, reutilizando
// ClientesGrid.tsx tal cual (ya es de solo lectura para quien no puede
// editar/eliminar, ver autoresApi.ts).
//
// Ambas pestañas comparten la ÚNICA consulta real de "proyectos en la
// cancha de rrpp" (fetchProyectosEnviadosARrpp, notificadoRrpp = true,
// mismo queryKey en las dos) — no son rutas propias (mismo patrón
// vistaActiva que ya usaba AutoresPage.tsx para Proyectos/Clientes),
// pero cambiar de pestaña no dispara un segundo fetch ni recarga la
// página, solo cambia cómo se navega desde cada fila: "Proyectos" va a
// la ficha completa (/proyectos/:id), "Matrices de Ingreso" va directo
// al módulo de la matriz (/rrpp/matriz/:id, ver MatrizIngresoPage.tsx).
export function RrppHomePage() {
  const [vistaActiva, setVistaActiva] = useState<Vista>('proyectos');
  const navigate = useNavigate();

  return (
    <CrmSidebarLayout
      nav={
        <>
          <button onClick={() => setVistaActiva('proyectos')} className={vistaActiva === 'proyectos' ? NAV_ACTIVO : NAV_INACTIVO}>
            {vistaActiva === 'proyectos' && <span className="h-1.5 w-1.5 rounded-full bg-dorado" />}
            Proyectos
          </button>
          <button onClick={() => setVistaActiva('matrices')} className={vistaActiva === 'matrices' ? NAV_ACTIVO : NAV_INACTIVO}>
            {vistaActiva === 'matrices' && <span className="h-1.5 w-1.5 rounded-full bg-dorado" />}
            Matrices de Ingreso
          </button>

          <div className="my-4 border-t border-gray-800" />

          <button onClick={() => navigate('/rrpp/metricas')} className={NAV_INACTIVO}>
            Métricas
          </button>
        </>
      }
    >
      {vistaActiva === 'proyectos' && (
        <ListaProyectosPendientes
          titulo="Proyectos asignados a ti"
          queryKey={['fichas-trazabilidad', 'enviados-a-rrpp']}
          queryFn={fetchProyectosEnviadosARrpp}
          mensajeVacio="Todavía no hay proyectos enviados a RRPP."
        />
      )}
      {vistaActiva === 'matrices' && (
        <ListaProyectosPendientes
          titulo="Matrices de Ingreso (RRPP)"
          queryKey={['fichas-trazabilidad', 'enviados-a-rrpp']}
          queryFn={fetchProyectosEnviadosARrpp}
          mensajeVacio="Todavía no hay proyectos enviados a RRPP."
          linkTo={(proyecto) => `/rrpp/matriz/${proyecto.id}`}
        />
      )}
    </CrmSidebarLayout>
  );
}
