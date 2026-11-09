// Lista real de monedas ISO 4217 compatibles con el registro de dinero
// del backend (ver monedaDineroSchema en server/helpers/validacionDinero.ts):
// solo monedas soportadas por el runtime y con exactamente 2 decimales
// (excluye JPY/KRW de 0 decimales, KWD/BHD de 3, etc.) — así cualquier
// opción de esta lista siempre pasa esa validación.
const CON_DOS_DECIMALES = Intl.supportedValuesOf('currency').filter((codigo) => {
  try {
    return new Intl.NumberFormat('es', { style: 'currency', currency: codigo }).resolvedOptions().maximumFractionDigits === 2;
  } catch {
    return false;
  }
});

const nombres = new Intl.DisplayNames('es', { type: 'currency' });

export const MONEDA_POR_DEFECTO = 'USD';

export const MONEDAS: { code: string; label: string }[] = [
  { code: MONEDA_POR_DEFECTO, label: `USD — ${nombres.of('USD')}` },
  ...CON_DOS_DECIMALES.filter((codigo) => codigo !== MONEDA_POR_DEFECTO)
    .sort((a, b) => a.localeCompare(b))
    .map((codigo) => ({ code: codigo, label: `${codigo} — ${nombres.of(codigo)}` })),
];
