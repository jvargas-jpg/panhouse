import { useState } from 'react';
import type { ProyectoJefatura } from '../../../shared/jefatura';
import {
  ETIQUETAS_ESTADO,
  estadoPortafolio,
} from '../../../shared/portafolioJefatura';
import { RrppIcon } from '../rrpp/RrppIcons';

export function PortadaProyecto({
  p,
  grande = false,
}: {
  p: ProyectoJefatura;
  grande?: boolean;
}) {
  const [fallo, setFallo] = useState(false);
  return (
    <span className={`jp-cover ${grande ? 'jp-cover-large' : ''}`}>
      {p.portadaUrl && !fallo ? (
        <img
          src={p.portadaUrl}
          alt={`Portada de ${p.titulo ?? p.autores}`}
          onError={() => setFallo(true)}
        />
      ) : (
        <>
          <RrppIcon nombre="libro" />
          <small>{p.servicio.codigo}</small>
        </>
      )}
    </span>
  );
}
export function EstadoProyecto({ p }: { p: ProyectoJefatura }) {
  const estado = estadoPortafolio(p);
  return (
    <span className="jp-status">
      <span className={`jp-badge jp-state-${estado}`}>
        {ETIQUETAS_ESTADO[estado]}
      </span>
      {p.riesgo.atencion && estado !== 'enRiesgo' && (
        <span
          title={p.riesgo.causas.join(' · ')}
          aria-label="Proyecto con alerta"
          className="jp-risk-indicator"
        >
          <RrppIcon nombre="riesgo" className="h-3.5 w-3.5" />
        </span>
      )}
    </span>
  );
}
export function PrioridadProyecto({ p }: { p: ProyectoJefatura }) {
  const express = p.express.estado === 'confirmado';
  const posible = p.express.estado === 'posible';
  return (
    <span
      className={`jp-badge ${express ? 'jp-express' : posible ? 'jp-possible' : 'jp-normal'}`}
    >
      {(express || posible) && <RrppIcon nombre="rapido" className="h-3 w-3" />}
      {express
        ? 'Express'
        : posible
          ? 'Posible Express'
          : p.express.estado === 'pendiente_clasificacion'
            ? 'Por clasificar'
            : 'Normal'}
    </span>
  );
}
export function AvatarProyecto({ nombre }: { nombre: string }) {
  return (
    <span className="jp-avatar" aria-hidden="true">
      {nombre
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()}
    </span>
  );
}
export function ServicioProyecto({ p }: { p: ProyectoJefatura }) {
  return (
    <span
      className={`jp-service jp-service-${p.servicio.codigo}`}
      title={
        p.datoIncompleto
          ? 'Dato incompleto: RRPP no ha definido el subtipo'
          : undefined
      }
    >
      <b>{p.servicio.codigo}</b>
      <span>{p.servicio.nombre}</span>
    </span>
  );
}
