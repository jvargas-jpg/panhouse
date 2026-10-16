import { describe,it,expect } from 'vitest';
import { driveName,resolveWorkspaceTemplate } from '../server/modules/project-workspaces/templates.js';
const template=(code:string,subtype:string|null=null,conditions:string[]=[])=>resolveWorkspaceTemplate({serviceCode:code,crudoSubtype:subtype,conditions,authorName:'  María   Pérez  ',projectCode:'A12345'});
const common=[
  'Corrección','Corrección/Para corregir','Corrección/Corregido','Diseño','Diseño/Tripa para diagramar','Diseño/Tripa para muestra',
  'Diseño/Versiones_para_corregir','Diseño/ISBN','Diseño/Tripa con comentarios','Diseño/Paquete final','Diseño/Paquete final/KDP',
  'Diseño/Paquete final/Artes finales','Diseño/Paquete final/Artes finales/Tripa','Diseño/Paquete final/Artes finales/Cubierta',
  'Diseño/Paquete final/Artes finales/Cubierta/Editables cubierta','Diseño/Paquete final/Editables tripa',
];
const editing=['Edición','Edición/Editado','Edición/Editado/Con feedback','Edición/Editado/Con feedback aplicado',
  'Edición/Tripa completa','Edición/Tripa completa/Con feedback','Edición/Tripa completa/Con feedback aplicado',
  'Edición/Kit editorial','Edición/Kit editorial/Con feedback','Edición/Kit editorial/Con feedback aplicado'];
describe('Templates del manual completo del Especialista',()=>{
  it.each([['EF',null,'EF','Extracciones de contenido'],['CR','Capítulo','CR_CHAPTER','Para editar'],['CR','Tripa','CR_FULL','Para editar']] as const)('%s/%s tiene el árbol exacto y condiciones exclusivas',(code,subtype,key,specific)=>{
    const t=template(code,subtype);expect(t.key).toBe(key);
    expect(t.plan.map(f=>f.templatePath).sort()).toEqual(['/',...common,...editing,'Edición/'+specific].sort());
    expect(t.plan).toHaveLength(28);expect(new Set(t.plan.map(f=>f.key)).size).toBe(t.plan.length);
  });
  it('Sello excluye toda Edición y mantiene Corrección/Diseño/paquete final',()=>expect(template('SE').plan.map(f=>f.templatePath).sort()).toEqual(['/',...common].sort()));
  it('las siglas documentales EEC/EET no se convierten en servicios nuevos',()=>{
    expect(template('CR','Capítulo').plan[0]?.displayName).toBe('María Pérez – EEC – #A12345');
    expect(template('CR','Tripa').plan[0]?.displayName).toBe('María Pérez – EET – #A12345');
    expect(template('EEC').key).toBe('CR_CHAPTER');expect(template('EET').key).toBe('CR_FULL');
  });
  it.each([null,'','inventado'])('Crudo sin subtipo canónico %s queda bloqueado',subtype=>expect(()=>template('CR',subtype)).toThrow('falta definir el subtipo de Crudo'));
  it('solo incluye ilustraciones/gráficos si hay condiciones canónicas',()=>{
    expect(template('EF').plan.some(f=>f.key==='ILLUSTRATIONS'||f.key==='GRAPHICS')).toBe(false);
    const t=template('EF',null,['Ilustraciones','Gráficos','Diagramación especial']);
    expect(t.plan.filter(f=>['ILLUSTRATIONS','GRAPHICS'].includes(f.key)).map(f=>f.parentKey)).toEqual(['ROOT','ROOT']);
    expect(t.plan.some(f=>/fotos|tablas|imágenes/i.test(f.displayName))).toBe(false);
  });
  it('Editables tripa es hijo de Paquete final; mockup/JPG no son carpetas',()=>{
    const t=template('SE');expect(t.plan.find(f=>f.key==='FINAL_MANUSCRIPT_EDITABLES')?.parentKey).toBe('FINAL_PACKAGE');
    expect(t.plan.some(f=>/Mockup|jpg|Cronograma|Diagnóstico|Minuta/.test(f.displayName))).toBe(false);
    expect(t.plan.find(f=>f.key==='QUALITY_COMMENTS')?.parentKey).toBe('DESIGN');
  });
  it('nombres deterministas legibles, acentos, espacios y longitud acotada',()=>{
    expect(driveName('  José\n de\t la / Cruz  ')).toBe('José de la - Cruz');expect(driveName('ñ'.repeat(500))).toHaveLength(180);
    expect(()=>driveName(' \n ')).toThrow();expect(()=>template('UNKNOWN')).toThrow();
    expect(template('EF')).toEqual(template('EF'));
  });
});
