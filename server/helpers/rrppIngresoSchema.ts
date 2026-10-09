import { z } from 'zod';
import {
  COLECCIONES_PANHOUSE,
  PUBLICOS_SEXO,
  ESTADOS_REUNION,
  PROPIETARIOS_MATRIZ_INGRESO,
} from '../db/schema/index.js';

export const seccionFichaEditorialSchema = z
  .object({
    fechaDeseadaCulminacion: z.string().nullable().optional(),
    temaGeneral: z.string().nullable().optional(),
    posibleTituloLibro: z.string().nullable().optional(),
    coleccionPanhouse: z.enum(COLECCIONES_PANHOUSE).nullable().optional(),
    tonoEstilo: z.string().nullable().optional(),
    publicoSexo: z.enum(PUBLICOS_SEXO).nullable().optional(),
    publicoEdad: z.string().nullable().optional(),
    publicoPerfil: z.string().nullable().optional(),
    propositoSocial: z.string().nullable().optional(),
    // Array de texto libre — mismo criterio que nacionalidadSchema en
    // autores.routes.ts: sin catálogo cerrado, ver EtiquetasObjetivoComercial.tsx.
    objetivoComercial: z.array(z.string()).nullable().optional(),
  })
  .strict();

export const seccionMatrizIngresoSchema = z
  .object({
    matrizCiudadResidencia: z.string().nullable().optional(),
    matrizEstadoReunion: z.enum(ESTADOS_REUNION).nullable().optional(),
    matrizPropietario: z
      .enum(PROPIETARIOS_MATRIZ_INGRESO)
      .nullable()
      .optional(),
    matrizContratoFirmado: z.boolean().optional(),
    matrizBienvenidaGenerada: z.boolean().optional(),
    matrizLinkResumen: z.string().nullable().optional(),
    matrizDiagnosticoGenerado: z.boolean().optional(),
    matrizLinkDiagnostico: z.string().nullable().optional(),
    matrizIngresoGenerado: z.boolean().optional(),
    matrizFechaReunionCreativa: z.string().nullable().optional(),
    // Array de texto libre — mismo criterio que objetivoComercial arriba.
    matrizVentaCruzada: z.array(z.string()).nullable().optional(),
    matrizObservacionesComerciales: z.string().nullable().optional(),
  })
  .strict();
