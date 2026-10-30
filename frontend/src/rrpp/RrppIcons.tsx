// Mismo sistema SVG del CRM existente; sin dependencias ni iconos de emoji.
const PATHS = {
  cerrar: 'M6 6l12 12M6 18 18 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  comentarios:'M21 11a9 9 0 01-9 9H4l-3 2 2-6a9 9 0 1118-5ZM7 10h.01M12 10h.01M17 10h.01',
  lista:'M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01',
  inicio: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  buscar: 'M21 21l-5-5M18 10a8 8 0 11-16 0 8 8 0 0116 0',
  ingreso: 'M6 3h8l4 4v14H6zM14 3v5h5M9 12h6M9 16h4',
  proceso: 'M6 3h8l4 4v14H6zM14 3v5h5M9 12h6m-6 4 2 2 5-5',
  proyectos: 'M3 7h7l2 2h9v11H3zM3 7V4h7l2 3',
  conceptos: 'M3 4h18v16H3zM7 9h.01M3 17l5-5 4 4 4-6 5 7',
  lanzamiento: 'M3 10v5h5l11 5V5L8 10H3zm5 5 2 6H6l-1-6M22 9v7',
  indicadores: 'M4 20V10h3v10m4 0V4h3v16m4 0v-7h3v7',
  calendario: 'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16',
  actividad: 'M12 8v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0',
  flecha: 'm9 5 7 7-7 7',
  check: 'm5 12 4 4L19 6',
  externo: 'M14 3h7v7m0-7L10 14M10 3H4v17h17v-6',
  rapido: 'm13 2-9 12h7l-1 8 10-12h-7z',
  persona: 'M16 7a4 4 0 11-8 0 4 4 0 018 0M5 21v-2a7 7 0 0114 0v2z',
  equipo:
    'M15 6a3 3 0 11-6 0 3 3 0 016 0M6 21v-3a6 6 0 0112 0v3M3 9a3 3 0 013 3m12 0a3 3 0 013-3M2 21v-3a4 4 0 013-4m14 0a4 4 0 013 4v3',
  libro: 'M12 5c-3-2-6-2-9 0v15c3-2 6-2 9 0m0-15c3-2 6-2 9 0v15c-3-2-6-2-9 0V5',
  capas: 'm12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5',
  comparar: 'M12 3v17M6 21h12M4 7h16M6 7l-4 8h8L6 7m12 0-4 8h8l-4-8',
  riesgo: 'm12 3 10 18H2L12 3m0 6v5m0 3h.01',
  reasignar:
    'M4 8a8 8 0 0114-3l3 3M21 3v5h-5M20 16a8 8 0 01-14 3l-3-3M3 21v-5h5',
} as const;
export function RrppIcon({
  nombre,
  className = 'h-5 w-5',
}: {
  nombre: keyof typeof PATHS;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[nombre]} />
    </svg>
  );
}
