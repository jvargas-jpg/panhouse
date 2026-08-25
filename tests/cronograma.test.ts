import { beforeEach, describe, expect, it } from 'vitest';
import { calcularCronograma, calcularCronogramaProyecto } from '../server/helpers/cronograma.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, crearPresupuesto, crearProyecto, crearServicio, crearUnidad } from './helpers/fixtures.js';

describe('calcularCronograma', () => {
  it('SE: calcula los dos plazos simultáneos (interno y comercial) por separado', () => {
    const inicio = new Date('2026-01-01T00:00:00Z');

    const cronograma = calcularCronograma(
      { plazoDias: null, plazoInternoDias: 60, plazoComercialDias: 90 },
      inicio,
    );

    expect(cronograma.fechaFinInterna).toEqual(new Date('2026-03-02T00:00:00Z')); // +60 días
    expect(cronograma.fechaFinComprometida).toEqual(new Date('2026-04-01T00:00:00Z')); // +90 días
    // El interno nunca debe usarse como si fuera el comprometido con margen.
    expect(cronograma.fechaFinInterna).not.toEqual(cronograma.fechaFinComprometida);
  });

  it('SE: el express se calcula contra el compromiso comercial (90 días), no el interno', () => {
    const inicio = new Date('2026-01-01T00:00:00Z');
    // 70 días: después de la meta interna (60, no debería usarse aquí) pero
    // antes del compromiso comercial (90). Si el cálculo comparara contra
    // el interno por error, esto NO sería express; contra el comercial, sí.
    const fechaDeseadaAutor = new Date('2026-03-12T00:00:00Z');

    const cronograma = calcularCronograma(
      { plazoDias: null, plazoInternoDias: 60, plazoComercialDias: 90 },
      inicio,
      fechaDeseadaAutor,
    );

    expect(cronograma.esExpress).toBe(true);
  });

  it('servicios de plazo único (EF, EEC, EET) calculan una sola fecha de fin', () => {
    const inicio = new Date('2026-01-01T00:00:00Z');

    const cronograma = calcularCronograma({ plazoDias: 180, plazoInternoDias: null, plazoComercialDias: null }, inicio);

    expect(cronograma.fechaFinComprometida).toEqual(new Date('2026-06-30T00:00:00Z')); // +180 días
    expect(cronograma.fechaFinInterna).toBeNull();
  });

  it('marca un proyecto como express cuando la fecha deseada es anterior al plazo estándar', () => {
    const inicio = new Date('2026-01-01T00:00:00Z');
    const fechaDeseadaAutor = new Date('2026-05-01T00:00:00Z'); // antes de +180 días

    const cronograma = calcularCronograma({ plazoDias: 180, plazoInternoDias: null, plazoComercialDias: null }, inicio, fechaDeseadaAutor);

    expect(cronograma.esExpress).toBe(true);
  });

  it('no marca express cuando la fecha deseada es igual o posterior al plazo estándar', () => {
    const inicio = new Date('2026-01-01T00:00:00Z');
    const fechaDeseadaAutor = new Date('2026-07-01T00:00:00Z'); // después de +180 días

    const cronograma = calcularCronograma({ plazoDias: 180, plazoInternoDias: null, plazoComercialDias: null }, inicio, fechaDeseadaAutor);

    expect(cronograma.esExpress).toBe(false);
  });

  it('no marca express cuando el autor no expresó una fecha deseada', () => {
    const inicio = new Date('2026-01-01T00:00:00Z');

    const cronograma = calcularCronograma({ plazoDias: 180, plazoInternoDias: null, plazoComercialDias: null }, inicio, null);

    expect(cronograma.esExpress).toBe(false);
  });

  it('lanza un error si el servicio no tiene ningún plazo configurado', () => {
    const inicio = new Date('2026-01-01T00:00:00Z');

    expect(() => calcularCronograma({ plazoDias: null, plazoInternoDias: null, plazoComercialDias: null }, inicio)).toThrow();
  });

  it('lanza un error si tiene plazo comercial pero falta el interno', () => {
    const inicio = new Date('2026-01-01T00:00:00Z');

    expect(() =>
      calcularCronograma({ plazoDias: null, plazoInternoDias: null, plazoComercialDias: 90 }, inicio),
    ).toThrow();
  });
});

describe('calcularCronogramaProyecto (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('arma el cronograma de un proyecto SE real leyendo servicio y fechas desde la base de datos', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({
      codigo: 'SE',
      nombre: 'Sello editorial',
      pesoComplejidad: 1,
      plazoInternoDias: 60,
      plazoComercialDias: 90,
    });

    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
      fechaDeseadaAutor: '2026-02-01',
    });

    const cronograma = await calcularCronogramaProyecto(proyecto.id);

    expect(cronograma.fechaFinInterna).toEqual(new Date('2026-03-02T00:00:00.000Z'));
    expect(cronograma.fechaFinComprometida).toEqual(new Date('2026-04-01T00:00:00.000Z'));
    expect(cronograma.esExpress).toBe(true);
  });
});
