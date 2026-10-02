import { useEffect, useId, useRef, useState } from 'react';

export function ProjectActionsMenu({ nombre, onEditar, onEliminar, ocupado }: {
  nombre: string; onEditar?: () => void; onEliminar: () => void; ocupado: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [arriba, setArriba] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!abierto) return;
    setArriba(window.innerHeight - (disparador.current?.getBoundingClientRect().bottom ?? 0) < 140);
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const cerrarFuera = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('pointerdown', cerrarFuera);
    return () => document.removeEventListener('pointerdown', cerrarFuera);
  }, [abierto]);

  function cerrar() { setAbierto(false); disparador.current?.focus(); }

  return <div ref={raiz} className="relative shrink-0">
    <button ref={disparador} type="button" aria-label={`Más acciones de ${nombre}`} aria-haspopup="menu" aria-expanded={abierto} aria-controls={abierto ? id : undefined} disabled={ocupado} onClick={() => setAbierto(!abierto)} onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setAbierto(true); } }} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/50 disabled:opacity-40">
      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
    </button>
    {abierto && <div ref={menu} id={id} role="menu" aria-label={`Acciones de ${nombre}`} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node) && e.relatedTarget !== disparador.current) setAbierto(false); }} onKeyDown={(e) => {
      if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
      const botones = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
      const actual = botones.indexOf(document.activeElement as HTMLButtonElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const siguiente = e.key === 'Home' ? 0 : e.key === 'End' ? botones.length - 1 : (actual + (e.key === 'ArrowDown' ? 1 : -1) + botones.length) % botones.length;
        botones[siguiente]?.focus();
      }
    }} className={`absolute right-0 z-30 w-40 rounded-lg border border-gray-200 bg-white p-1 shadow-md ${arriba ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
      {onEditar && <button type="button" role="menuitem" onClick={() => { cerrar(); onEditar(); }} className="block w-full rounded-md px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 focus:bg-gray-100 focus:outline-none">Editar</button>}
      <button type="button" role="menuitem" onClick={() => { cerrar(); onEliminar(); }} className="block w-full rounded-md px-3 py-2.5 text-left text-sm text-red-700 hover:bg-red-50 focus:bg-red-50 focus:outline-none">Eliminar</button>
    </div>}
  </div>;
}
