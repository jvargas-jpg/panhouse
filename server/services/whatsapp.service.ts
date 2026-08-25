// MOCK: sin credenciales todavía. Reemplazar por la integración real de
// la API de WhatsApp Business cuando estén disponibles.

export interface ResultadoEnvioWhatsapp {
  enviado: boolean;
  mockId: string;
}

export async function enviarMensaje(_telefono: string, _mensaje: string): Promise<ResultadoEnvioWhatsapp> {
  return {
    enviado: true,
    mockId: `mock-wa-${Date.now()}`,
  };
}
