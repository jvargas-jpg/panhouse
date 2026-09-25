import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { EstadoBadge } from './EstadoBadge';
import { EstadoTraspasoBadge } from './EstadoTraspasoBadge';
import { fetchFicha, fetchProyecto } from './proyectoDetalleApi';
import { RiesgoBadge } from './RiesgoBadge';
import { SeccionCalidad } from './SeccionCalidad';
import { SeccionCorreccion } from './SeccionCorreccion';
import { SeccionCorreccionControl } from './SeccionCorreccionControl';
import { SeccionDiseno, SeccionDisenoBrief } from './SeccionDiseno';
import { SeccionDistribucion } from './SeccionDistribucion';
import { SeccionEdicion } from './SeccionEdicion';
import { SeccionEquipo } from './SeccionEquipo';
import { SeccionImpresion } from './SeccionImpresion';
import { SeccionLanzamiento } from './SeccionLanzamiento';
import { SeccionSoporteDigital } from './SeccionSoporteDigital';

// "Fase 1 - Ingreso" ya no muestra los formularios de Perfil/Ficha
// Editorial/Matriz de Ingreso/Lanzamiento y Promoción acá adentro — a
// pedido explícito del negocio, esos datos se mudaron a su propia
// pantalla, "Ficha de Trazabilidad" (ver FichaTrazabilidadPage.tsx). La
// pestaña Fase 1 sigue existiendo en el stepper (no desaparece), pero
// ahora es solo un puntero hacia allá. Mismo componente para la rama
// comercial (arriba) y para pasoActivo===1 (dentro del stepper de
// producción) — antes eran dos copias casi idénticas del mismo bloque.
function FaseIngresoPointer({ proyectoId }: { proyectoId: string }) {
  return (
    <div className="flex w-full flex-col items-start gap-4 rounded-xl border-2 border-purple-300 bg-purple-50/40 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <span className="rounded-full bg-purple-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">RRPP</span>
        <h2 className="mt-2 text-base font-bold text-purple-900">Ficha de Trazabilidad</h2>
        <p className="mt-1 text-sm text-purple-900/70">
          Perfil del Autor, Ficha Editorial, Matriz de Ingreso y Lanzamiento y Promoción se completan desde su propia pantalla.
        </p>
      </div>
      <Link
        to={`/proyectos/${proyectoId}/ficha-trazabilidad`}
        className="shrink-0 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700"
      >
        Ver Ficha de Trazabilidad completa →
      </Link>
    </div>
  );
}

// 10 fases — a pedido explícito del negocio, adaptadas para calzar con
// el stepper de otro proyecto de referencia (Desktop/Gestor de Proyectos
// Editoriales/panhouse-gestor, ProyectoDetailPage.jsx: Ingreso,
// Extracción, Creación de contenido, Feedback de contenido, Corrección,
// Proceso creativo, Diseño gráfico, Tripa diagramada, Solicitud de
// paquete final, Publicación). El mapeo a nuestras 9 fases reales no es
// 1 a 1 — quedó confirmado así con el negocio, con estas salvedades
// explícitas:
// - Extracción/Creación de contenido/Feedback de contenido (2-4) son
//   las 3 caras de una sola fase nuestra real (Edición): no existe hoy
//   ningún dato que las distinga, así que las 3 pestañas muestran el
//   mismo SeccionEdicion (ver más abajo) — no se fabricó un split falso.
// - Proceso creativo/Diseño gráfico (6-7) si tienen datos reales
//   distintos: el brief creativo (SeccionDisenoBrief) quedó separado de
//   las propuestas de portada + control agregado (SeccionDiseno).
// - Tripa diagramada (8) = nuestra Calidad; Solicitud de paquete final
//   (9) = nuestra Digital — mismos componentes, solo cambió la etiqueta.
// - Publicación (10) comprime nuestras 3 fases finales (Lanzamiento,
//   Impresión, Distribución), que siguen siendo secciones separadas
//   apiladas dentro de esta única pestaña — no se fusionaron sus datos.
const FASES = [
  { id: 1, label: 'Ingreso' },
  { id: 2, label: 'Extracción' },
  { id: 3, label: 'Creación de contenido' },
  { id: 4, label: 'Feedback de contenido' },
  { id: 5, label: 'Corrección' },
  { id: 6, label: 'Proceso creativo' },
  { id: 7, label: 'Diseño gráfico' },
  { id: 8, label: 'Tripa diagramada' },
  { id: 9, label: 'Solicitud de paquete final' },
  { id: 10, label: 'Publicación' },
];

// AppLayout.tsx envuelve toda la app en <main className="mx-auto max-w-4xl px-4 ...">
// — sin este "breakout", w-full/w-screen solos solo llenarían esa
// columna angosta, no la pantalla real. ml/mr calc(-50vw + 50%) es el
// truco estándar para escapar de un contenedor centrado sin tocarlo:
// no requiere modificar AppLayout.tsx (fuera del alcance de esta
// página) ni queda scroll horizontal extra (a diferencia de un w-screen
// suelto).
const FULL_BLEED = 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen';

export function ProyectoDetallePage() {
  const { id } = useParams<{ id: string }>();
  if (!id) throw new Error('Falta el id del proyecto en la ruta');

  const { data: usuario } = useMe();
  const rol = usuario?.rol;

  const [pasoActivo, setPasoActivo] = useState(1);

  // Mismos roles que ya se dejaron pasar en las rutas GET del backend
  // (server/routes/{trazabilidad,capitulos,pausas}.routes.ts). Se
  // condiciona el fetch (no solo el render) para no lanzar consultas
  // que el backend va a rechazar con 403 y mostrar como error al usuario.
  const puedeVerFicha =
    rol === 'jefe_area' ||
    rol === 'especialista' ||
    rol === 'rrpp' ||
    rol === 'comercial' ||
    rol === 'disenador' ||
    rol === 'lider_creativo' ||
    rol === 'soporte_editorial' ||
    rol === 'soporte_digital';
  const proyectoQuery = useQuery({ queryKey: ['proyecto', id], queryFn: () => fetchProyecto(id) });
  const fichaQuery = useQuery({ queryKey: ['ficha', id], queryFn: () => fetchFicha(id), enabled: puedeVerFicha });

  const porcentaje = (pasoActivo / FASES.length) * 100;
  const faseActual = FASES.find((f) => f.id === pasoActivo);

  return (
    <div className="flex min-h-screen w-full flex-col bg-crema/10">
      {proyectoQuery.isLoading && <p className="p-6 text-tinta/70">Cargando proyecto…</p>}
      {proyectoQuery.isError && (
        <p role="alert" className="p-6 text-red-600">
          No se pudo cargar el proyecto{proyectoQuery.error instanceof Error ? `: ${proyectoQuery.error.message}` : ''}.
        </p>
      )}

      {/* Hero Header — de lado a lado, degradado oscuro moderno. Padding
          vertical compacto (py-8, antes pb-2 pt-10 + pb-6 extra del
          bloque de badges) y bloque de identidad centrado — el enlace de
          vuelta se deja fuera de ese centrado (patrón estándar: acción
          de navegación arriba a la izquierda, contenido del proyecto
          centrado debajo). */}
      {proyectoQuery.data && (
        <div
          className={`${FULL_BLEED} relative overflow-hidden bg-gradient-to-b from-gray-900 to-black px-6 py-8 text-white shadow-lg md:px-16`}
        >
          <Link to="/" className="text-sm text-white/60 hover:text-white hover:underline">
            ← Mis proyectos
          </Link>

          <div className="flex flex-col items-center text-center">
            {/* Ya no hay título manual (el negocio lo retiró, ver el
                comentario de la columna en server/db/schema/proyectos.ts)
                — el identificador principal ahora se genera solo:
                autores (coautoría, todos unidos por coma — ninguno debería
                quedar invisible — por su nombre real/legal, no el
                artístico, a pedido explícito del negocio: ver el mismo
                criterio en TarjetaPerfilAutores en SeccionProyectoPerfil.tsx)
                + el codigo único asignado al crear el proyecto. */}
            <h1 className="mb-1 mt-4 text-3xl font-light text-white">
              {proyectoQuery.data.proyecto.autores.map((autor) => autor.nombre).join(', ') || 'Sin autor asignado'}{' '}
              — #{proyectoQuery.data.proyecto.codigo}
            </h1>
            <p className="text-sm text-white/70">
              {proyectoQuery.data.proyecto.servicio.nombre} ({proyectoQuery.data.proyecto.servicio.codigo})
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <EstadoBadge estado={proyectoQuery.data.proyecto.estado} />
              {/* Estado del traspaso Comercial → RRPP → Jefatura — derivado
                  de notificadoRrpp/notificadoJefatura (ya existían para la
                  cascada de notificaciones, ver BotonNotificarTransicion en
                  FichaTrazabilidadPage.tsx), no una columna nueva: evita un
                  segundo campo "estado" en la misma tabla que el de arriba
                  (operativo, en_proceso/retrasado/etc.), que ya se usa en
                  riesgo/carga y no tiene relación con este traspaso. */}
              <EstadoTraspasoBadge
                notificadoRrpp={proyectoQuery.data.proyecto.notificadoRrpp}
                notificadoJefatura={proyectoQuery.data.proyecto.notificadoJefatura}
              />
              <RiesgoBadge riesgo={proyectoQuery.data.proyecto.riesgo} />
            </div>
          </div>

          {/* El progreso (gigante) — Master Stepper exclusivo de producción,
              oculto para comercial Y para rrpp. rrpp perdió acceso de UI a
              Lanzamiento/Impresión/Distribución (todas apiladas hoy bajo
              "Publicación", fase 10 de 10) a pedido explícito del negocio:
              su entorno queda limitado a esta vista central (Fase 1 —
              Perfil/Ficha Editorial/Matriz de Ingreso/Lanzamiento y
              Promoción), confirmado aunque esos permisos de edición sigan
              existiendo en el backend (PATCH .../impresion,
              .../distribucion-control, .../lanzamiento-control siguen
              aceptando rrpp — decisión deliberada, no un descuido: si esas
              pantallas dejan de ser necesarias del todo, revisar también
              esos guards). */}
          {puedeVerFicha && rol !== 'comercial' && rol !== 'rrpp' && (
            <div className="mb-6 mt-8">
              <span className="text-sm font-bold uppercase tracking-[0.2em] text-dorado">
                Fase {pasoActivo} de {FASES.length}
              </span>
              <h2 className="mt-2 text-4xl font-light tracking-tight text-white md:text-5xl">{faseActual?.label}</h2>
            </div>
          )}
        </div>
      )}

      {/* Pipeline de fases — mismo componente visual (track dorado +
          círculos con check) que ya usa el proyecto de referencia
          (Desktop/Gestor de Proyectos Editoriales/panhouse-gestor,
          ProyectoDetailPage.jsx), a pedido explícito del negocio de que
          "sea igual". Única diferencia real: allá el check sale de un
          booleano de completado por fase (fase1_ok...fase10_ok) porque
          ese stepper es de solo lectura; acá no existe ese booleano por
          fase (solo *Estatus de texto libre, no todas las fases tienen
          uno — Inicio no tiene) y el click sigue navegando entre
          secciones (pasoActivo), así que "completada" se resuelve como
          "ya la pasaste" (fase.id < pasoActivo) — decisión confirmada
          con el negocio en vez de inventar un mapeo de estatus por
          fase. Franja separada (hermana del hero oscuro, no anidada
          adentro) con su propio FULL_BLEED — mismo criterio que el
          hero de arriba para llegar de borde a borde de la pantalla. */}
      {proyectoQuery.data && puedeVerFicha && rol !== 'comercial' && rol !== 'rrpp' && (
        <div className={`${FULL_BLEED} bg-crema px-6 pb-4 pt-5 shadow-lg md:px-16`}>
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Progreso — {pasoActivo}/{FASES.length} fases
              </span>
              <span className="text-sm font-bold text-tinta">{Math.round(porcentaje)}%</span>
            </div>
            <div className="relative">
              <div className="absolute h-0.5 bg-gray-200" style={{ top: '14px', left: '5.5%', right: '5.5%' }} />
              <div
                className="absolute h-0.5 bg-dorado transition-all duration-700"
                style={{
                  top: '14px',
                  left: '5.5%',
                  width: pasoActivo <= 1 ? 0 : `${((pasoActivo - 2) / (FASES.length - 1)) * 89}%`,
                }}
              />
              <div className="relative z-10 flex">
                {FASES.map((fase) => {
                  const hecha = fase.id < pasoActivo;
                  const actual = fase.id === pasoActivo;
                  return (
                    <button
                      key={fase.id}
                      type="button"
                      onClick={() => setPasoActivo(fase.id)}
                      className="flex flex-1 flex-col items-center"
                    >
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                          hecha
                            ? 'bg-dorado text-white shadow-sm'
                            : actual
                              ? 'animate-pulse border-2 border-dorado bg-crema text-dorado shadow-md'
                              : 'border-2 border-gray-200 bg-crema text-gray-300'
                        }`}
                      >
                        {hecha ? (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 14 14">
                            <path
                              d="M2.5 7l3.5 3.5 5.5-6"
                              stroke="white"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          fase.id
                        )}
                      </div>
                      <span
                        className={`mt-1.5 text-center text-[10px] leading-tight ${
                          hecha ? 'text-gray-400' : actual ? 'font-semibold text-dorado' : 'text-gray-300'
                        }`}
                      >
                        <span className="block font-semibold">Fase {fase.id}</span>
                        <span className="block">{fase.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Equipo asignado — visible para el equipo interno, nunca para
          comercial ni rrpp (a pedido explícito del negocio: la
          asignación de especialista/editor/corrector/etc. no es tarea de
          rrpp). A diferencia del stepper de arriba, esta tarjeta es solo
          de asignación — ocultarla del todo no le bloquea ningún flujo a
          rrpp. */}
      {proyectoQuery.data && puedeVerFicha && rol !== 'comercial' && rol !== 'rrpp' && (
        <div className="mx-auto w-full max-w-7xl px-6 pt-12 md:px-16">
          <SeccionEquipo proyectoId={id} proyecto={proyectoQuery.data.proyecto} puedeEditar={rol === 'jefe_area'} />
        </div>
      )}

      {/* Lienzo de contenido — limpio, sin cajas redundantes */}
      {puedeVerFicha && (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-12 md:px-16">
          {fichaQuery.isLoading && <p className="text-tinta/70">Cargando ficha…</p>}
          {fichaQuery.isError && (
            <p role="alert" className="text-red-600">
              No se pudo cargar la ficha{fichaQuery.error instanceof Error ? `: ${fichaQuery.error.message}` : ''}.
            </p>
          )}

          {proyectoQuery.data && rol === 'comercial' && <FaseIngresoPointer proyectoId={id} />}

          {fichaQuery.data && proyectoQuery.data && rol !== 'comercial' && (
            <div key={pasoActivo} className="w-full animate-fade-in">
              {pasoActivo === 1 && <FaseIngresoPointer proyectoId={id} />}

              {/* Extracción / Creación de contenido / Feedback de contenido
                  (2-4): las 3 caras de una sola fase real (Edición) — ver
                  el comentario completo de FASES más arriba. Mismo
                  componente, mismos datos, en las 3 pestañas; el <div
                  key={pasoActivo}> que envuelve todo este bloque ya
                  fuerza un remount limpio al cambiar de pestaña, así que
                  no hace falta una key extra acá. */}
              {(pasoActivo === 2 || pasoActivo === 3 || pasoActivo === 4) && (
                <div className="w-full">
                  <SeccionEdicion proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={rol === 'especialista'} />
                </div>
              )}

              {pasoActivo === 5 && (
                <div className="flex w-full flex-col">
                  <SeccionCorreccionControl proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={rol === 'especialista'} />
                  <SeccionCorreccion proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={rol === 'especialista'} />
                </div>
              )}

              {pasoActivo === 6 && (
                <SeccionDisenoBrief
                  proyectoId={id}
                  proyecto={proyectoQuery.data.proyecto}
                  ficha={fichaQuery.data.ficha}
                  puedeEditar={rol === 'disenador' || rol === 'lider_creativo'}
                  rolUsuario={rol}
                />
              )}

              {pasoActivo === 7 && (
                <SeccionDiseno
                  proyectoId={id}
                  proyecto={proyectoQuery.data.proyecto}
                  ficha={fichaQuery.data.ficha}
                  puedeEditar={rol === 'disenador' || rol === 'lider_creativo'}
                  puedeEditarControl={
                    (rol === 'especialista' && proyectoQuery.data.proyecto.especialistaId === usuario?.id) ||
                    (rol === 'disenador' && proyectoQuery.data.proyecto.disenadorId === usuario?.id)
                  }
                  rolUsuario={rol}
                />
              )}

              {pasoActivo === 8 && (
                <SeccionCalidad
                  proyectoId={id}
                  ficha={fichaQuery.data.ficha}
                  puedeEditar={rol === 'soporte_editorial'}
                  puedeEditarControl={
                    (rol === 'especialista' && proyectoQuery.data.proyecto.especialistaId === usuario?.id) || rol === 'soporte_editorial'
                  }
                />
              )}

              {pasoActivo === 9 && (
                <SeccionSoporteDigital
                  proyectoId={id}
                  ficha={fichaQuery.data.ficha}
                  puedeEditar={rol === 'soporte_digital'}
                  puedeEditarControl={
                    (rol === 'especialista' && proyectoQuery.data.proyecto.especialistaId === usuario?.id) || rol === 'soporte_digital'
                  }
                />
              )}

              {/* Publicación (10): comprime Lanzamiento + Impresión +
                  Distribución — ver el comentario completo de FASES más
                  arriba. Se apilan las 3 secciones reales, sin fusionar
                  sus datos (mismo criterio que la Fase 1, que ya apila
                  Perfil + Ficha Editorial + Lanzamiento y Promoción). */}
              {pasoActivo === 10 && (
                <div className="flex w-full flex-col gap-6">
                  <SeccionLanzamiento
                    proyectoId={id}
                    ficha={fichaQuery.data.ficha}
                    puedeEditar={rol === 'rrpp'}
                    puedeEditarControl={
                      (rol === 'especialista' && proyectoQuery.data.proyecto.especialistaId === usuario?.id) || rol === 'rrpp'
                    }
                  />
                  <SeccionImpresion proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={rol === 'rrpp'} />
                  <SeccionDistribucion
                    proyectoId={id}
                    ficha={fichaQuery.data.ficha}
                    puedeEditar={rol === 'rrpp'}
                    puedeEditarControl={
                      (rol === 'especialista' && proyectoQuery.data.proyecto.especialistaId === usuario?.id) || rol === 'rrpp'
                    }
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
