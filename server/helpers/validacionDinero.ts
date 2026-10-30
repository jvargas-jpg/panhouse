import { z } from 'zod';

export const montoDineroSchema = z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/, 'Monto decimal inválido')
  .refine(s => /[1-9]/.test(s), 'El monto debe ser mayor que cero')
  .transform(value => { const [whole,fraction=''] = value.split('.'); return `${whole!.replace(/^0+(?=\d)/,'')}.${fraction.padEnd(2,'0')}`; });
export const monedaDineroSchema = z.string().regex(/^[A-Z]{3}$/).refine(s => {
  try { return new Intl.NumberFormat('es', { style:'currency',currency:s }).resolvedOptions().maximumFractionDigits === 2 && Intl.supportedValuesOf('currency').includes(s); }
  catch { return false; }
}, 'Moneda no compatible con el registro de dos decimales');
export const contratoInicialSchema = z.object({ montoContractual:montoDineroSchema.optional(),monedaContractual:monedaDineroSchema.optional() })
  .refine(v => (v.montoContractual == null) === (v.monedaContractual == null), 'Indica el monto total y su moneda juntos');
