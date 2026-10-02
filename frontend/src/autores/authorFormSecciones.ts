export type SeccionAutorForm = 'personal' | 'contacto' | 'redes' | 'perfil';

// Único listado de secciones del formulario de autor — lo consumen tanto
// AuthorFormSectionNav.tsx (sidebar en desktop, tabs en mobile) como
// CrearAutorForm.tsx (qué panel renderizar). Agregar o quitar una
// sección solo requiere tocar este arreglo.
export const SECCIONES_AUTOR_FORM: { id: SeccionAutorForm; etiqueta: string; etiquetaCorta: string }[] = [
  { id: 'personal', etiqueta: 'Información personal', etiquetaCorta: 'Personal' },
  { id: 'contacto', etiqueta: 'Contacto', etiquetaCorta: 'Contacto' },
  { id: 'redes', etiqueta: 'Redes sociales', etiquetaCorta: 'Redes' },
  { id: 'perfil', etiqueta: 'Perfil del autor', etiquetaCorta: 'Perfil' },
];
