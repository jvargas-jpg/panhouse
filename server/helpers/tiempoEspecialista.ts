import { diaCaracas } from './atencionEspecialista.js';
import { UMBRAL_PROXIMO_A_VENCER_HORAS } from './correccionSla.js';
export function clasificarVencimiento(fecha:string,ahora:Date) {
  const precision=/^\d{4}-\d{2}-\d{2}$/.test(fecha)?'dia' as const:'instante' as const;
  if(precision==='dia'){const hoy=diaCaracas(ahora),horizonte=diaCaracas(new Date(ahora.getTime()+UMBRAL_PROXIMO_A_VENCER_HORAS*3600000));return {precision,vencido:fecha<hoy,proximo:fecha>=hoy&&fecha<=horizonte};}
  const ms=Date.parse(fecha)-ahora.getTime();return {precision,vencido:ms<0,proximo:ms>=0&&ms<=UMBRAL_PROXIMO_A_VENCER_HORAS*3600000};
}
