import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import type { Pausa } from '../types/api';
import { formatearFecha } from './campos';
import { CapituloRow } from './CapituloRow';
import { EstadoBadge } from './EstadoBadge';
import { fetchCapitulos, fetchFicha, fetchPausas, fetchProyecto } from './proyectoDetalleApi';
import { RegistrarPausaForm } from './RegistrarPausaForm';
import { RiesgoBadge } from './RiesgoBadge';
import { SeccionCalidad } from './SeccionCalidad';
import { SeccionCorreccion } from './SeccionCorreccion';
import { SeccionDiseno } from './SeccionDiseno';
import { SeccionDistribucion } from './SeccionDistribucion';
import { SeccionLanzamiento } from './SeccionLanzamiento';
import { SeccionProyectoContrato } from './SeccionProyectoContrato';
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
  { id: 8, label: 'Distribución' },
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
  const puedeEditarPerfil = rol === 'comercial' || rol === 'rrpp' || rol === 'jefe_area';
  const puedeEditarContrato = rol === 'comercial';

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

      {/* Hero Header — de lado a lado, degradado oscuro moderno */}
      {proyectoQuery.data && (
        <div
          className={`${FULL_BLEED} relative overflow-hidden bg-gradient-to-b from-gray-900 to-black px-6 pb-2 pt-10 text-white shadow-lg md:px-16`}
        >
          <Link to="/" className="text-sm text-white/60 hover:text-white hover:underline">
            ← Mis proyectos
          </Link>

          <h1 className="mb-2 mt-6 text-3xl font-light text-white">{proyectoQuery.data.proyecto.autor.nombre}</h1>
          <p className="text-sm text-white/70">
            {proyectoQuery.data.proyecto.servicio.nombre} ({proyectoQuery.data.proyecto.servicio.codigo})
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 pb-6">
            <EstadoBadge estado={proyectoQuery.data.proyecto.estado} />
            <RiesgoBadge riesgo={proyectoQuery.data.proyecto.riesgo} />
          </div>

          {/* El progreso (gigante) — Master Stepper exclusivo de producción, oculto para comercial */}
          {puedeVerFicha && rol !== 'comercial' && (
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
              <SeccionProyectoPerfil
                proyectoId={id}
                ficha={fichaQuery.data.ficha}
                titulo={proyectoQuery.data.proyecto.titulo}
                puedeEditar={puedeEditarPerfil}
              />
              <SeccionProyectoContrato proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={puedeEditarContrato} />
            </div>
          )}

          {fichaQuery.data && proyectoQuery.data && rol !== 'comercial' && (
            <div key={pasoActivo} className="w-full animate-fade-in">
              {pasoActivo === 1 && (
                <div className="flex w-full flex-col gap-6">
                  <SeccionProyectoPerfil
                    proyectoId={id}
                    ficha={fichaQuery.data.ficha}
                    titulo={proyectoQuery.data.proyecto.titulo}
                    puedeEditar={puedeEditarPerfil}
                  />
                  <SeccionProyectoContrato proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={puedeEditarContrato} />
                </div>
              )}

              {pasoActivo === 2 && (
                <div className="w-full">
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

              {pasoActivo === 3 && <SeccionCorreccion proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={rol === 'especialista'} />}

              {pasoActivo === 4 && (
                <SeccionDiseno
                  proyectoId={id}
                  proyecto={proyectoQuery.data.proyecto}
                  ficha={fichaQuery.data.ficha}
                  puedeEditar={rol === 'disenador' || rol === 'lider_creativo'}
                  rolUsuario={rol}
                />
              )}

              {pasoActivo === 5 && <SeccionCalidad proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={rol === 'soporte_editorial'} />}

              {pasoActivo === 6 && (
                <SeccionSoporteDigital proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={rol === 'soporte_digital'} />
              )}

              {pasoActivo === 7 && <SeccionLanzamiento proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={rol === 'rrpp'} />}

              {pasoActivo === 8 && <SeccionDistribucion proyectoId={id} ficha={fichaQuery.data.ficha} puedeEditar={rol === 'rrpp'} />}
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
