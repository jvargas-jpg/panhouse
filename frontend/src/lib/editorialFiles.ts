import type { EditorialReviewFile } from '../../../shared/editorialReview';
export async function readEditorialFile(file:File):Promise<EditorialReviewFile>{
  if(!file.size||file.size>20*1024*1024)throw new Error('Selecciona un documento Word o PDF de hasta 20 MB.');
  if(!/\.(pdf|doc|docx)$/i.test(file.name))throw new Error('Selecciona un documento Word o PDF.');
  const contentBase64=await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();reader.onerror=()=>reject(new Error('No se pudo leer el documento.'));
    reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file);
  });
  return {name:file.name,contentBase64};
}
