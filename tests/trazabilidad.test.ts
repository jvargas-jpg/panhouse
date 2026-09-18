import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import {
  fichaCalidadFases,
  fichaDisenoPropuestas,
  fichaDistribucionPaises,
  fichaLanzamientoReuniones,
  fichasTrazabilidad,
} from '../server/db/schema/index.js';
import { actualizarCapituloAutor, crearCapitulo } from '../server/helpers/capitulos.js';
import {
  actualizarBriefDiseno,
  actualizarSeccionCorreccion,
  actualizarSeccionImpresion,
  actualizarSeccionProyectoContrato,
  actualizarSeccionProyectoPerfil,
  actualizarSeccionSoporteDigital,
  agregarFaseCalidad,
  agregarPaisDistribucion,
  agregarPropuestaDiseno,
  agregarReunionLanzamiento,
  crearFichaTrazabilidad,
  obtenerFichaCompleta,
} from '../server/helpers/trazabilidad.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearProyectoDePrueba } from './helpers/fixtures.js';

describe('ficha de trazabilidad (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('nace vacía al crear el proyecto: ninguna de las nueve secciones tiene datos todavía', async () => {
    const proyecto = await crearProyectoDePrueba();

    const ficha = await crearFichaTrazabilidad(proyecto.id);

    expect(ficha.proyectoId).toBe(proyecto.id);
    expect(ficha.ingresoObservaciones).toBeNull();
    expect(ficha.correccionTripaCompleta).toBeNull();
    expect(ficha.disenoBriefCreativo).toBeNull();
    expect(ficha.soporteDigitalCuentaAmazon).toBeNull();
    expect(ficha.impresionNotas).toBeNull();
  });

  it('no permite dos fichas para el mismo proyecto (relación 1 a 1)', async () => {
    const proyecto = await crearProyectoDePrueba();
    await crearFichaTrazabilidad(proyecto.id);

    await expect(crearFichaTrazabilidad(proyecto.id)).rejects.toThrow();
  });

  it('actualizarSeccionProyectoPerfil guarda el perfil aunque venga parcialmente completo', async () => {
    const proyecto = await crearProyectoDePrueba();
    await crearFichaTrazabilidad(proyecto.id);

    const ficha = await actualizarSeccionProyectoPerfil(proyecto.id, {
      ingresoObservaciones: 'Autor primerizo, orientado a negocios',
      // ingresoServicioPresupuesto queda sin llenar.
    });

    expect(ficha.ingresoObservaciones).toBe('Autor primerizo, orientado a negocios');
    expect(ficha.ingresoServicioPresupuesto).toBeNull();
  });

  it('actualizarSeccionProyectoContrato es independiente del perfil (dueños distintos: comercial vs. RRPP)', async () => {
    const proyecto = await crearProyectoDePrueba();
    await crearFichaTrazabilidad(proyecto.id);

    await actualizarSeccionProyectoPerfil(proyecto.id, { ingresoObservaciones: 'Autor con experiencia previa' });
    const ficha = await actualizarSeccionProyectoContrato(proyecto.id, { capitulosPactados: '11 a 20', paginasPactadas: '200' });

    expect(ficha.capitulosPactados).toBe('11 a 20');
    expect(ficha.paginasPactadas).toBe('200');
    // El perfil, escrito por otra función, sigue intacto.
    expect(ficha.ingresoObservaciones).toBe('Autor con experiencia previa');
  });

  it('agregarPaisDistribucion permite países sin porcentaje de regalías todavía', async () => {
    const proyecto = await crearProyectoDePrueba();
    await crearFichaTrazabilidad(proyecto.id);

    const pais = await agregarPaisDistribucion(proyecto.id, { pais: 'México' });

    expect(pais.pais).toBe('México');
    expect(pais.porcentajeRegalias).toBeNull();
  });

  it('agregarFaseCalidad rechaza un número de fase fuera de 1-4', async () => {
    const proyecto = await crearProyectoDePrueba();
    await crearFichaTrazabilidad(proyecto.id);

    await expect(agregarFaseCalidad(proyecto.id, { numeroFase: 5 })).rejects.toThrow();
  });

  it('actualizar la sección de Edición no afecta ni borra nada de las otras ocho secciones', async () => {
    const proyecto = await crearProyectoDePrueba();
    await crearFichaTrazabilidad(proyecto.id);

    // Sección 1 — Proyecto (perfil + contrato)
    await actualizarSeccionProyectoPerfil(proyecto.id, {
      ingresoObservaciones: 'Autor con experiencia previa',
      ingresoServicioPresupuesto: 'Oro',
    });
    await actualizarSeccionProyectoContrato(proyecto.id, { capitulosPactados: '6 a 10', paginasPactadas: '150' });
    // Sección 3 — Corrección
    await actualizarSeccionCorreccion(proyecto.id, {
      correccionTripaCompleta: 'Sin observaciones mayores',
      correccionTripaCompletaAprobado: true,
      correccionPreliminaresAprobado: false,
    });
    // Sección 4 — Diseño (brief + una propuesta)
    await actualizarBriefDiseno(proyecto.id, {
      disenoBriefCreativo: 'Portada minimalista, paleta fría',
      disenoTipoPortada: 'ilustrada',
    });
    await agregarPropuestaDiseno(proyecto.id, {
      fechaEnviadaEspecialista: '2026-03-01',
      descripcion: 'Propuesta A',
      enlace: 'https://drive.example/propuesta-a',
    });
    // Sección 5 — Calidad (una de las cuatro fases)
    await agregarFaseCalidad(proyecto.id, { numeroFase: 1, pdfUrl: 'https://drive.example/calidad-f1', pdfVersion: 'v1' });
    // Sección 6 — Soporte digital
    await actualizarSeccionSoporteDigital(proyecto.id, {
      soporteDigitalCuentaAmazon: 'cuenta@panhouse.test',
      soporteDigitalFechaEnvioFormulario: '2026-04-01',
    });
    // Sección 7 — Lanzamiento y promoción
    await agregarReunionLanzamiento(proyecto.id, {
      fecha: '2026-05-01',
      puntosTratados: 'Impresión y ferias',
      acuerdos: 'Definir tiraje inicial',
    });
    // Sección 8 — Impresión
    await actualizarSeccionImpresion(proyecto.id, {
      impresionDeseaCotizacion: true,
      impresionResponsable: 'Área de impresión',
      impresionEstadoCotizacion: 'solicitada',
      impresionNotas: 'Área nueva, sin detalle fino todavía',
    });
    // Sección 9 — Distribución
    await agregarPaisDistribucion(proyecto.id, { pais: 'Colombia', porcentajeRegalias: '12.50' });

    // Snapshot de las ocho secciones antes de tocar Edición.
    const antes = await snapshotFicha(proyecto.id);

    // Sección 2 — Edición: nace el capítulo y se completa su parte del autor.
    await crearCapitulo(proyecto.id, 1);
    await actualizarCapituloAutor(proyecto.id, 1, {
      fechaEnvioAutor: '2026-02-10',
      fechaPautadaFeedback: '2026-02-17',
      enlaces: ['https://drive.example/cap1-borrador'],
    });

    const despues = await snapshotFicha(proyecto.id);

    expect(despues).toEqual(antes);
  });
});

describe('obtenerFichaCompleta (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('devuelve la fila principal más las cuatro tablas hijas, aunque estén vacías', async () => {
    const proyecto = await crearProyectoDePrueba();
    await crearFichaTrazabilidad(proyecto.id);

    const ficha = await obtenerFichaCompleta(proyecto.id);

    expect(ficha?.proyectoId).toBe(proyecto.id);
    expect(ficha?.ingresoObservaciones).toBeNull();
    expect(ficha?.calidadFases).toEqual([]);
    expect(ficha?.disenoPropuestas).toEqual([]);
    expect(ficha?.lanzamientoReuniones).toEqual([]);
    expect(ficha?.distribucionPaises).toEqual([]);
  });

  it('incluye el contenido ya cargado de cada sección, secciones de una fila y de varias', async () => {
    const proyecto = await crearProyectoDePrueba();
    await crearFichaTrazabilidad(proyecto.id);

    await actualizarSeccionProyectoPerfil(proyecto.id, { ingresoObservaciones: 'Autor con experiencia previa' });
    await agregarFaseCalidad(proyecto.id, { numeroFase: 1, pdfUrl: 'https://drive.example/f1' });
    await agregarPaisDistribucion(proyecto.id, { pais: 'México' });

    const ficha = await obtenerFichaCompleta(proyecto.id);

    expect(ficha?.ingresoObservaciones).toBe('Autor con experiencia previa');
    expect(ficha?.calidadFases).toHaveLength(1);
    expect(ficha?.calidadFases[0]?.numeroFase).toBe(1);
    expect(ficha?.distribucionPaises).toHaveLength(1);
    expect(ficha?.distribucionPaises[0]?.pais).toBe('México');
    // Secciones sin tocar siguen vacías/nulas, no se contaminan entre sí.
    expect(ficha?.disenoPropuestas).toEqual([]);
    expect(ficha?.correccionTripaCompleta).toBeNull();
  });

  it('devuelve undefined si el proyecto no tiene ficha (no debería pasar en la práctica, pero no debe reventar)', async () => {
    const proyecto = await crearProyectoDePrueba();
    // A propósito no se llama crearFichaTrazabilidad.

    expect(await obtenerFichaCompleta(proyecto.id)).toBeUndefined();
  });
});

async function snapshotFicha(proyectoId: string) {
  const [ficha] = await db.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId, proyectoId));
  if (!ficha) throw new Error('Ficha no encontrada al tomar el snapshot');

  const [calidad, diseno, lanzamiento, distribucion] = await Promise.all([
    db.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.fichaId, ficha.id)),
    db.select().from(fichaDisenoPropuestas).where(eq(fichaDisenoPropuestas.fichaId, ficha.id)),
    db.select().from(fichaLanzamientoReuniones).where(eq(fichaLanzamientoReuniones.fichaId, ficha.id)),
    db.select().from(fichaDistribucionPaises).where(eq(fichaDistribucionPaises.fichaId, ficha.id)),
  ]);

  return { ficha, calidad, diseno, lanzamiento, distribucion };
}
