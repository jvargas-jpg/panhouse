import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { notificarJefatura } from '../jefatura/jefaturaApi';
import { BotonNotificarTransicion } from './BotonNotificarTransicion';
import { EstadoTraspasoBadge } from './EstadoTraspasoBadge';
import { fetchFicha, fetchProyecto } from './proyectoDetalleApi';
import { SeccionFichaEditorial } from './SeccionFichaEditorial';
import { SeccionLanzamientoPromocion } from './SeccionLanzamientoPromocion';
import { SeccionMatrizAsesorias } from './SeccionMatrizAsesorias';
import { SeccionMatrizIngreso } from './SeccionMatrizIngreso';
import { SeccionProyectoPerfil } from './SeccionProyectoPerfil';

const FULL_BLEED = 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen';

// "Ficha de Trazabilidad" — módulo independiente, a pedido explícito del
// negocio: antes esto era la "Fase 1 — Ingreso" del stepper dentro de
// ProyectoDetallePage.tsx (Perfil del Autor + Ficha Editorial +
// Lanzamiento y Promoción); ahora vive en su propia pantalla, fuera del
// detalle del proyecto. La Matriz de Ingreso/Asesorías (que ya vivía
// aparte en /rrpp/matriz/:proyectoId, MatrizIngresoPage.tsx, retirado)
// se fusionó acá mismo — todo lo de "Fase 1" queda junto en un solo
// lugar nuevo. ProyectoDetallePage.tsx conserva la pestaña "Fase 1 -
// Ingreso" en el stepper, pero ahora es solo un puntero hacia acá (ver
// el comentario en ese archivo).
//
// Visibilidad de página: mismo alcance amplio que tenía la Fase 1 dentro
// del proyecto (puedeVerFicha de ProyectoDetallePage.tsx) — cualquiera
// que pudiera ver la ficha antes, sigue viendo Perfil/Ficha Editorial/
// Lanzamiento y Promoción acá. La Matriz de Ingreso/Asesorías, en
// cambio, mantiene su alcance más angosto de siempre (rrpp/jefe_area
// solamente, ver puedeVerMatriz más abajo) — fusionar las pantallas no
// significa ensanchar ese permiso, que fue una decisión aparte del
// negocio.
export function FichaTrazabilidadPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) throw new Error('Falta el id del proyecto en la ruta');

  const { data: usuario } = useMe();
  const rol = usuario?.rol;

  const puedeVerFicha =
    rol === 'jefe_area' ||
    rol === 'especialista' ||
    rol === 'rrpp' ||
    rol === 'comercial' ||
    rol === 'disenador' ||
    rol === 'lider_creativo' ||
    rol === 'soporte_editorial' ||
    rol === 'soporte_digital';

  // Mismos 6 flags que tenía ProyectoDetallePage.tsx para la Fase 1 —
  // ver el comentario completo de cada uno ahí, no se repite acá.
  const puedeEditarPerfil = rol === 'comercial' || rol === 'rrpp' || rol === 'jefe_area';
  const puedeEditarContrato = rol === 'comercial';
  const puedeEditarComercial = rol === 'comercial' || rol === 'jefe_area';
  const puedeNotificarRrpp = rol === 'comercial';
  const puedeEditarFichaEditorial = rol === 'rrpp';
  const puedeEditarLanzamientoPromocion = rol === 'rrpp';

  // Mismo alcance que el guard del backend: lectura rrpp/jefe_area (GET
  // /fichas-trazabilidad/enviados-a-rrpp), escritura exclusiva de rrpp.
  const puedeVerMatriz = rol === 'rrpp' || rol === 'jefe_area';
  const puedeEditarMatriz = rol === 'rrpp';

  const proyectoQuery = useQuery({ queryKey: ['proyecto', id], queryFn: () => fetchProyecto(id), enabled: puedeVerFicha });
  const fichaQuery = useQuery({ queryKey: ['ficha', id], queryFn: () => fetchFicha(id), enabled: puedeVerFicha });

  if (!puedeVerFicha) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-crema/10 p-6 text-center">
        <p className="text-tinta">No tenés acceso a esta sección.</p>
        <Link to="/" className="text-sm text-dorado hover:underline">
          ← Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-crema/10">
      {proyectoQuery.isLoading && <p className="p-6 text-tinta/70">Cargando proyecto…</p>}
      {proyectoQuery.isError && (
        <p role="alert" className="p-6 text-red-600">
          No se pudo cargar el proyecto{proyectoQuery.error instanceof Error ? `: ${proyectoQuery.error.message}` : ''}.
        </p>
      )}

      {proyectoQuery.data && (
        <div className={`${FULL_BLEED} relative overflow-hidden bg-gradient-to-b from-gray-900 to-black px-6 py-8 text-white shadow-lg md:px-16`}>
          <Link to="/" className="text-sm text-white/60 hover:text-white hover:underline">
            ← Mis proyectos
          </Link>

          <div className="flex flex-col items-center text-center">
            <span className="mt-4 rounded-full bg-purple-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              Ficha de Trazabilidad
            </span>
            <h1 className="mb-1 mt-3 text-3xl font-light text-white">
              {proyectoQuery.data.proyecto.autores.map((autor) => autor.nombre).join(', ') || 'Sin autor asignado'} — #
              {proyectoQuery.data.proyecto.codigo}
            </h1>
            <p className="text-sm text-white/70">
              {proyectoQuery.data.proyecto.servicio.nombre} ({proyectoQuery.data.proyecto.servicio.codigo})
            </p>
            <div className="mt-3">
              <EstadoTraspasoBadge
                notificadoRrpp={proyectoQuery.data.proyecto.notificadoRrpp}
                notificadoJefatura={proyectoQuery.data.proyecto.notificadoJefatura}
              />
            </div>
            <Link to={`/proyectos/${id}`} className="mt-3 text-xs text-white/60 hover:text-white hover:underline">
              Ver proyecto completo →
            </Link>
          </div>
        </div>
      )}

      {fichaQuery.isLoading && <p className="p-6 text-tinta/70">Cargando ficha…</p>}
      {fichaQuery.isError && (
        <p role="alert" className="p-6 text-red-600">
          No se pudo cargar la ficha{fichaQuery.error instanceof Error ? `: ${fichaQuery.error.message}` : ''}.
        </p>
      )}

      {fichaQuery.data && proyectoQuery.data && (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-12 md:px-16">
          {/* key={id}: mismo motivo que ya documentaba ProyectoDetallePage.tsx
              — sin esto, React no remonta el formulario al navegar de la
              ficha de un proyecto a la de otro por la misma ruta
              (/proyectos/:id/ficha-trazabilidad, solo cambia el param), y
              el estado local se queda pegado al proyecto anterior. */}
          <SeccionProyectoPerfil
            key={`perfil-${id}`}
            proyectoId={id}
            ficha={fichaQuery.data.ficha}
            autores={proyectoQuery.data.proyecto.autores}
            servicio={proyectoQuery.data.proyecto.servicio}
            puedeEditar={puedeEditarPerfil}
            puedeEditarContrato={puedeEditarContrato}
            puedeEditarComercial={puedeEditarComercial}
            puedeNotificarRrpp={puedeNotificarRrpp}
            notificadoRrpp={proyectoQuery.data.proyecto.notificadoRrpp}
          />

          <div className="rounded-xl border-2 border-purple-300 bg-purple-50/40 p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full bg-purple-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">RRPP</span>
              <h2 className="text-base font-bold text-purple-900">Área exclusiva de RRPP</h2>
            </div>
            <SeccionFichaEditorial key={`ficha-editorial-${id}`} proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={puedeEditarFichaEditorial} />
            <div className="mt-6">
              <SeccionLanzamientoPromocion
                key={`lanzamiento-promocion-${id}`}
                proyectoId={id}
                ficha={fichaQuery.data.ficha}
                puedeEditar={puedeEditarLanzamientoPromocion}
              />
            </div>
            {rol === 'rrpp' && (
              <div className="mt-6 flex justify-end border-t border-purple-200 pt-4">
                <BotonNotificarTransicion
                  proyectoId={id}
                  notificadoInicial={proyectoQuery.data.proyecto.notificadoJefatura}
                  etiqueta="Mandar a Jefatura"
                  mensajeConfirmacion="¿Estás seguro de mandar este proyecto a Jefatura? Asegúrate de que la Ficha Editorial esté completa."
                  mensajeToast="Proyecto enviado a Jefatura exitosamente"
                  mutationFn={notificarJefatura}
                  variante="destacado"
                />
              </div>
            )}
          </div>

          {puedeVerMatriz && (
            <>
              <SeccionMatrizIngreso
                key={`matriz-ingreso-${id}`}
                proyectoId={id}
                ficha={fichaQuery.data.ficha}
                autores={proyectoQuery.data.proyecto.autores}
                servicio={proyectoQuery.data.proyecto.servicio}
                puedeEditar={puedeEditarMatriz}
              />
              <SeccionMatrizAsesorias key={`matriz-asesorias-${id}`} proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={puedeEditarMatriz} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
