import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import type { PaisRanking } from '../types/api';
import { nombreParaMapa } from './paisesMapaMundial';

// Mismo topojson que pide la consigna — 110m (baja resolución, liviano)
// es suficiente para un mapa de calor, no hace falta el detalle de
// fronteras de un dataset más pesado.
const TOPOJSON_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const GRIS_SIN_DATOS = '#F3F4F6';
const ORO_CLARO = '#FEF08A'; // país con menos clientes del ranking
const ORO_PRINCIPAL = '#EAB308'; // país con más clientes (maximo)
// Solo para el estado hover del mapa (no forma parte de la escala de
// datos) — mismo azul que la línea de "Proyectos iniciados por mes" en
// MetricasPage.tsx, deliberadamente distinto de cualquier color de la
// escala oro para que el hover destaque sin ambigüedad.
const AZUL_CORPORATIVO = '#1E3A8A';

function hexARgb(hex: string): [number, number, number] {
  const limpio = hex.replace('#', '');
  return [parseInt(limpio.slice(0, 2), 16), parseInt(limpio.slice(2, 4), 16), parseInt(limpio.slice(4, 6), 16)];
}

function interpolarColor(colorA: string, colorB: string, t: number): string {
  const [r1, g1, b1] = hexARgb(colorA);
  const [r2, g2, b2] = hexARgb(colorB);
  const canal = (a: number, b: number) =>
    Math.round(a + (b - a) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${canal(r1, r2)}${canal(g1, g2)}${canal(b1, b2)}`;
}

// Escala lineal de un solo tramo: oro claro (mínimo del ranking) → oro
// principal (maximo) — sin negro absoluto en ningún punto de la escala.
// Se probó oro→azul corporativo primero, pero interpolar en RGB entre
// dos matices tan distintos (amarillo y azul) cruza por un gris-oliva
// apagado en el punto medio (#8e958a con estos datos de prueba) — se ve
// como un color accidental, no como una escala deliberada. Quedarse
// dentro de la misma familia (oro claro → oro) evita ese problema. Sin
// librería de escalas (d3-scale): un solo tramo lineal alcanza y evita
// sumar otra dependencia solo para esto.
export function colorParaCantidad(cantidad: number, maximo: number): string {
  if (cantidad <= 0 || maximo <= 0) return GRIS_SIN_DATOS;
  const t = Math.min(cantidad / maximo, 1);
  return interpolarColor(ORO_CLARO, ORO_PRINCIPAL, t);
}

export function MapaCalorPaises({ paises }: { paises: PaisRanking[] }) {
  const maximo = paises[0]?.cantidad ?? 0;

  // nombreParaMapa hace el mapeo seguro español→inglés (ver
  // paisesMapaMundial.ts) — países sin traducción conocida (o que no
  // existen en este dataset de 110m) simplemente no entran acá, y
  // quedan grises en el mapa como cualquier país sin autores.
  const cantidadPorNombreMapa = new Map<string, number>();
  for (const pais of paises) {
    const nombreMapa = nombreParaMapa(pais.pais);
    if (nombreMapa) cantidadPorNombreMapa.set(nombreMapa, pais.cantidad);
  }

  return (
    // width/height fijan el viewBox interno del SVG (no el tamaño en
    // pantalla, ese lo sigue controlando style) — un viewBox más grande +
    // más scale es lo que realmente agranda el mapa dentro de la
    // tarjeta, ajustar solo el CSS con un viewBox chico lo dejaría con
    // el mismo detalle pequeño, solo estirado.
    <ComposableMap width={800} height={400} projectionConfig={{ scale: 150 }} style={{ width: '100%', height: 'auto' }}>
      <Geographies geography={TOPOJSON_URL}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const nombre = geo.properties.name as string;
            const cantidad = cantidadPorNombreMapa.get(nombre) ?? 0;
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={colorParaCantidad(cantidad, maximo)}
                stroke="#FFFFFF"
                strokeWidth={0.5}
                style={{
                  default: { outline: 'none' },
                  hover: { outline: 'none', fill: AZUL_CORPORATIVO },
                  pressed: { outline: 'none' },
                }}
              >
                <title>
                  {nombre}: {cantidad} cliente{cantidad === 1 ? '' : 's'}
                </title>
              </Geography>
            );
          })
        }
      </Geographies>
    </ComposableMap>
  );
}
