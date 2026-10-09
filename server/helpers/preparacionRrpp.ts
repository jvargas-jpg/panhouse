import { evaluarGateDefinicionCrudo } from './gates.js';

// Conserva las señales documentales del intake existente. El contenido de
// la ficha admite guardado parcial; colección, audiencia y título son opcionales.
export function evaluarPreparacionRrpp(
  ficha: {
    matrizDiagnosticoGenerado: boolean;
    matrizIngresoGenerado: boolean;
    ingresoServicioSubtipoCrudo: string | null;
  },
  servicioCodigo: string,
) {
  const checklist = [
    ...(servicioCodigo === 'CR'
      ? [
          {
            campo: 'ingresoServicioSubtipoCrudo',
            etiqueta: 'Definir Crudo Tripa / Capítulo',
            completo: evaluarGateDefinicionCrudo({
              servicioCodigo,
              ingresoServicioSubtipoCrudo: ficha.ingresoServicioSubtipoCrudo,
            }).desbloqueado,
          },
        ]
      : []),
    {
      campo: 'matrizDiagnosticoGenerado',
      etiqueta: 'Generar diagnóstico',
      completo: ficha.matrizDiagnosticoGenerado,
    },
    {
      campo: 'matrizIngresoGenerado',
      etiqueta: 'Generar documento de ingreso',
      completo: ficha.matrizIngresoGenerado,
    },
  ];
  const faltantes = checklist.filter((c) => !c.completo);
  return {
    listoParaJefatura: faltantes.length === 0,
    faltantes,
    checklist,
    progreso: Math.round(
      (100 * (checklist.length - faltantes.length)) / checklist.length,
    ),
  };
}
