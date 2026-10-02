import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import type { Autor, CategoriaCliente } from '../types/api';
import { AuthorFormSectionNav } from './AuthorFormSectionNav';
import { AuthorProfileSection } from './AuthorProfileSection';
import { ContactSection } from './ContactSection';
import { PersonalInfoSection } from './PersonalInfoSection';
import { SocialNetworksSection } from './SocialNetworksSection';
import type { SeccionAutorForm } from './authorFormSecciones';
import { crearAutor, editarAutor } from './autoresApi';
import { CODIGOS_UNICOS } from './codigosTelefonicos';
import { filasDesdeRedesSociales, redesSocialesDesdeFilas, type FilaRedSocial } from './redesSocialesForm';

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

// Estado centralizado del formulario — un solo objeto en vez de una
// docena de useState sueltos, para que las 4 secciones (Personal/
// Contacto/Redes/Perfil) puedan vivir en componentes aparte sin
// arrastrar 12 pares value/onChange cada una: cada sección recibe su
// porción y un único `onCambiar(patch)` que hace merge sobre este objeto.
interface EstadoFormularioAutor {
  nombre: string;
  nombreArtistico: string;
  categoria: CategoriaCliente;
  email: string[];
  telefonoCodigo: string;
  telefonoNumero: string;
  pais: string;
  nacionalidad: string[];
  fechaNacimiento: string;
  redesFilas: FilaRedSocial[];
  personalidad: string[];
  ocupacion: string;
}

const ESTADO_VACIO: EstadoFormularioAutor = {
  nombre: '',
  nombreArtistico: '',
  categoria: 'Estándar',
  email: [],
  telefonoCodigo: CODIGO_POR_DEFECTO,
  telefonoNumero: '',
  pais: '',
  nacionalidad: [],
  fechaNacimiento: '',
  redesFilas: [],
  personalidad: [],
  ocupacion: '',
};

function estadoDesdeAutor(autor: Autor | null): EstadoFormularioAutor {
  if (!autor) return ESTADO_VACIO;
  const telefonoParseado = parseTelefono(autor.telefono);
  return {
    nombre: autor.nombre,
    nombreArtistico: autor.nombreArtistico ?? '',
    categoria: autor.categoria,
    email: autor.email ?? [],
    telefonoCodigo: telefonoParseado.codigo,
    telefonoNumero: telefonoParseado.numero,
    pais: autor.pais ?? '',
    nacionalidad: autor.nacionalidad ?? [],
    fechaNacimiento: autor.fechaNacimiento ?? '',
    redesFilas: filasDesdeRedesSociales(autor.redesSociales),
    personalidad: autor.personalidad ?? [],
    ocupacion: autor.ocupacion ?? '',
  };
}

// Alta y edición de autor. comercial y dirección son los únicos roles
// con permiso de escritura (ver ROLES_ESCRITURA_AUTORES en
// server/routes/autores.routes.ts). Vive dentro del modal "Registrar/
// Editar Autor" de AutoresPage.tsx y CommercialAuthorsView.tsx — mismo
// componente para ambos roles, el título/subtítulo y la tarjeta ya los
// pone <Modal/>, este componente arma la navegación interna (sidebar en
// desktop, tabs en mobile, ver AuthorFormSectionNav.tsx) + el panel de
// la sección activa + el footer.
//
// autorEnEdicion === null → crear (POST); autorEnEdicion !== null →
// editar (PATCH /autores/:id) precargado con sus datos actuales.
// AutoresPage.tsx/CommercialAuthorsView.tsx remontan este modal cada vez
// que se abre (no cambian autorEnEdicion en caliente con el modal ya
// abierto), pero el useEffect deja el pre-llenado explícito igual, en
// vez de depender solo del useState inicial.
export function CrearAutorForm({
  autorEnEdicion,
  onGuardado,
  onCancelar,
}: {
  autorEnEdicion: Autor | null;
  onGuardado: (mensaje: string) => void;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState<EstadoFormularioAutor>(ESTADO_VACIO);
  const [seccionActiva, setSeccionActiva] = useState<SeccionAutorForm>('personal');
  const queryClient = useQueryClient();

  useEffect(() => {
    setForm(estadoDesdeAutor(autorEnEdicion));
    setSeccionActiva('personal');
  }, [autorEnEdicion]);

  function actualizar(cambios: Partial<EstadoFormularioAutor>) {
    setForm((actual) => ({ ...actual, ...cambios }));
    mutacion.reset();
  }

  const mutacionCrear = useMutation({
    mutationFn: () =>
      crearAutor({
        nombre: form.nombre,
        nombreArtistico: form.nombreArtistico || undefined,
        categoria: form.categoria,
        email: form.email.length > 0 ? form.email : undefined,
        telefono: construirTelefono(form.telefonoCodigo, form.telefonoNumero),
        pais: form.pais || undefined,
        nacionalidad: form.nacionalidad.length > 0 ? form.nacionalidad : undefined,
        fechaNacimiento: form.fechaNacimiento || undefined,
        redesSociales: redesSocialesDesdeFilas(form.redesFilas),
        personalidad: form.personalidad.length > 0 ? form.personalidad : undefined,
        ocupacion: form.ocupacion || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autores'] });
      setForm(ESTADO_VACIO);
      setSeccionActiva('personal');
      onGuardado('Autor creado exitosamente');
    },
  });

  const mutacionEditar = useMutation({
    mutationFn: () =>
      editarAutor(autorEnEdicion!.id, {
        nombre: form.nombre,
        nombreArtistico: form.nombreArtistico || null,
        categoria: form.categoria,
        email: form.email.length > 0 ? form.email : null,
        telefono: construirTelefono(form.telefonoCodigo, form.telefonoNumero) ?? null,
        pais: form.pais || null,
        nacionalidad: form.nacionalidad.length > 0 ? form.nacionalidad : null,
        fechaNacimiento: form.fechaNacimiento || null,
        redesSociales: redesSocialesDesdeFilas(form.redesFilas) ?? null,
        personalidad: form.personalidad.length > 0 ? form.personalidad : null,
        ocupacion: form.ocupacion || null,
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

  // Solo feedback visual en la navegación (check/círculo, ver
  // AuthorFormSectionNav.tsx) — nunca bloquea el submit ni valida nada;
  // por eso el criterio de "tiene datos" es deliberadamente laxo (basta
  // con un campo, no hace falta la sección completa).
  const seccionesConDatos: Record<SeccionAutorForm, boolean> = {
    personal: form.nombre.trim() !== '',
    contacto: form.email.length > 0 || form.telefonoNumero.trim() !== '',
    redes: form.redesFilas.some((f) => f.valor.trim() !== ''),
    perfil: form.personalidad.length > 0 || form.ocupacion.trim() !== '',
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      {/* Tabs — solo mobile (< md). En desktop la navegación vive en el
          sidebar de la izquierda, ver más abajo. */}
      <div className="shrink-0 border-b border-gray-100 px-4 py-3 md:hidden">
        <AuthorFormSectionNav variant="tabs" activa={seccionActiva} onCambiar={setSeccionActiva} seccionesConDatos={seccionesConDatos} />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar — solo desktop (md+). */}
        <div className="hidden shrink-0 border-r border-gray-100 bg-gray-50/60 px-3 py-5 md:block md:w-[200px]">
          <AuthorFormSectionNav variant="sidebar" activa={seccionActiva} onCambiar={setSeccionActiva} seccionesConDatos={seccionesConDatos} />
        </div>

        <div
          id="autor-form-panel"
          role="tabpanel"
          aria-labelledby={`autor-form-tab-sidebar-${seccionActiva} autor-form-tab-tabs-${seccionActiva}`}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-6"
        >
          {seccionActiva === 'personal' && (
            <PersonalInfoSection
              nombre={form.nombre}
              nombreArtistico={form.nombreArtistico}
              categoria={form.categoria}
              pais={form.pais}
              nacionalidad={form.nacionalidad}
              fechaNacimiento={form.fechaNacimiento}
              onCambiar={actualizar}
            />
          )}
          {seccionActiva === 'contacto' && (
            <ContactSection email={form.email} telefonoCodigo={form.telefonoCodigo} telefonoNumero={form.telefonoNumero} onCambiar={actualizar} />
          )}
          {seccionActiva === 'redes' && (
            <SocialNetworksSection filas={form.redesFilas} onChange={(redesFilas) => actualizar({ redesFilas })} />
          )}
          {seccionActiva === 'perfil' && (
            <AuthorProfileSection personalidad={form.personalidad} ocupacion={form.ocupacion} onCambiar={actualizar} />
          )}
        </div>
      </div>

      {/* flex-none: fuera del panel scrolleable de arriba, así que nunca
          se mueve con el contenido — siempre a ras del fondo de la
          tarjeta del modal. Botones de ancho contenido (no una barra
          completa) alineados a la derecha. */}
      <div className="flex-none border-t border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutacion.isPending}
            className="rounded-lg bg-dorado px-6 py-2.5 text-sm font-semibold text-tinta shadow-sm transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-60 disabled:hover:brightness-100 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40"
          >
            {mutacion.isPending ? 'Guardando…' : autorEnEdicion ? 'Guardar cambios' : 'Crear autor'}
          </button>
        </div>
        {mutacion.isError && (
          <p role="alert" className="mt-3 text-right text-sm text-red-600">
            No se pudo guardar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
          </p>
        )}
      </div>
    </form>
  );
}
