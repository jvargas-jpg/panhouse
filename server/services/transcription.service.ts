// MOCK: sin credenciales todavía. Reemplazar por la integración real del
// servicio de transcripción cuando estén disponibles.

export interface ResultadoTranscripcion {
  texto: string;
  mock: true;
}

export async function transcribirAudio(_urlAudio: string): Promise<ResultadoTranscripcion> {
  return {
    texto: '[MOCK] Transcripción simulada.',
    mock: true,
  };
}
