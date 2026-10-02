import { useId, useRef, useState } from 'react';
import type { Autor } from '../types/api';

export function SelectorMultipleAutores({ autoresDisponibles, value, onChange }: { autoresDisponibles: Autor[]; value: string[]; onChange: (autorIds: string[]) => void }) {
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const seleccionados = value.map((id) => autoresDisponibles.find((autor) => autor.id === id)).filter((autor): autor is Autor => Boolean(autor));
  const q = busqueda.trim().toLocaleLowerCase('es');
  const resultados = autoresDisponibles.filter((autor) => !value.includes(autor.id) && (!q || autor.nombre.toLocaleLowerCase('es').includes(q) || (autor.nombreArtistico ?? '').toLocaleLowerCase('es').includes(q))).slice(0, 8);
  function agregar(id: string) { onChange([...value, id]); setBusqueda(''); setAbierto(false); setActivo(0); input.current?.focus(); }
  return <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setAbierto(false); }}>
    <input ref={input} id="proyecto-autores-buscador" type="text" role="combobox" aria-autocomplete="list" aria-expanded={abierto} aria-controls={abierto ? listId : undefined} aria-activedescendant={abierto && resultados[activo] ? `${listId}-${activo}` : undefined} placeholder={value.length ? 'Buscar y añadir coautor…' : 'Buscar autor por nombre…'} value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setActivo(0); setAbierto(true); }} onFocus={() => { setActivo(0); setAbierto(true); }} onClick={() => setAbierto(true)} onKeyDown={(e) => {
      if (e.key === 'Escape' && abierto) { e.preventDefault(); e.stopPropagation(); setAbierto(false); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setAbierto(true); setActivo((i) => resultados.length ? (i + (e.key === 'ArrowDown' ? 1 : -1) + resultados.length) % resultados.length : 0); }
      if (e.key === 'Enter' && abierto) { e.preventDefault(); if (resultados[activo]) agregar(resultados[activo].id); }
    }} className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-dorado focus:outline-none focus:ring-2 focus:ring-dorado/30" />
    {abierto && <ul id={listId} role="listbox" aria-label="Autores disponibles" className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-md">
      {!resultados.length ? <li role="presentation" className="px-3 py-3 text-xs text-gray-500">{!autoresDisponibles.length ? 'No hay autores disponibles.' : 'Sin resultados.'}</li> : resultados.map((autor, i) => <li key={autor.id} role="presentation"><button id={`${listId}-${i}`} type="button" role="option" aria-selected={i === activo} onMouseDown={(e) => e.preventDefault()} onClick={() => agregar(autor.id)} className={`min-h-10 w-full rounded-md px-3 py-2 text-left text-sm text-gray-900 hover:bg-dorado/10 focus:outline-none focus:ring-2 focus:ring-dorado/40 ${i === activo ? 'bg-gray-50' : ''}`}>{autor.nombre}</button></li>)}
    </ul>}
    {seleccionados.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{seleccionados.map((autor) => <span key={autor.id} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1.5 pr-2 text-sm text-gray-800">
      <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-dorado/15 text-[10px] font-semibold text-amber-800">{autor.nombre.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join('').toLocaleUpperCase('es')}</span>
      <span className="min-w-0 break-words">{autor.nombre}</span><button type="button" aria-label={`Quitar ${autor.nombre}`} onClick={() => onChange(value.filter((id) => id !== autor.id))} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-dorado">×</button>
    </span>)}</div>}
  </div>;
}
