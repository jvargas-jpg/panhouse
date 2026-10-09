// Mismo sistema SVG del CRM existente; sin dependencias ni iconos de emoji.
const PATHS = {
  inicio: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
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
