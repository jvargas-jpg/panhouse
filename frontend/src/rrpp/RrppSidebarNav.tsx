import { Link } from 'react-router-dom';
import { RrppIcon } from './RrppIcons';
export const RRPP_LOGO = (
  <img
    src="/brand/panhouse-logo.webp"
    alt="PanHouse Casa Editorial"
    className="h-auto w-[132px] object-contain"
  />
);
export const RRPP_FOOTER = (
  <div className="border-t border-gray-800/80 px-6 py-5">
    <p className="text-xs italic text-gray-500">Historias que conectan</p>
  </div>
);
export type VistaRrpp =
  | 'inicio'
  | 'ingresos'
  | 'proyectos'
  | 'lanzamientos'
  | 'actividad';
export function RrppSidebarNav({ vista }: { vista: VistaRrpp }) {
  return (
    <>
      {(
        [
          { nombre: 'Inicio', vista: 'inicio', icono: 'inicio' },
          { nombre: 'Ingresos', vista: 'ingresos', icono: 'ingreso' },
          { nombre: 'Proyectos', vista: 'proyectos', icono: 'proyectos' },
          {
            nombre: 'Lanzamientos y eventos',
            vista: 'lanzamientos',
            icono: 'lanzamiento',
          },
        ] as const
      ).map((item, index) => (
        <div key={item.vista}>
          {index === 3 && <div className="my-4 border-t border-gray-800" />}
          <Link
            to={item.vista === 'inicio' ? '/' : item.vista === 'ingresos' ? '/rrpp/ingresos' : item.vista === 'proyectos' ? '/rrpp/proyectos' : `/?vista=${item.vista}`}
            aria-current={vista === item.vista ? 'page' : undefined}
            className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-left text-sm transition-colors ${vista === item.vista ? 'border border-dorado/20 bg-dorado/10 font-semibold text-dorado' : 'font-medium text-gray-400 hover:bg-white/5 hover:text-white'}`}
          >
            <RrppIcon
              nombre={item.icono}
              className="h-[18px] w-[18px] shrink-0"
            />
            {item.nombre}
          </Link>
        </div>
      ))}
      <Link
        to="/rrpp/metricas"
        className="flex items-center gap-3 rounded-lg px-3.5 py-3 text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white"
      >
        <RrppIcon nombre="indicadores" className="h-[18px] w-[18px]" />
        Indicadores
      </Link>
    </>
  );
}
