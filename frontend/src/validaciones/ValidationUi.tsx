import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
export function ValidationNavigation({ close }: { close?: () => void }) {
 return <nav aria-label="Navegación de Validadores"><Link to="/" aria-current="page" onClick={close}><RrppIcon nombre="proceso" />Validaciones</Link></nav>;
}
export function validationDate(value: string | null, full = false) {
 if (!value) return 'Sin fecha límite';
 return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: full ? 'long' : 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
