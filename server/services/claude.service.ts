// MOCK: sin credenciales todavía. Reemplazar por la integración real de
// la API de Claude cuando estén disponibles.

export interface ResultadoGeneracionTexto {
  texto: string;
  mock: true;
}

export async function generarTexto(prompt: string): Promise<ResultadoGeneracionTexto> {
  return {
    texto: `[MOCK] Respuesta simulada para: ${prompt.slice(0, 50)}`,
    mock: true,
  };
}
