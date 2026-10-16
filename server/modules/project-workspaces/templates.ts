import type { WorkspaceFolderPlan } from '../../db/schema/projectDriveWorkspaces.js';
import { WorkspaceError } from './errors.js';

export const WORKSPACE_TEMPLATE_VERSION='specialist-manual-2026-v1';
export function driveName(value:string,max=180) {
  const normalized=value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/[/\\]/g,' - ').replace(/\s+/g,' ').trim();
  if(!normalized)throw new WorkspaceError('INVALID_NAME',409,'El proyecto necesita un nombre de autor válido.');
  return Array.from(normalized).slice(0,max).join('').trim();
}
export function resolveWorkspaceTemplate(input:{serviceCode:string;crudoSubtype:string|null;authorName:string;projectCode:string;conditions:string[]}) {
  const {serviceCode,crudoSubtype}=input;
  if(serviceCode==='CR'&&!['Capítulo','Tripa'].includes(crudoSubtype??''))throw new WorkspaceError('CRUDO_SUBTYPE_REQUIRED');
  const key=serviceCode==='EF'?'EF':serviceCode==='SE'?'SE':serviceCode==='EEC'||serviceCode==='CR'&&crudoSubtype==='Capítulo'?'CR_CHAPTER':
    serviceCode==='EET'||serviceCode==='CR'&&crudoSubtype==='Tripa'?'CR_FULL':null;
  if(!key)throw new WorkspaceError('UNSUPPORTED_SERVICE',409,'El servicio no tiene una estructura documental validada.');
  const documentaryCode={EF:'EF',SE:'SE',CR_CHAPTER:'EEC',CR_FULL:'EET'}[key];
  const author=driveName(input.authorName,110),rootName=driveName(`${author} – ${documentaryCode} – #${input.projectCode}`);
  const plan:WorkspaceFolderPlan[]=[{key:'ROOT',parentKey:null,displayName:rootName,templatePath:'/'}];
  const add=(folderKey:string,label:string,parentKey='ROOT')=>{
    const parent=plan.find(f=>f.key===parentKey);if(!parent)throw new Error('Template parent must precede child');
    plan.push({key:folderKey,parentKey,displayName:driveName(`${label} – ${author}`),templatePath:(parent.templatePath==='/'?'':parent.templatePath+'/')+label});
  };
  if(key!=='SE') {
    add('EDITING','Edición');add('EDITING_OUTPUT','Editado','EDITING');
    add('EDITING_FEEDBACK','Con feedback','EDITING_OUTPUT');add('EDITING_FEEDBACK_APPLIED','Con feedback aplicado','EDITING_OUTPUT');
    if(key==='EF')add('CONTENT_EXTRACTIONS','Extracciones de contenido','EDITING');else add('EDITING_INPUT','Para editar','EDITING');
    add('FULL_MANUSCRIPT','Tripa completa','EDITING');add('FULL_MANUSCRIPT_FEEDBACK','Con feedback','FULL_MANUSCRIPT');add('FULL_MANUSCRIPT_FEEDBACK_APPLIED','Con feedback aplicado','FULL_MANUSCRIPT');
    add('EDITORIAL_KIT','Kit editorial','EDITING');add('EDITORIAL_KIT_FEEDBACK','Con feedback','EDITORIAL_KIT');add('EDITORIAL_KIT_FEEDBACK_APPLIED','Con feedback aplicado','EDITORIAL_KIT');
  }
  add('CORRECTION','Corrección');add('CORRECTION_INPUT','Para corregir','CORRECTION');add('CORRECTION_OUTPUT','Corregido','CORRECTION');
  add('DESIGN','Diseño');add('DESIGN_LAYOUT_INPUT','Tripa para diagramar','DESIGN');add('DESIGN_SAMPLE','Tripa para muestra','DESIGN');
  add('DESIGN_REVIEW_VERSIONS','Versiones_para_corregir','DESIGN');add('ISBN','ISBN','DESIGN');
  add('QUALITY_COMMENTS','Tripa con comentarios','DESIGN');
  add('FINAL_PACKAGE','Paquete final','DESIGN');add('FINAL_PACKAGE_KDP','KDP','FINAL_PACKAGE');add('FINAL_PACKAGE_ARTS','Artes finales','FINAL_PACKAGE');
  add('FINAL_PRINT_MANUSCRIPT','Tripa','FINAL_PACKAGE_ARTS');add('FINAL_PRINT_COVER','Cubierta','FINAL_PACKAGE_ARTS');
  add('FINAL_COVER_EDITABLES','Editables cubierta','FINAL_PRINT_COVER');add('FINAL_MANUSCRIPT_EDITABLES','Editables tripa','FINAL_PACKAGE');
  if(input.conditions.includes('Ilustraciones'))add('ILLUSTRATIONS','Ilustraciones');
  if(input.conditions.includes('Gráficos'))add('GRAPHICS','Gráficos');
  return {key,version:WORKSPACE_TEMPLATE_VERSION,documentaryCode,plan};
}
