import { workspaceErrorMessage } from './queries.js';
export class WorkspaceError extends Error {
  constructor(public code:string,public statusCode=409,message?:string){super(message??workspaceErrorMessage(code)??'No se pudo completar el espacio documental.');}
}
