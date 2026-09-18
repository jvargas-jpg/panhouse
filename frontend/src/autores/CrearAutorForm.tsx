import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import type { Autor, CategoriaCliente, RedesSociales } from '../types/api';
import { crearAutor, editarAutor } from './autoresApi';
import { CODIGOS_UNICOS } from './codigosTelefonicos';
import { EtiquetasCorreos } from './EtiquetasCorreos';
import { EtiquetasPersonalidad } from './EtiquetasPersonalidad';
import { PAISES } from './paises';
import { SelectorCodigoTelefonico } from './SelectorCodigoTelefonico';
import { SelectorMultipleNacionalidades } from './SelectorMultipleNacionalidades';

const LABEL_CLASS = 'mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-wide text-gray-500';
const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40';

const CODIGO_POR_DEFECTO = '+58';

// El backend sigue guardando un solo string (telefono no cambió en la
// base de datos, a propósito, para no requerir otra migración) — este
// componente es el único que sabe que ese string es, en realidad,
// "código + número". construirTelefono junta las dos partes al guardar;
// parseTelefono las separa de nuevo al precargar el formulario de edición.
function construirTelefono(codigo: string, numero: string): string | undefined {
  const numeroLimpio = numero.replace(/[^0-9]/g, '');
  if (!numeroLimpio) return undefined;
  return `${codigo}${numeroLimpio}`;
}

// Dato legado: cualquier autor guardado antes de dividir este campo
// tiene el teléfono completo en un solo string, con o sin "+código"
// (el regex del backend siempre permitió ambos). Se prueban los códigos
// de más largo a más corto (CODIGOS_UNICOS) para no cortar de más; si
// no matchea ninguno (nunca tuvo código, o no empieza con "+"), se dejan
// todos los dígitos en "número" con el código por defecto preseleccionado,
// en vez de perder el dato o adivinar mal.
function parseTelefono(telefono: string | null): { codigo: string; numero: string } {
  if (!telefono) return { codigo: CODIGO_POR_DEFECTO, numero: '' };

  if (telefono.startsWith('+')) {
    const codigo = CODIGOS_UNICOS.find((candidato) => telefono.startsWith(candidato));
    if (codigo) {
      return { codigo, numero: telefono.slice(codigo.length).replace(/[^0-9]/g, '') };
    }
  }

  return { codigo: CODIGO_POR_DEFECTO, numero: telefono.replace(/[^0-9]/g, '') };
}

interface CamposRedes {
  instagram: string;
  x: string;
  facebook: string;
  linkedin: string;
  tiktok: string;
  youtube: string;
}

const REDES_VACIAS: CamposRedes = { instagram: '', x: '', facebook: '', linkedin: '', tiktok: '', youtube: '' };

// Solo incluye las plataformas con algo escrito — mismo criterio que el
// resto del formulario (los campos vacíos se omiten al crear, o se
// mandan explícitamente en null al editar, nunca como string vacío).
function construirRedesSociales(campos: CamposRedes): RedesSociales | undefined {
  const entradas = Object.entries(campos).filter(([, valor]) => valor.trim() !== '');
  if (entradas.length === 0) return undefined;
  return Object.fromEntries(entradas.map(([clave, valor]) => [clave, valor.trim()])) as RedesSociales;
}

function redesDesdeAutor(redesSociales: RedesSociales | null): CamposRedes {
  return {
    instagram: redesSociales?.instagram ?? '',
    x: redesSociales?.x ?? '',
    facebook: redesSociales?.facebook ?? '',
    linkedin: redesSociales?.linkedin ?? '',
    tiktok: redesSociales?.tiktok ?? '',
    youtube: redesSociales?.youtube ?? '',
  };
}

// Alta y edición de autor. comercial y dirección son los únicos roles
// con permiso de escritura (ver ROLES_ESCRITURA_AUTORES en
// server/routes/autores.routes.ts). Vive dentro del modal "Registrar/
// Editar Autor" de AutoresPage.tsx — el título y la tarjeta ya los pone
// <Modal/>, este componente solo devuelve el <form>.
//
// autorEnEdicion === null → crear (POST); autorEnEdicion !== null →
// editar (PATCH /autores/:id) precargado con sus datos actuales.
// AutoresPage.tsx remonta este modal cada vez que se abre (no cambia
// autorEnEdicion en caliente con el modal ya abierto), pero el useEffect
// deja el pre-llenado explícito igual, en vez de depender solo del
// useState inicial.
export function CrearAutorForm({
  autorEnEdicion,
  onGuardado,
}: {
  autorEnEdicion: Autor | null;
  onGuardado: (mensaje: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [nombreArtistico, setNombreArtistico] = useState('');
  const [categoria, setCategoria] = useState<CategoriaCliente>('Estándar');
  const [email, setEmail] = useState<string[]>([]);
  const [telefonoCodigo, setTelefonoCodigo] = useState(CODIGO_POR_DEFECTO);
  const [telefonoNumero, setTelefonoNumero] = useState('');
  const [pais, setPais] = useState('');
  const [nacionalidad, setNacionalidad] = useState<string[]>([]);
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [redes, setRedes] = useState<CamposRedes>(REDES_VACIAS);
  const [personalidad, setPersonalidad] = useState<string[]>([]);
  const [ocupacion, setOcupacion] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    setNombre(autorEnEdicion?.nombre ?? '');
    setNombreArtistico(autorEnEdicion?.nombreArtistico ?? '');
    setCategoria(autorEnEdicion?.categoria ?? 'Estándar');
    setEmail(autorEnEdicion?.email ?? []);
    const telefonoParseado = parseTelefono(autorEnEdicion?.telefono ?? null);
    setTelefonoCodigo(telefonoParseado.codigo);
    setTelefonoNumero(telefonoParseado.numero);
    setPais(autorEnEdicion?.pais ?? '');
    setNacionalidad(autorEnEdicion?.nacionalidad ?? []);
    setFechaNacimiento(autorEnEdicion?.fechaNacimiento ?? '');
    setRedes(redesDesdeAutor(autorEnEdicion?.redesSociales ?? null));
    setPersonalidad(autorEnEdicion?.personalidad ?? []);
    setOcupacion(autorEnEdicion?.ocupacion ?? '');
  }, [autorEnEdicion]);

  function limpiarFormulario() {
    setNombre('');
    setNombreArtistico('');
    setCategoria('Estándar');
    setEmail([]);
    setTelefonoCodigo(CODIGO_POR_DEFECTO);
    setTelefonoNumero('');
    setPais('');
    setNacionalidad([]);
    setFechaNacimiento('');
    setRedes(REDES_VACIAS);
    setPersonalidad([]);
    setOcupacion('');
  }

  function actualizarRed(campo: keyof CamposRedes, valor: string) {
    setRedes((actual) => ({ ...actual, [campo]: valor }));
    mutacion.reset();
  }

  const mutacionCrear = useMutation({
    mutationFn: () =>
      crearAutor({
        nombre,
        nombreArtistico: nombreArtistico || undefined,
        categoria,
        email: email.length > 0 ? email : undefined,
        telefono: construirTelefono(telefonoCodigo, telefonoNumero),
        pais: pais || undefined,
        nacionalidad: nacionalidad.length > 0 ? nacionalidad : undefined,
        fechaNacimiento: fechaNacimiento || undefined,
        redesSociales: construirRedesSociales(redes),
        personalidad: personalidad.length > 0 ? personalidad : undefined,
        ocupacion: ocupacion || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autores'] });
      limpiarFormulario();
      onGuardado('Autor creado exitosamente');
    },
  });

  const mutacionEditar = useMutation({
    mutationFn: () =>
      editarAutor(autorEnEdicion!.id, {
        nombre,
        nombreArtistico: nombreArtistico || null,
        categoria,
        email: email.length > 0 ? email : null,
        telefono: construirTelefono(telefonoCodigo, telefonoNumero) ?? null,
        pais: pais || null,
        nacionalidad: nacionalidad.length > 0 ? nacionalidad : null,
        fechaNacimiento: fechaNacimiento || null,
        redesSociales: construirRedesSociales(redes) ?? null,
        personalidad: personalidad.length > 0 ? personalidad : null,
        ocupacion: ocupacion || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autores'] });
      onGuardado('Autor editado exitosamente');
    },
  });

  const mutacion = autorEnEdicion ? mutacionEditar : mutacionCrear;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    // flex-col de tres pisos, sin sticky: Modal.tsx ya entrega un slot
    // acotado en alto (flex-1 min-h-0, sin su propio scroll) — este
    // <form> se estira para llenarlo (flex-1 min-h-0, mismo criterio) y
    // reparte adentro cuerpo scrolleable + footer fijo. Ver el
    // comentario de Modal.tsx para el porqué del cambio (sticky
    // bottom-0 flotaba a mitad del formulario en la práctica, en vez de
    // quedar anclado abajo).
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div>
          <label htmlFor="autor-nombre" className={LABEL_CLASS}>
            Nombre Completo
          </label>
          <input
            id="autor-nombre"
            type="text"
            required
            value={nombre}
            onChange={(event) => {
              setNombre(event.target.value);
              mutacion.reset();
            }}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="autor-categoria" className={LABEL_CLASS}>
            Categoría
          </label>
          <select
            id="autor-categoria"
            value={categoria}
            onChange={(event) => {
              setCategoria(event.target.value as CategoriaCliente);
              mutacion.reset();
            }}
            className={INPUT_CLASS}
          >
            <option value="Estándar">Estándar</option>
            <option value="VIP">VIP</option>
          </select>
        </div>

        <div>
          <label htmlFor="autor-email-entrada" className={LABEL_CLASS}>
            Correo
          </label>
          <EtiquetasCorreos
            value={email}
            onChange={(correos) => {
              setEmail(correos);
              mutacion.reset();
            }}
          />
        </div>

        <div>
          <label htmlFor="autor-telefono-numero" className={LABEL_CLASS}>
            Teléfono
          </label>
          <div className="flex gap-2">
            <SelectorCodigoTelefonico
              value={telefonoCodigo}
              onChange={(codigo) => {
                setTelefonoCodigo(codigo);
                mutacion.reset();
              }}
            />
            <input
              id="autor-telefono-numero"
              type="tel"
              inputMode="tel"
              placeholder="424-1495423"
              value={telefonoNumero}
              onChange={(event) => {
                // Bloqueo activo: cualquier carácter que no sea dígito,
                // guion o espacio se descarta antes de llegar al estado —
                // cubre teclado, autocompletar y pegar (a diferencia de
                // interceptar onKeyDown, que solo detiene teclas
                // físicas). El "+" ya no aplica acá (vive en el select de
                // código); construirTelefono limpia guiones/espacios al
                // armar el payload.
                setTelefonoNumero(event.target.value.replace(/[^0-9\-\s]/g, ''));
                mutacion.reset();
              }}
              className={`${INPUT_CLASS} flex-1`}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">Omite el 0 inicial de tu operadora</p>
        </div>

        <div>
          <label htmlFor="autor-nombre-artistico" className={LABEL_CLASS}>
            Nombre artístico
          </label>
          <input
            id="autor-nombre-artistico"
            type="text"
            value={nombreArtistico}
            onChange={(event) => {
              setNombreArtistico(event.target.value);
              mutacion.reset();
            }}
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="autor-pais" className={LABEL_CLASS}>
              País de ubicación
            </label>
            <select
              id="autor-pais"
              value={pais}
              onChange={(event) => {
                setPais(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {PAISES.map((nombrePais) => (
                <option key={nombrePais} value={nombrePais}>
                  {nombrePais}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="autor-nacionalidad" className={LABEL_CLASS}>
              Nacionalidad
            </label>
            <SelectorMultipleNacionalidades
              value={nacionalidad}
              onChange={(nacionalidades) => {
                setNacionalidad(nacionalidades);
                mutacion.reset();
              }}
            />
          </div>
        </div>

        <div>
          <label htmlFor="autor-fecha-nacimiento" className={LABEL_CLASS}>
            Fecha de nacimiento
          </label>
          <input
            id="autor-fecha-nacimiento"
            type="date"
            value={fechaNacimiento}
            onChange={(event) => {
              setFechaNacimiento(event.target.value);
              mutacion.reset();
            }}
            className={INPUT_CLASS}
          />
        </div>

        <p className={LABEL_CLASS}>Redes sociales</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="autor-red-x" className="mb-1.5 block text-xs text-gray-500">
              X (Twitter)
            </label>
            <input
              id="autor-red-x"
              type="text"
              placeholder="@usuario"
              value={redes.x}
              onChange={(event) => actualizarRed('x', event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="autor-red-instagram" className="mb-1.5 block text-xs text-gray-500">
              Instagram
            </label>
            <input
              id="autor-red-instagram"
              type="text"
              placeholder="@usuario"
              value={redes.instagram}
              onChange={(event) => actualizarRed('instagram', event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="autor-red-facebook" className="mb-1.5 block text-xs text-gray-500">
              Facebook
            </label>
            <input
              id="autor-red-facebook"
              type="text"
              value={redes.facebook}
              onChange={(event) => actualizarRed('facebook', event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="autor-red-linkedin" className="mb-1.5 block text-xs text-gray-500">
              LinkedIn
            </label>
            <input
              id="autor-red-linkedin"
              type="text"
              value={redes.linkedin}
              onChange={(event) => actualizarRed('linkedin', event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="autor-red-tiktok" className="mb-1.5 block text-xs text-gray-500">
              TikTok
            </label>
            <input
              id="autor-red-tiktok"
              type="text"
              placeholder="@usuario"
              value={redes.tiktok}
              onChange={(event) => actualizarRed('tiktok', event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="autor-red-youtube" className="mb-1.5 block text-xs text-gray-500">
              YouTube
            </label>
            <input
              id="autor-red-youtube"
              type="text"
              value={redes.youtube}
              onChange={(event) => actualizarRed('youtube', event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div>
          <label htmlFor="autor-personalidad-entrada" className={LABEL_CLASS}>
            Personalidad
          </label>
          <EtiquetasPersonalidad
            value={personalidad}
            onChange={(etiquetas) => {
              setPersonalidad(etiquetas);
              mutacion.reset();
            }}
          />
        </div>

        <div>
          <label htmlFor="autor-ocupacion" className={LABEL_CLASS}>
            ¿A qué se dedica?
          </label>
          <textarea
            id="autor-ocupacion"
            rows={3}
            value={ocupacion}
            onChange={(event) => {
              setOcupacion(event.target.value);
              mutacion.reset();
            }}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {/* flex-none: fuera del <div> scrolleable de arriba, así que nunca
          se mueve con el contenido ni depende de sticky para quedar
          anclado — siempre es lo último pintado, a ras del fondo de la
          tarjeta del modal. */}
      <div className="flex-none border-t border-gray-200 bg-white p-4">
        <button
          type="submit"
          disabled={mutacion.isPending}
          className="w-full rounded-lg bg-tinta py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
        >
          {mutacion.isPending ? 'Guardando…' : autorEnEdicion ? 'Guardar Cambios' : 'Crear Autor'}
        </button>
        {mutacion.isError && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            No se pudo guardar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
          </p>
        )}
      </div>
    </form>
  );
}
