import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { notificarJefatura } from '../jefatura/jefaturaApi';
import type { Pausa } from '../types/api';
import { BotonNotificarTransicion } from './BotonNotificarTransicion';
import { formatearFecha } from './campos';
import { CapituloRow } from './CapituloRow';
import { EstadoBadge } from './EstadoBadge';
import { EstadoTraspasoBadge } from './EstadoTraspasoBadge';
import { fetchCapitulos, fetchFicha, fetchPausas, fetchProyecto } from './proyectoDetalleApi';
import { RegistrarPausaForm } from './RegistrarPausaForm';
import { RiesgoBadge } from './RiesgoBadge';
import { SeccionCalidad } from './SeccionCalidad';
import { SeccionCorreccion } from './SeccionCorreccion';
import { SeccionCorreccionControl } from './SeccionCorreccionControl';
import { SeccionDiseno } from './SeccionDiseno';
import { SeccionDistribucion } from './SeccionDistribucion';
import { SeccionEdicion } from './SeccionEdicion';
import { SeccionEquipo } from './SeccionEquipo';
import { SeccionFichaEditorial } from './SeccionFichaEditorial';
import { SeccionImpresion } from './SeccionImpresion';
import { SeccionLanzamiento } from './SeccionLanzamiento';
import { SeccionLanzamientoPromocion } from './SeccionLanzamientoPromocion';
import { SeccionProyectoPerfil } from './SeccionProyectoPerfil';
import { SeccionSoporteDigital } from './SeccionSoporteDigital';

const CAUSA_LABEL: Record<Pausa['causa'], string> = {
  autor: 'Autor',
  otro_departamento: 'Otro departamento',
};

const FASES = [
  { id: 1, label: 'Inicio' },
  { id: 2, label: 'Edición' },
  { id: 3, label: 'Corrección' },
  { id: 4, label: 'Diseño' },
  { id: 5, label: 'Calidad' },
  { id: 6, label: 'Digital' },
  { id: 7, label: 'Lanzamiento' },
  { id: 8, label: 'Impresión' },
  { id: 9, label: 'Distribución' },
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
  const puedeVerCapitulos = rol === 'jefe_area' || rol === 'especialista' || rol === 'editor';
  const puedeVerPausas = rol === 'jefe_area' || rol === 'especialista';
  // puedeEditarPerfil (más amplio, incluye rrpp) sigue gateando si el
  // formulario se ve como <form> editable vs. resumen de solo lectura —
  // dentro de ese formulario, puedeEditarComercial (más angosto, sin
  // rrpp) decide campo por campo qué se ve como <select>/<input> real y
  // qué como texto estático (a pedido explícito del negocio: rrpp veía
  // los campos comerciales como editables, cuando debían ser de solo
  // lectura — solo "Observaciones" y el nuevo subtipo de Crudo son
  // editables para rrpp, ver SeccionProyectoPerfil.tsx). Mismo alcance
  // que el guard de PATCH /api/proyectos/:id/reasignar en el backend
  // (requireRole('comercial', 'jefe_area')) — sin este permiso aparte,
  // SeccionProyectoPerfil.tsx dispararía esa mutación igual para rrpp y
  // el backend la rechazaría con 403 en cada Guardar.
  const puedeEditarPerfil = rol === 'comercial' || rol === 'rrpp' || rol === 'jefe_area';
  const puedeEditarContrato = rol === 'comercial';
  const puedeEditarComercial = rol === 'comercial' || rol === 'jefe_area';
  // Comercial es dueño del traspaso a RRPP (el botón "Enviar a RRPP" en
  // SeccionProyectoPerfil.tsx) — mismo alcance que el antiguo botón
  // separado "Notificar a RRPP" que reemplaza, ahora fusionado al
  // guardado del formulario en vez de vivir aparte.
  const puedeNotificarRrpp = rol === 'comercial';
  // "Ficha Editorial (Completado por RRPP)" — dueño rrpp/jefe_area, al
  // revés de puedeEditarComercial de arriba: acá comercial es quien ve
  // la sección en modo lectura. Mismo alcance que el guard de PATCH
  // /api/fichas-trazabilidad/:id/ficha-editorial en el backend
  // (requireRole('rrpp', 'jefe_area')).
  const puedeEditarFichaEditorial = rol === 'rrpp' || rol === 'jefe_area';
  // "Proceso de Lanzamiento y Promoción" — mismo alcance que
  // puedeEditarFichaEditorial (rrpp/jefe_area editan, comercial ve de
  // solo lectura). Constante propia, mismo criterio que el resto de
  // "Área exclusiva de RRPP".
  const puedeEditarLanzamientoPromocion = rol === 'rrpp' || rol === 'jefe_area';

  const proyectoQuery = useQuery({ queryKey: ['proyecto', id], queryFn: () => fetchProyecto(id) });
  const fichaQuery = useQuery({ queryKey: ['ficha', id], queryFn: () => fetchFicha(id), enabled: puedeVerFicha });
  const capitulosQuery = useQuery({ queryKey: ['capitulos', id], queryFn: () => fetchCapitulos(id), enabled: puedeVerCapitulos });
  const pausasQuery = useQuery({ queryKey: ['pausas', id], queryFn: () => fetchPausas(id), enabled: puedeVerPausas });

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
                  cascada de notificaciones, ver BotonNotificarTransicion
                  más abajo), no una columna nueva: evita un segundo campo
                  "estado" en la misma tabla que el de arriba (operativo,
                  en_proceso/retrasado/etc.), que ya se usa en riesgo/carga
                  y no tiene relación con este traspaso. */}
              <EstadoTraspasoBadge
                notificadoRrpp={proyectoQuery.data.proyecto.notificadoRrpp}
                notificadoJefatura={proyectoQuery.data.proyecto.notificadoJefatura}
              />
              <RiesgoBadge riesgo={proyectoQuery.data.proyecto.riesgo} />
            </div>
          </div>

          {/* El progreso (gigante) — Master Stepper exclusivo de producción,
              oculto para comercial Y para rrpp. rrpp perdió acceso de UI a
              Lanzamiento/Impresión/Distribución (fases 7-9) a pedido
              explícito del negocio: su entorno queda limitado a esta vista
              central (Fase 1 — Perfil/Ficha Editorial/Matriz de Ingreso/
              Lanzamiento y Promoción), confirmado aunque esos permisos de
              edición sigan existiendo en el backend (PATCH .../impresion,
              .../distribucion-control, .../lanzamiento-control siguen
              aceptando rrpp — decisión deliberada, no un descuido: si esas
              pantallas dejan de ser necesarias del todo, revisar también
              esos guards). */}
          {puedeVerFicha && rol !== 'comercial' && rol !== 'rrpp' && (
            <div className="mt-4">
              <div className="mb-6 mt-8">
                <span className="text-sm font-bold uppercase tracking-[0.2em] text-dorado">
                  Fase {pasoActivo} de {FASES.length}
                </span>
                <h2 className="mt-2 text-4xl font-light tracking-tight text-white md:text-5xl">{faseActual?.label}</h2>
              </div>
              <div className="mb-8 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-dorado to-green-500 shadow-[0_0_15px_rgba(74,222,128,0.3)] transition-all duration-1000 ease-out"
                  style={{ width: `${porcentaje}%` }}
                />
              </div>

              {/* Navegación integrada al hero — píldoras de cristal */}
              <div className="hide-scrollbar mt-2 flex w-full gap-3 overflow-x-auto pb-4">
                {FASES.map((fase) => {
                  const isActive = pasoActivo === fase.id;
                  return (
                    <button
                      key={fase.id}
                      type="button"
                      onClick={() => setPasoActivo(fase.id)}
                      className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'border border-white/5 bg-white/10 text-white shadow-lg backdrop-blur-sm'
                          : 'text-white/50 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {fase.id}. {fase.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Escuadrón de Producción — visible para el equipo interno, nunca
          para comercial ni rrpp (a pedido explícito del negocio: la
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

          {fichaQuery.data && proyectoQuery.data && rol === 'comercial' && (
            <div className="flex w-full flex-col gap-6">
              {/* key={id}: sin esto, React no vuelve a montar este
                  componente al navegar de un proyecto a otro sin recarga
                  completa (misma ruta /proyectos/:id, solo cambia el
                  param) — todo su estado local (servicioCodigo,
                  ingresoServicioSubtipoCrudo, etc., inicializado una sola
                  vez vía useState(prop)) se quedaba pegado al proyecto
                  anterior, mostrando datos de OTRO proyecto (ej. el
                  selector de "Especificación de Crudo" no aparecía al
                  entrar a un proyecto Crudo si el anterior no lo era) —
                  y un Guardar en ese estado podía sobreescribir el
                  proyecto actual con datos del anterior. */}
              <SeccionProyectoPerfil
                key={id}
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
              {/* "Área exclusiva de RRPP" — a pedido explícito del negocio,
                  separación visual clara entre la Ficha de Trazabilidad de
                  Comercial (arriba, SeccionProyectoPerfil) y la Ficha
                  Editorial, que pertenece a rrpp: acá comercial solo mira
                  (puedeEditarFichaEditorial ya resuelve el modo lectura
                  dentro de la sección), sin botón de traspaso — ese es
                  exclusivo de la rama rol==='rrpp' más abajo. La Matriz de
                  Ingreso ya NO vive acá: se extrajo a su propio módulo
                  (/rrpp/matriz/:proyectoId, ver MatrizIngresoPage.tsx),
                  accesible desde el inicio de rrpp — a pedido explícito del
                  negocio, para que quede fuera de la vista unificada del
                  proyecto. */}
              <div className="rounded-xl border-2 border-purple-300 bg-purple-50/40 p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <span className="rounded-full bg-purple-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                    RRPP
                  </span>
                  <h2 className="text-base font-bold text-purple-900">Área exclusiva de RRPP</h2>
                </div>
                <div className="flex flex-col gap-6">
                  <SeccionFichaEditorial key={id} proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={puedeEditarFichaEditorial} />
                  <SeccionLanzamientoPromocion
                    key={id}
                    proyectoId={id}
                    ficha={fichaQuery.data.ficha}
                    puedeEditar={puedeEditarLanzamientoPromocion}
                  />
                </div>
              </div>
            </div>
          )}

          {fichaQuery.data && proyectoQuery.data && rol !== 'comercial' && (
            <div key={pasoActivo} className="w-full animate-fade-in">
              {pasoActivo === 1 && (
                <div className="flex w-full flex-col gap-6">
                  {/* key={id}: ver el comentario en el otro uso de este
                      componente más arriba (rama comercial). */}
                  <SeccionProyectoPerfil
                    key={id}
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
                  {/* "Área exclusiva de RRPP" — ver el comentario completo
                      en el otro uso de este bloque más arriba (rama
                      comercial). El botón de traspaso "Mandar a Jefatura"
                      cierra la Ficha Editorial — misma lógica de siempre
                      (notificadoJefatura, POST /:id/notificar-jefatura,
                      inserción en notificaciones), solo cambió dónde vive. */}
                  <div className="rounded-xl border-2 border-purple-300 bg-purple-50/40 p-4 sm:p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <span className="rounded-full bg-purple-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                        RRPP
                      </span>
                      <h2 className="text-base font-bold text-purple-900">Área exclusiva de RRPP</h2>
                    </div>
                    <SeccionFichaEditorial
                      key={id}
                      proyectoId={id}
                      ficha={fichaQuery.data.ficha}
                      puedeEditar={puedeEditarFichaEditorial}
                    />
                    <div className="mt-6">
                      <SeccionLanzamientoPromocion
                        key={id}
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
                </div>
              )}

              {pasoActivo === 2 && (
                <div className="w-full">
                  <SeccionEdicion proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={rol === 'especialista'} />

                  <h3 className="mb-4 text-lg font-bold text-tinta">2. Edición</h3>
                  {capitulosQuery.data ? (
                    <p className="text-sm text-tinta">
                      {capitulosQuery.data.capitulos.length} capítulo{capitulosQuery.data.capitulos.length === 1 ? '' : 's'} registrado
                      {capitulosQuery.data.capitulos.length === 1 ? '' : 's'} — ver detalle en "Capítulos" más abajo.
                    </p>
                  ) : (
                    <p className="text-sm italic text-tinta/50">Sin completar</p>
                  )}
                </div>
              )}

              {pasoActivo === 3 && (
                <div className="flex w-full flex-col">
                  <SeccionCorreccionControl proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={rol === 'especialista'} />
                  <SeccionCorreccion proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={rol === 'especialista'} />
                </div>
              )}

              {pasoActivo === 4 && (
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

              {pasoActivo === 5 && (
                <SeccionCalidad
                  proyectoId={id}
                  ficha={fichaQuery.data.ficha}
                  puedeEditar={rol === 'soporte_editorial'}
                  puedeEditarControl={
                    (rol === 'especialista' && proyectoQuery.data.proyecto.especialistaId === usuario?.id) ||
                    (rol === 'soporte_editorial' && proyectoQuery.data.proyecto.calidadId === usuario?.id)
                  }
                />
              )}

              {pasoActivo === 6 && (
                <SeccionSoporteDigital
                  proyectoId={id}
                  ficha={fichaQuery.data.ficha}
                  puedeEditar={rol === 'soporte_digital'}
                  puedeEditarControl={
                    (rol === 'especialista' && proyectoQuery.data.proyecto.especialistaId === usuario?.id) ||
                    (rol === 'soporte_digital' && proyectoQuery.data.proyecto.digitalId === usuario?.id)
                  }
                />
              )}

              {pasoActivo === 7 && (
                <SeccionLanzamiento
                  proyectoId={id}
                  ficha={fichaQuery.data.ficha}
                  puedeEditar={rol === 'rrpp'}
                  puedeEditarControl={
                    (rol === 'especialista' && proyectoQuery.data.proyecto.especialistaId === usuario?.id) ||
                    (rol === 'rrpp' && proyectoQuery.data.proyecto.lanzamientoId === usuario?.id)
                  }
                />
              )}

              {pasoActivo === 8 && (
                <SeccionImpresion proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={rol === 'rrpp' || rol === 'jefe_area'} />
              )}

              {pasoActivo === 9 && (
                <SeccionDistribucion
                  proyectoId={id}
                  ficha={fichaQuery.data.ficha}
                  puedeEditar={rol === 'rrpp'}
                  puedeEditarControl={
                    (rol === 'especialista' && proyectoQuery.data.proyecto.especialistaId === usuario?.id) ||
                    (rol === 'rrpp' && proyectoQuery.data.proyecto.distribucionId === usuario?.id)
                  }
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Capítulos */}
      {puedeVerCapitulos && (
        <section className="mx-auto w-full max-w-7xl px-6 pb-12 md:px-16">
          <h2 className="mb-3 text-base font-semibold text-tinta">Capítulos</h2>

          {capitulosQuery.isLoading && <p className="text-tinta/70">Cargando capítulos…</p>}
          {capitulosQuery.isError && (
            <p role="alert" className="text-red-600">
              No se pudieron cargar los capítulos{capitulosQuery.error instanceof Error ? `: ${capitulosQuery.error.message}` : ''}.
            </p>
          )}
          {capitulosQuery.data && capitulosQuery.data.capitulos.length === 0 && (
            <p className="text-tinta/70">Todavía no hay capítulos registrados.</p>
          )}
          {capitulosQuery.data && capitulosQuery.data.capitulos.length > 0 && (
            <ul className="space-y-2">
              {capitulosQuery.data.capitulos.map((capitulo) => (
                <CapituloRow
                  key={capitulo.id}
                  proyectoId={id}
                  capitulo={capitulo}
                  puedeEditarAutor={rol === 'especialista'}
                  puedeEditarEditor={rol === 'editor'}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Pausas */}
      {puedeVerPausas && (
        <section className="mx-auto w-full max-w-7xl px-6 pb-12 md:px-16">
          <h2 className="mb-3 text-base font-semibold text-tinta">Pausas</h2>

          {pausasQuery.isLoading && <p className="text-tinta/70">Cargando pausas…</p>}
          {pausasQuery.isError && (
            <p role="alert" className="text-red-600">
              No se pudieron cargar las pausas{pausasQuery.error instanceof Error ? `: ${pausasQuery.error.message}` : ''}.
            </p>
          )}
          {pausasQuery.data && pausasQuery.data.pausas.length === 0 && <p className="mb-3 text-tinta/70">No hay pausas registradas.</p>}
          {pausasQuery.data && pausasQuery.data.pausas.length > 0 && (
            <ul className="mb-3 space-y-2">
              {pausasQuery.data.pausas.map((pausa) => (
                <li key={pausa.id} className="rounded-lg border border-tinta/10 bg-white p-3 text-sm shadow-sm">
                  <span className="font-medium text-tinta">{CAUSA_LABEL[pausa.causa]}</span>
                  <span className="ml-3 text-tinta/70">
                    {formatearFecha(pausa.fechaInicio)} — {pausa.fechaFin ? formatearFecha(pausa.fechaFin) : 'en curso'}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-medium text-tinta">Registrar pausa</h3>
            <RegistrarPausaForm proyectoId={id} />
          </div>
        </section>
      )}
    </div>
  );
}
