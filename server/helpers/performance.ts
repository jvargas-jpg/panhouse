// Regla de negocio central: toda pausa registrada (autor u otro
// departamento) es una causa externa al especialista, así que su
// tiempo se excluye del cálculo de desempeño y de las alertas de
// retraso. Esta función es la única fuente de verdad para esa
// exclusión: KPIs, alertas y desempeño la reutilizan en vez de
// reimplementarla.

export interface RangoPausa {
  fechaInicio: Date;
  fechaFin: Date | null;
}

function msSolapadosConPausa(inicio: Date, fin: Date, pausa: RangoPausa, ahora: Date): number {
  const pausaInicio = pausa.fechaInicio;
  const pausaFin = pausa.fechaFin ?? ahora;

  const desde = pausaInicio > inicio ? pausaInicio : inicio;
  const hasta = pausaFin < fin ? pausaFin : fin;

  const solapadoMs = hasta.getTime() - desde.getTime();
  return solapadoMs > 0 ? solapadoMs : 0;
}

export function calcularDuracionEfectivaMs(
  inicio: Date,
  fin: Date,
  pausas: RangoPausa[],
  ahora: Date = new Date(),
): number {
  const duracionTotalMs = fin.getTime() - inicio.getTime();
  if (duracionTotalMs <= 0) return 0;

  const msPausados = pausas.reduce(
    (total, pausa) => total + msSolapadosConPausa(inicio, fin, pausa, ahora),
    0,
  );

  return Math.max(duracionTotalMs - msPausados, 0);
}

export function calcularDuracionEfectivaDias(
  inicio: Date,
  fin: Date,
  pausas: RangoPausa[],
  ahora: Date = new Date(),
): number {
  return calcularDuracionEfectivaMs(inicio, fin, pausas, ahora) / (1000 * 60 * 60 * 24);
}
