import type { Rol } from '../db/schema/enums.js';

export interface CampoDocumental { area: string; key: string; label: string; type: string; roles: Rol[]; ref: string }
// PED-FOR-001 v2.0: catálogo de campos auditados sin columna canónica previa.
// No contiene datos personales, credenciales ni valores del XLSX original.
export const CAMPOS_DOCUMENTALES: CampoDocumental[] = [
  {
    "area": "proyecto",
    "key": "perfilServicio",
    "label": "Perfil contractual / del proyecto",
    "type": "texto",
    "roles": [
      "comercial"
    ],
    "ref": "PROYECTO!C15"
  },
  {
    "area": "proyecto",
    "key": "observacionesEquipo",
    "label": "Observaciones sobre el equipo",
    "type": "texto",
    "roles": [
      "especialista",
      "jefe_area"
    ],
    "ref": "PROYECTO!I34"
  },
  {
    "area": "edicion",
    "key": "matrizEdicionUrl",
    "label": "Matriz de edición",
    "type": "enlace",
    "roles": [
      "especialista"
    ],
    "ref": "EDICIÓN!B9"
  },
  {
    "area": "edicion",
    "key": "feedbackTripaUrl",
    "label": "Archivo con feedback de tripa completa",
    "type": "enlace",
    "roles": [
      "especialista"
    ],
    "ref": "EDICIÓN!B61"
  },
  {
    "area": "edicion",
    "key": "feedbackTripaAsignacion",
    "label": "Asignación de aplicación de feedback",
    "type": "fecha",
    "roles": [
      "especialista"
    ],
    "ref": "EDICIÓN!B62"
  },
  {
    "area": "edicion",
    "key": "feedbackTripaEntregaPautada",
    "label": "Entrega pautada de feedback aplicado",
    "type": "fecha",
    "roles": [
      "especialista"
    ],
    "ref": "EDICIÓN!B63"
  },
  {
    "area": "edicion",
    "key": "feedbackTripaEntregaReal",
    "label": "Entrega registrada de feedback aplicado",
    "type": "fecha",
    "roles": [
      "especialista"
    ],
    "ref": "EDICIÓN!B64"
  },
  {
    "area": "edicion",
    "key": "feedbackTripaObservaciones",
    "label": "Observaciones de aplicación del feedback",
    "type": "texto",
    "roles": [
      "especialista"
    ],
    "ref": "EDICIÓN!B65"
  },
  {
    "area": "correccion",
    "key": "tripa_15",
    "label": "Tripa · Sintaxis enrevesada",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B15"
  },
  {
    "area": "correccion",
    "key": "tripa_15_observaciones",
    "label": "Tripa · Sintaxis enrevesada · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C15"
  },
  {
    "area": "correccion",
    "key": "preliminares_15",
    "label": "Preliminares · Sintaxis enrevesada",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D15"
  },
  {
    "area": "correccion",
    "key": "preliminares_15_observaciones",
    "label": "Preliminares · Sintaxis enrevesada · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E15"
  },
  {
    "area": "correccion",
    "key": "cubierta_15",
    "label": "Cubierta · Sintaxis enrevesada",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G15"
  },
  {
    "area": "correccion",
    "key": "cubierta_15_observaciones",
    "label": "Cubierta · Sintaxis enrevesada · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H15"
  },
  {
    "area": "correccion",
    "key": "tripa_16",
    "label": "Tripa · Desorden sintáctico",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B16"
  },
  {
    "area": "correccion",
    "key": "tripa_16_observaciones",
    "label": "Tripa · Desorden sintáctico · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C16"
  },
  {
    "area": "correccion",
    "key": "preliminares_16",
    "label": "Preliminares · Desorden sintáctico",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D16"
  },
  {
    "area": "correccion",
    "key": "preliminares_16_observaciones",
    "label": "Preliminares · Desorden sintáctico · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E16"
  },
  {
    "area": "correccion",
    "key": "cubierta_16",
    "label": "Cubierta · Coma criminal",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G16"
  },
  {
    "area": "correccion",
    "key": "cubierta_16_observaciones",
    "label": "Cubierta · Coma criminal · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H16"
  },
  {
    "area": "correccion",
    "key": "tripa_17",
    "label": "Tripa · Coma criminal",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B17"
  },
  {
    "area": "correccion",
    "key": "tripa_17_observaciones",
    "label": "Tripa · Coma criminal · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C17"
  },
  {
    "area": "correccion",
    "key": "preliminares_17",
    "label": "Preliminares · Coma criminal",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D17"
  },
  {
    "area": "correccion",
    "key": "preliminares_17_observaciones",
    "label": "Preliminares · Coma criminal · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E17"
  },
  {
    "area": "correccion",
    "key": "cubierta_17",
    "label": "Cubierta · Repetición de ideas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G17"
  },
  {
    "area": "correccion",
    "key": "cubierta_17_observaciones",
    "label": "Cubierta · Repetición de ideas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H17"
  },
  {
    "area": "correccion",
    "key": "tripa_18",
    "label": "Tripa · Observaciones de contenido",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B18"
  },
  {
    "area": "correccion",
    "key": "tripa_18_observaciones",
    "label": "Tripa · Observaciones de contenido · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C18"
  },
  {
    "area": "correccion",
    "key": "preliminares_18",
    "label": "Preliminares · Observaciones de contenido",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D18"
  },
  {
    "area": "correccion",
    "key": "preliminares_18_observaciones",
    "label": "Preliminares · Observaciones de contenido · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E18"
  },
  {
    "area": "correccion",
    "key": "cubierta_18",
    "label": "Cubierta · Repetición de palabras y términos",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G18"
  },
  {
    "area": "correccion",
    "key": "cubierta_18_observaciones",
    "label": "Cubierta · Repetición de palabras y términos · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H18"
  },
  {
    "area": "correccion",
    "key": "tripa_19",
    "label": "Tripa · Repetición de ideas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B19"
  },
  {
    "area": "correccion",
    "key": "tripa_19_observaciones",
    "label": "Tripa · Repetición de ideas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C19"
  },
  {
    "area": "correccion",
    "key": "preliminares_19",
    "label": "Preliminares · Repetición de ideas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D19"
  },
  {
    "area": "correccion",
    "key": "preliminares_19_observaciones",
    "label": "Preliminares · Repetición de ideas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E19"
  },
  {
    "area": "correccion",
    "key": "cubierta_19",
    "label": "Cubierta · Usa frases destacadas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G19"
  },
  {
    "area": "correccion",
    "key": "cubierta_19_observaciones",
    "label": "Cubierta · Usa frases destacadas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H19"
  },
  {
    "area": "correccion",
    "key": "tripa_20",
    "label": "Tripa · Repetición de palabras y términos",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B20"
  },
  {
    "area": "correccion",
    "key": "tripa_20_observaciones",
    "label": "Tripa · Repetición de palabras y términos · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C20"
  },
  {
    "area": "correccion",
    "key": "preliminares_20",
    "label": "Preliminares · Repetición de palabras y términos",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D20"
  },
  {
    "area": "correccion",
    "key": "preliminares_20_observaciones",
    "label": "Preliminares · Repetición de palabras y términos · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E20"
  },
  {
    "area": "correccion",
    "key": "cubierta_20",
    "label": "Cubierta · Uso inadecuado de comillas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G20"
  },
  {
    "area": "correccion",
    "key": "cubierta_20_observaciones",
    "label": "Cubierta · Uso inadecuado de comillas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H20"
  },
  {
    "area": "correccion",
    "key": "tripa_21",
    "label": "Tripa · Citas sin referencias ",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B21"
  },
  {
    "area": "correccion",
    "key": "tripa_21_observaciones",
    "label": "Tripa · Citas sin referencias  · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C21"
  },
  {
    "area": "correccion",
    "key": "preliminares_21",
    "label": "Preliminares · Citas sin referencias ",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D21"
  },
  {
    "area": "correccion",
    "key": "preliminares_21_observaciones",
    "label": "Preliminares · Citas sin referencias  · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E21"
  },
  {
    "area": "correccion",
    "key": "cubierta_21",
    "label": "Cubierta · Hace cambios inadecuados en las conjugaciones verbales",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G21"
  },
  {
    "area": "correccion",
    "key": "cubierta_21_observaciones",
    "label": "Cubierta · Hace cambios inadecuados en las conjugaciones verbales · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H21"
  },
  {
    "area": "correccion",
    "key": "tripa_22",
    "label": "Tripa · Cambios inadecuados en las conjugaciones verbales",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B22"
  },
  {
    "area": "correccion",
    "key": "tripa_22_observaciones",
    "label": "Tripa · Cambios inadecuados en las conjugaciones verbales · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C22"
  },
  {
    "area": "correccion",
    "key": "preliminares_22",
    "label": "Preliminares · Cambios inadecuados en las conjugaciones verbales",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D22"
  },
  {
    "area": "correccion",
    "key": "preliminares_22_observaciones",
    "label": "Preliminares · Cambios inadecuados en las conjugaciones verbales · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E22"
  },
  {
    "area": "correccion",
    "key": "cubierta_22",
    "label": "Cubierta · Formato incorrecto de citación",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G22"
  },
  {
    "area": "correccion",
    "key": "cubierta_22_observaciones",
    "label": "Cubierta · Formato incorrecto de citación · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H22"
  },
  {
    "area": "correccion",
    "key": "tripa_23",
    "label": "Tripa · Referencias religiosas con errores",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B23"
  },
  {
    "area": "correccion",
    "key": "tripa_23_observaciones",
    "label": "Tripa · Referencias religiosas con errores · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C23"
  },
  {
    "area": "correccion",
    "key": "preliminares_23",
    "label": "Preliminares · Referencias religiosas con errores",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D23"
  },
  {
    "area": "correccion",
    "key": "preliminares_23_observaciones",
    "label": "Preliminares · Referencias religiosas con errores · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E23"
  },
  {
    "area": "correccion",
    "key": "cubierta_23",
    "label": "Cubierta · Contenido repetitivo",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G23"
  },
  {
    "area": "correccion",
    "key": "cubierta_23_observaciones",
    "label": "Cubierta · Contenido repetitivo · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H23"
  },
  {
    "area": "correccion",
    "key": "tripa_24",
    "label": "Tripa · Usa frases destacadas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B24"
  },
  {
    "area": "correccion",
    "key": "tripa_24_observaciones",
    "label": "Tripa · Usa frases destacadas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C24"
  },
  {
    "area": "correccion",
    "key": "preliminares_24",
    "label": "Preliminares · Usa frases destacadas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D24"
  },
  {
    "area": "correccion",
    "key": "preliminares_24_observaciones",
    "label": "Preliminares · Usa frases destacadas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E24"
  },
  {
    "area": "correccion",
    "key": "cubierta_24",
    "label": "Cubierta · Faltas de acentuación",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G24"
  },
  {
    "area": "correccion",
    "key": "cubierta_24_observaciones",
    "label": "Cubierta · Faltas de acentuación · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H24"
  },
  {
    "area": "correccion",
    "key": "tripa_25",
    "label": "Tripa · Uso inadecuado de comillas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B25"
  },
  {
    "area": "correccion",
    "key": "tripa_25_observaciones",
    "label": "Tripa · Uso inadecuado de comillas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C25"
  },
  {
    "area": "correccion",
    "key": "preliminares_25",
    "label": "Preliminares · Uso inadecuado de comillas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D25"
  },
  {
    "area": "correccion",
    "key": "preliminares_25_observaciones",
    "label": "Preliminares · Uso inadecuado de comillas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E25"
  },
  {
    "area": "correccion",
    "key": "cubierta_25",
    "label": "Cubierta · Falta de cursivas para palabras en otros idiomas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G25"
  },
  {
    "area": "correccion",
    "key": "cubierta_25_observaciones",
    "label": "Cubierta · Falta de cursivas para palabras en otros idiomas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H25"
  },
  {
    "area": "correccion",
    "key": "tripa_26",
    "label": "Tripa · Formato incorrecto de citación",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B26"
  },
  {
    "area": "correccion",
    "key": "tripa_26_observaciones",
    "label": "Tripa · Formato incorrecto de citación · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C26"
  },
  {
    "area": "correccion",
    "key": "preliminares_26",
    "label": "Preliminares · Formato incorrecto de citación",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D26"
  },
  {
    "area": "correccion",
    "key": "preliminares_26_observaciones",
    "label": "Preliminares · Formato incorrecto de citación · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E26"
  },
  {
    "area": "correccion",
    "key": "cubierta_26",
    "label": "Cubierta · Mayúsculas o minúsculas mal empleadas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G26"
  },
  {
    "area": "correccion",
    "key": "cubierta_26_observaciones",
    "label": "Cubierta · Mayúsculas o minúsculas mal empleadas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H26"
  },
  {
    "area": "correccion",
    "key": "tripa_27",
    "label": "Tripa · Formato incorrecto de texto",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B27"
  },
  {
    "area": "correccion",
    "key": "tripa_27_observaciones",
    "label": "Tripa · Formato incorrecto de texto · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C27"
  },
  {
    "area": "correccion",
    "key": "preliminares_27",
    "label": "Preliminares · Formato incorrecto de texto",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D27"
  },
  {
    "area": "correccion",
    "key": "preliminares_27_observaciones",
    "label": "Preliminares · Formato incorrecto de texto · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E27"
  },
  {
    "area": "correccion",
    "key": "cubierta_27",
    "label": "Cubierta · Mal uso de signos de puntación: puntos, guiones, exclamación, interrogación y comas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G27"
  },
  {
    "area": "correccion",
    "key": "cubierta_27_observaciones",
    "label": "Cubierta · Mal uso de signos de puntación: puntos, guiones, exclamación, interrogación y comas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H27"
  },
  {
    "area": "correccion",
    "key": "tripa_28",
    "label": "Tripa · Mal uso de signos de puntación: puntos, guiones, exclamación, interrogación y comas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B28"
  },
  {
    "area": "correccion",
    "key": "tripa_28_observaciones",
    "label": "Tripa · Mal uso de signos de puntación: puntos, guiones, exclamación, interrogación y comas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C28"
  },
  {
    "area": "correccion",
    "key": "preliminares_28",
    "label": "Preliminares · Mal uso de signos de puntación: puntos, guiones, exclamación, interrogación y comas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D28"
  },
  {
    "area": "correccion",
    "key": "preliminares_28_observaciones",
    "label": "Preliminares · Mal uso de signos de puntación: puntos, guiones, exclamación, interrogación y comas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E28"
  },
  {
    "area": "correccion",
    "key": "cubierta_28",
    "label": "Cubierta · Logo PH tapa, lomo y contraportada",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G28"
  },
  {
    "area": "correccion",
    "key": "cubierta_28_observaciones",
    "label": "Cubierta · Logo PH tapa, lomo y contraportada · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H28"
  },
  {
    "area": "correccion",
    "key": "tripa_29",
    "label": "Tripa · Desvío de la estructura",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B29"
  },
  {
    "area": "correccion",
    "key": "tripa_29_observaciones",
    "label": "Tripa · Desvío de la estructura · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C29"
  },
  {
    "area": "correccion",
    "key": "preliminares_29",
    "label": "Preliminares · Desvío de la estructura",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D29"
  },
  {
    "area": "correccion",
    "key": "preliminares_29_observaciones",
    "label": "Preliminares · Desvío de la estructura · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E29"
  },
  {
    "area": "correccion",
    "key": "cubierta_29",
    "label": "Cubierta · Nombre y apellido autor",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G29"
  },
  {
    "area": "correccion",
    "key": "cubierta_29_observaciones",
    "label": "Cubierta · Nombre y apellido autor · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H29"
  },
  {
    "area": "correccion",
    "key": "tripa_30",
    "label": "Tripa · Contenido repetitivo",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B30"
  },
  {
    "area": "correccion",
    "key": "tripa_30_observaciones",
    "label": "Tripa · Contenido repetitivo · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C30"
  },
  {
    "area": "correccion",
    "key": "preliminares_30",
    "label": "Preliminares · Contenido repetitivo",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D30"
  },
  {
    "area": "correccion",
    "key": "preliminares_30_observaciones",
    "label": "Preliminares · Contenido repetitivo · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E30"
  },
  {
    "area": "correccion",
    "key": "cubierta_30",
    "label": "Cubierta · Espacio entre palabras",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G30"
  },
  {
    "area": "correccion",
    "key": "cubierta_30_observaciones",
    "label": "Cubierta · Espacio entre palabras · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H30"
  },
  {
    "area": "correccion",
    "key": "tripa_31",
    "label": "Tripa · Subtítulo divorciado del texto",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B31"
  },
  {
    "area": "correccion",
    "key": "tripa_31_observaciones",
    "label": "Tripa · Subtítulo divorciado del texto · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C31"
  },
  {
    "area": "correccion",
    "key": "preliminares_31",
    "label": "Preliminares · Subtítulo divorciado del texto",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D31"
  },
  {
    "area": "correccion",
    "key": "preliminares_31_observaciones",
    "label": "Preliminares · Subtítulo divorciado del texto · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E31"
  },
  {
    "area": "correccion",
    "key": "cubierta_31",
    "label": "Cubierta · Lomo con título",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G31"
  },
  {
    "area": "correccion",
    "key": "cubierta_31_observaciones",
    "label": "Cubierta · Lomo con título · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H31"
  },
  {
    "area": "correccion",
    "key": "tripa_32",
    "label": "Tripa · Falta de concordancia de género y número",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B32"
  },
  {
    "area": "correccion",
    "key": "tripa_32_observaciones",
    "label": "Tripa · Falta de concordancia de género y número · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C32"
  },
  {
    "area": "correccion",
    "key": "preliminares_32",
    "label": "Preliminares · Falta de concordancia de género y número",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D32"
  },
  {
    "area": "correccion",
    "key": "preliminares_32_observaciones",
    "label": "Preliminares · Falta de concordancia de género y número · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E32"
  },
  {
    "area": "correccion",
    "key": "cubierta_32",
    "label": "Cubierta · Imágenes de calidad",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G32"
  },
  {
    "area": "correccion",
    "key": "cubierta_32_observaciones",
    "label": "Cubierta · Imágenes de calidad · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H32"
  },
  {
    "area": "correccion",
    "key": "tripa_33",
    "label": "Tripa · Falta de cursivas en extranjerismos",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B33"
  },
  {
    "area": "correccion",
    "key": "tripa_33_observaciones",
    "label": "Tripa · Falta de cursivas en extranjerismos · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C33"
  },
  {
    "area": "correccion",
    "key": "preliminares_33",
    "label": "Preliminares · Falta de cursivas en extranjerismos",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D33"
  },
  {
    "area": "correccion",
    "key": "preliminares_33_observaciones",
    "label": "Preliminares · Falta de cursivas en extranjerismos · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E33"
  },
  {
    "area": "correccion",
    "key": "cubierta_33",
    "label": "Cubierta · Logo del autor",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G33"
  },
  {
    "area": "correccion",
    "key": "cubierta_33_observaciones",
    "label": "Cubierta · Logo del autor · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H33"
  },
  {
    "area": "correccion",
    "key": "tripa_34",
    "label": "Tripa · Mayúsculas o minúsculas mal empleadas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B34"
  },
  {
    "area": "correccion",
    "key": "tripa_34_observaciones",
    "label": "Tripa · Mayúsculas o minúsculas mal empleadas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C34"
  },
  {
    "area": "correccion",
    "key": "preliminares_34",
    "label": "Preliminares · Mayúsculas o minúsculas mal empleadas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D34"
  },
  {
    "area": "correccion",
    "key": "preliminares_34_observaciones",
    "label": "Preliminares · Mayúsculas o minúsculas mal empleadas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E34"
  },
  {
    "area": "correccion",
    "key": "cubierta_34",
    "label": "Cubierta · Redes sociales autor",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G34"
  },
  {
    "area": "correccion",
    "key": "cubierta_34_observaciones",
    "label": "Cubierta · Redes sociales autor · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H34"
  },
  {
    "area": "correccion",
    "key": "tripa_35",
    "label": "Tripa · Faltas de acentuación",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B35"
  },
  {
    "area": "correccion",
    "key": "tripa_35_observaciones",
    "label": "Tripa · Faltas de acentuación · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C35"
  },
  {
    "area": "correccion",
    "key": "preliminares_35",
    "label": "Preliminares · Faltas de acentuación",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D35"
  },
  {
    "area": "correccion",
    "key": "preliminares_35_observaciones",
    "label": "Preliminares · Faltas de acentuación · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E35"
  },
  {
    "area": "correccion",
    "key": "cubierta_35",
    "label": "Cubierta · Título",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G35"
  },
  {
    "area": "correccion",
    "key": "cubierta_35_observaciones",
    "label": "Cubierta · Título · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H35"
  },
  {
    "area": "correccion",
    "key": "tripa_36",
    "label": "Tripa · Gerundio de posterioridad",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B36"
  },
  {
    "area": "correccion",
    "key": "tripa_36_observaciones",
    "label": "Tripa · Gerundio de posterioridad · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C36"
  },
  {
    "area": "correccion",
    "key": "preliminares_36",
    "label": "Preliminares · Gerundio de posterioridad",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D36"
  },
  {
    "area": "correccion",
    "key": "preliminares_36_observaciones",
    "label": "Preliminares · Gerundio de posterioridad · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E36"
  },
  {
    "area": "correccion",
    "key": "cubierta_36",
    "label": "Cubierta · Subtítulo",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!G36"
  },
  {
    "area": "correccion",
    "key": "cubierta_36_observaciones",
    "label": "Cubierta · Subtítulo · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!H36"
  },
  {
    "area": "correccion",
    "key": "tripa_37",
    "label": "Tripa · Combinacion de cifras en letra y números",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B37"
  },
  {
    "area": "correccion",
    "key": "tripa_37_observaciones",
    "label": "Tripa · Combinacion de cifras en letra y números · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C37"
  },
  {
    "area": "correccion",
    "key": "preliminares_37",
    "label": "Preliminares · Combinacion de cifras en letra y números",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D37"
  },
  {
    "area": "correccion",
    "key": "preliminares_37_observaciones",
    "label": "Preliminares · Combinacion de cifras en letra y números · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E37"
  },
  {
    "area": "correccion",
    "key": "tripa_38",
    "label": "Tripa · Mayúsculas después de dos puntos",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B38"
  },
  {
    "area": "correccion",
    "key": "tripa_38_observaciones",
    "label": "Tripa · Mayúsculas después de dos puntos · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C38"
  },
  {
    "area": "correccion",
    "key": "preliminares_38",
    "label": "Preliminares · Mayúsculas después de dos puntos",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D38"
  },
  {
    "area": "correccion",
    "key": "preliminares_38_observaciones",
    "label": "Preliminares · Mayúsculas después de dos puntos · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E38"
  },
  {
    "area": "correccion",
    "key": "tripa_39",
    "label": "Tripa · Inconsistencia de la persona gramatical",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B39"
  },
  {
    "area": "correccion",
    "key": "tripa_39_observaciones",
    "label": "Tripa · Inconsistencia de la persona gramatical · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C39"
  },
  {
    "area": "correccion",
    "key": "preliminares_39",
    "label": "Preliminares · Inconsistencia de la persona gramatical",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D39"
  },
  {
    "area": "correccion",
    "key": "preliminares_39_observaciones",
    "label": "Preliminares · Inconsistencia de la persona gramatical · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E39"
  },
  {
    "area": "correccion",
    "key": "tripa_40",
    "label": "Tripa · Coma después de pero antes de interroganción",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B40"
  },
  {
    "area": "correccion",
    "key": "tripa_40_observaciones",
    "label": "Tripa · Coma después de pero antes de interroganción · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C40"
  },
  {
    "area": "correccion",
    "key": "preliminares_40",
    "label": "Preliminares · Coma después de pero antes de interroganción",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D40"
  },
  {
    "area": "correccion",
    "key": "preliminares_40_observaciones",
    "label": "Preliminares · Coma después de pero antes de interroganción · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E40"
  },
  {
    "area": "correccion",
    "key": "tripa_41",
    "label": "Tripa · Coma en falsos conectores",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B41"
  },
  {
    "area": "correccion",
    "key": "tripa_41_observaciones",
    "label": "Tripa · Coma en falsos conectores · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C41"
  },
  {
    "area": "correccion",
    "key": "preliminares_41",
    "label": "Preliminares · Coma en falsos conectores",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D41"
  },
  {
    "area": "correccion",
    "key": "preliminares_41_observaciones",
    "label": "Preliminares · Coma en falsos conectores · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E41"
  },
  {
    "area": "correccion",
    "key": "tripa_42",
    "label": "Tripa · Mal uso de las abreviaturas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B42"
  },
  {
    "area": "correccion",
    "key": "tripa_42_observaciones",
    "label": "Tripa · Mal uso de las abreviaturas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C42"
  },
  {
    "area": "correccion",
    "key": "preliminares_42",
    "label": "Preliminares · Mal uso de las abreviaturas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D42"
  },
  {
    "area": "correccion",
    "key": "preliminares_42_observaciones",
    "label": "Preliminares · Mal uso de las abreviaturas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E42"
  },
  {
    "area": "correccion",
    "key": "tripa_43",
    "label": "Tripa · Punto antes de la comilla de cierre",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B43"
  },
  {
    "area": "correccion",
    "key": "tripa_43_observaciones",
    "label": "Tripa · Punto antes de la comilla de cierre · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C43"
  },
  {
    "area": "correccion",
    "key": "preliminares_43",
    "label": "Preliminares · Punto antes de la comilla de cierre",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D43"
  },
  {
    "area": "correccion",
    "key": "preliminares_43_observaciones",
    "label": "Preliminares · Punto antes de la comilla de cierre · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E43"
  },
  {
    "area": "correccion",
    "key": "tripa_44",
    "label": "Tripa · Desdoblamiento de género",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B44"
  },
  {
    "area": "correccion",
    "key": "tripa_44_observaciones",
    "label": "Tripa · Desdoblamiento de género · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C44"
  },
  {
    "area": "correccion",
    "key": "preliminares_44",
    "label": "Preliminares · Desdoblamiento de género",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D44"
  },
  {
    "area": "correccion",
    "key": "preliminares_44_observaciones",
    "label": "Preliminares · Desdoblamiento de género · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E44"
  },
  {
    "area": "correccion",
    "key": "tripa_45",
    "label": "Tripa · Dequeísmo y Queísmo",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B45"
  },
  {
    "area": "correccion",
    "key": "tripa_45_observaciones",
    "label": "Tripa · Dequeísmo y Queísmo · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C45"
  },
  {
    "area": "correccion",
    "key": "preliminares_45",
    "label": "Preliminares · Dequeísmo y Queísmo",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D45"
  },
  {
    "area": "correccion",
    "key": "preliminares_45_observaciones",
    "label": "Preliminares · Dequeísmo y Queísmo · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E45"
  },
  {
    "area": "correccion",
    "key": "tripa_46",
    "label": "Tripa · Leísmo, Laísmo y Loísmo",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B46"
  },
  {
    "area": "correccion",
    "key": "tripa_46_observaciones",
    "label": "Tripa · Leísmo, Laísmo y Loísmo · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C46"
  },
  {
    "area": "correccion",
    "key": "preliminares_46",
    "label": "Preliminares · Leísmo, Laísmo y Loísmo",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D46"
  },
  {
    "area": "correccion",
    "key": "preliminares_46_observaciones",
    "label": "Preliminares · Leísmo, Laísmo y Loísmo · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E46"
  },
  {
    "area": "correccion",
    "key": "tripa_47",
    "label": "Tripa · Fórmula y/o",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B47"
  },
  {
    "area": "correccion",
    "key": "tripa_47_observaciones",
    "label": "Tripa · Fórmula y/o · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C47"
  },
  {
    "area": "correccion",
    "key": "preliminares_47",
    "label": "Preliminares · Fórmula y/o",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D47"
  },
  {
    "area": "correccion",
    "key": "preliminares_47_observaciones",
    "label": "Preliminares · Fórmula y/o · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E47"
  },
  {
    "area": "correccion",
    "key": "tripa_48",
    "label": "Tripa · Adjetivo relacional antepuesto",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B48"
  },
  {
    "area": "correccion",
    "key": "tripa_48_observaciones",
    "label": "Tripa · Adjetivo relacional antepuesto · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C48"
  },
  {
    "area": "correccion",
    "key": "preliminares_48",
    "label": "Preliminares · Adjetivo relacional antepuesto",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D48"
  },
  {
    "area": "correccion",
    "key": "preliminares_48_observaciones",
    "label": "Preliminares · Adjetivo relacional antepuesto · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E48"
  },
  {
    "area": "correccion",
    "key": "tripa_49",
    "label": "Tripa · Prefijos sin soldar",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B49"
  },
  {
    "area": "correccion",
    "key": "tripa_49_observaciones",
    "label": "Tripa · Prefijos sin soldar · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C49"
  },
  {
    "area": "correccion",
    "key": "preliminares_49",
    "label": "Preliminares · Prefijos sin soldar",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D49"
  },
  {
    "area": "correccion",
    "key": "preliminares_49_observaciones",
    "label": "Preliminares · Prefijos sin soldar · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E49"
  },
  {
    "area": "correccion",
    "key": "tripa_50",
    "label": "Tripa · Problemas de tipeo",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B50"
  },
  {
    "area": "correccion",
    "key": "tripa_50_observaciones",
    "label": "Tripa · Problemas de tipeo · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C50"
  },
  {
    "area": "correccion",
    "key": "preliminares_50",
    "label": "Preliminares · Problemas de tipeo",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D50"
  },
  {
    "area": "correccion",
    "key": "preliminares_50_observaciones",
    "label": "Preliminares · Problemas de tipeo · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E50"
  },
  {
    "area": "correccion",
    "key": "tripa_51",
    "label": "Tripa · Errores ortográficos por homonimia",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B51"
  },
  {
    "area": "correccion",
    "key": "tripa_51_observaciones",
    "label": "Tripa · Errores ortográficos por homonimia · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C51"
  },
  {
    "area": "correccion",
    "key": "preliminares_51",
    "label": "Preliminares · Errores ortográficos por homonimia",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D51"
  },
  {
    "area": "correccion",
    "key": "preliminares_51_observaciones",
    "label": "Preliminares · Errores ortográficos por homonimia · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E51"
  },
  {
    "area": "correccion",
    "key": "tripa_52",
    "label": "Tripa · Confusión de preposiciones",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B52"
  },
  {
    "area": "correccion",
    "key": "tripa_52_observaciones",
    "label": "Tripa · Confusión de preposiciones · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C52"
  },
  {
    "area": "correccion",
    "key": "preliminares_52",
    "label": "Preliminares · Confusión de preposiciones",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D52"
  },
  {
    "area": "correccion",
    "key": "preliminares_52_observaciones",
    "label": "Preliminares · Confusión de preposiciones · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E52"
  },
  {
    "area": "correccion",
    "key": "tripa_53",
    "label": "Tripa · Impropiedad léxica",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B53"
  },
  {
    "area": "correccion",
    "key": "tripa_53_observaciones",
    "label": "Tripa · Impropiedad léxica · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C53"
  },
  {
    "area": "correccion",
    "key": "preliminares_53",
    "label": "Preliminares · Impropiedad léxica",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D53"
  },
  {
    "area": "correccion",
    "key": "preliminares_53_observaciones",
    "label": "Preliminares · Impropiedad léxica · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E53"
  },
  {
    "area": "correccion",
    "key": "tripa_54",
    "label": "Tripa · Ambigüedades, barbarismos y perogrulladas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B54"
  },
  {
    "area": "correccion",
    "key": "tripa_54_observaciones",
    "label": "Tripa · Ambigüedades, barbarismos y perogrulladas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C54"
  },
  {
    "area": "correccion",
    "key": "preliminares_54",
    "label": "Preliminares · Ambigüedades, barbarismos y perogrulladas",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D54"
  },
  {
    "area": "correccion",
    "key": "preliminares_54_observaciones",
    "label": "Preliminares · Ambigüedades, barbarismos y perogrulladas · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E54"
  },
  {
    "area": "correccion",
    "key": "tripa_55",
    "label": "Tripa · Cacofonías",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B55"
  },
  {
    "area": "correccion",
    "key": "tripa_55_observaciones",
    "label": "Tripa · Cacofonías · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C55"
  },
  {
    "area": "correccion",
    "key": "preliminares_55",
    "label": "Preliminares · Cacofonías",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D55"
  },
  {
    "area": "correccion",
    "key": "preliminares_55_observaciones",
    "label": "Preliminares · Cacofonías · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E55"
  },
  {
    "area": "correccion",
    "key": "tripa_56",
    "label": "Tripa · Plagio",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!B56"
  },
  {
    "area": "correccion",
    "key": "tripa_56_observaciones",
    "label": "Tripa · Plagio · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!C56"
  },
  {
    "area": "correccion",
    "key": "preliminares_56",
    "label": "Preliminares · Plagio",
    "type": "booleano",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!D56"
  },
  {
    "area": "correccion",
    "key": "preliminares_56_observaciones",
    "label": "Preliminares · Plagio · Observaciones",
    "type": "texto",
    "roles": [
      "corrector",
      "especialista"
    ],
    "ref": "CORRECCIÓN!E56"
  },
  {
    "area": "diseno",
    "key": "contenidoAdicionalTipo",
    "label": "Tipo de archivo adicional",
    "type": "texto",
    "roles": [
      "especialista",
      "disenador"
    ],
    "ref": "DISEÑO Y DIAGRAMACIÓN!B42"
  },
  {
    "area": "diseno",
    "key": "contenidoAdicionalAsignacion",
    "label": "Asignación de contenido adicional",
    "type": "fecha",
    "roles": [
      "especialista",
      "disenador"
    ],
    "ref": "DISEÑO Y DIAGRAMACIÓN!B43"
  },
  {
    "area": "diseno",
    "key": "contenidoAdicionalEntrega",
    "label": "Entrega de contenido adicional",
    "type": "fecha",
    "roles": [
      "especialista",
      "disenador"
    ],
    "ref": "DISEÑO Y DIAGRAMACIÓN!B44"
  },
  {
    "area": "diseno",
    "key": "contenidoAdicionalObservaciones",
    "label": "Observaciones de contenido adicional",
    "type": "texto",
    "roles": [
      "especialista",
      "disenador"
    ],
    "ref": "DISEÑO Y DIAGRAMACIÓN!B45"
  },
  {
    "area": "diseno",
    "key": "paqueteFinalAsignacion",
    "label": "Asignación del paquete final",
    "type": "fecha",
    "roles": [
      "especialista",
      "disenador"
    ],
    "ref": "DISEÑO Y DIAGRAMACIÓN!B47"
  },
  {
    "area": "diseno",
    "key": "paqueteFinalArchivos",
    "label": "Archivos cargados en la carpeta",
    "type": "texto",
    "roles": [
      "especialista",
      "disenador"
    ],
    "ref": "DISEÑO Y DIAGRAMACIÓN!B48"
  },
  {
    "area": "diseno",
    "key": "paqueteFinalCargado",
    "label": "Paquete final cargado",
    "type": "booleano",
    "roles": [
      "especialista",
      "disenador"
    ],
    "ref": "DISEÑO Y DIAGRAMACIÓN!B49"
  },
  {
    "area": "diseno",
    "key": "paqueteFinalEntrega",
    "label": "Entrega de paquete final",
    "type": "fecha",
    "roles": [
      "especialista",
      "disenador"
    ],
    "ref": "DISEÑO Y DIAGRAMACIÓN!B50"
  },
  {
    "area": "diseno",
    "key": "paqueteFinalObservaciones",
    "label": "Observaciones del paquete final",
    "type": "texto",
    "roles": [
      "especialista",
      "disenador"
    ],
    "ref": "DISEÑO Y DIAGRAMACIÓN!B51"
  },
  {
    "area": "digital",
    "key": "recepcionFormulario",
    "label": "Recepción de formulario Amazon",
    "type": "fecha",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B11"
  },
  {
    "area": "digital",
    "key": "creacionCuenta",
    "label": "Creación de cuenta Amazon",
    "type": "fecha",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B12"
  },
  {
    "area": "digital",
    "key": "observacionesRegistro",
    "label": "Observaciones de registro",
    "type": "texto",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B13"
  },
  {
    "area": "digital",
    "key": "reunionCriterios",
    "label": "Reunión de criterios Amazon",
    "type": "fecha",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B15"
  },
  {
    "area": "digital",
    "key": "grabacionCriterios",
    "label": "Grabación de criterios Amazon",
    "type": "enlace",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B16"
  },
  {
    "area": "digital",
    "key": "tapa",
    "label": "Tapa Amazon",
    "type": "texto",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B17"
  },
  {
    "area": "digital",
    "key": "portada",
    "label": "Portada Amazon",
    "type": "texto",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B18"
  },
  {
    "area": "digital",
    "key": "papel",
    "label": "Papel Amazon",
    "type": "texto",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B19"
  },
  {
    "area": "digital",
    "key": "precioKdp",
    "label": "Precio de venta KDP acordado",
    "type": "texto",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B20"
  },
  {
    "area": "digital",
    "key": "precioKindle",
    "label": "Precio de venta Kindle acordado",
    "type": "texto",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B21"
  },
  {
    "area": "digital",
    "key": "lanzamientoAmazon",
    "label": "Lanzamiento en Amazon acordado",
    "type": "fecha",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B22"
  },
  {
    "area": "digital",
    "key": "observacionesCriterios",
    "label": "Observaciones de criterios Amazon",
    "type": "texto",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B23"
  },
  {
    "area": "digital",
    "key": "pruebaArchivos",
    "label": "Prueba de archivos KDP en Amazon",
    "type": "fecha",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B25"
  },
  {
    "area": "digital",
    "key": "cargaKdp",
    "label": "Carga de archivos KDP",
    "type": "fecha",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B26"
  },
  {
    "area": "digital",
    "key": "cargaKindle",
    "label": "Carga de archivos Kindle",
    "type": "fecha",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B27"
  },
  {
    "area": "digital",
    "key": "induccion",
    "label": "Reunión de inducción Amazon",
    "type": "fecha",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B29"
  },
  {
    "area": "digital",
    "key": "grabacionInduccion",
    "label": "Grabación de inducción Amazon",
    "type": "enlace",
    "roles": [
      "soporte_digital"
    ],
    "ref": "SOPORTE DIGITAL!B30"
  },
  {
    "area": "impresion",
    "key": "fechaReunion",
    "label": "Reunión de impresión",
    "type": "fecha",
    "roles": [
      "impresion"
    ],
    "ref": "IMPRESIÓN!B7"
  },
  {
    "area": "impresion",
    "key": "tamanoLibro",
    "label": "Tamaño del libro (pulgadas)",
    "type": "texto",
    "roles": [
      "impresion"
    ],
    "ref": "IMPRESIÓN!B14"
  },
  {
    "area": "impresion",
    "key": "paginasImprenta",
    "label": "Páginas del archivo de imprenta",
    "type": "numero",
    "roles": [
      "impresion"
    ],
    "ref": "IMPRESIÓN!B15"
  },
  {
    "area": "impresion",
    "key": "tipoPapel",
    "label": "Tipo de papel",
    "type": "texto",
    "roles": [
      "impresion"
    ],
    "ref": "IMPRESIÓN!B16"
  },
  {
    "area": "impresion",
    "key": "materialPortada",
    "label": "Material de portada",
    "type": "texto",
    "roles": [
      "impresion"
    ],
    "ref": "IMPRESIÓN!B17"
  },
  {
    "area": "impresion",
    "key": "colorPapel",
    "label": "Color de impresión del papel",
    "type": "texto",
    "roles": [
      "impresion"
    ],
    "ref": "IMPRESIÓN!B18"
  },
  {
    "area": "impresion",
    "key": "formatoPortada",
    "label": "Formato de portada",
    "type": "texto",
    "roles": [
      "impresion"
    ],
    "ref": "IMPRESIÓN!B19"
  },
  {
    "area": "impresion",
    "key": "colorPortada",
    "label": "Color de impresión de portada",
    "type": "texto",
    "roles": [
      "impresion"
    ],
    "ref": "IMPRESIÓN!B20"
  },
  {
    "area": "impresion",
    "key": "acabadoPortada",
    "label": "Acabado de portada",
    "type": "texto",
    "roles": [
      "impresion"
    ],
    "ref": "IMPRESIÓN!B21"
  },
  {
    "area": "impresion",
    "key": "criteriosPortada",
    "label": "Criterios especiales de portada",
    "type": "texto",
    "roles": [
      "impresion"
    ],
    "ref": "IMPRESIÓN!B22"
  },
  {
    "area": "impresion",
    "key": "solapas",
    "label": "Solapas",
    "type": "texto",
    "roles": [
      "impresion"
    ],
    "ref": "IMPRESIÓN!B23"
  },
  {
    "area": "impresion",
    "key": "termosellado",
    "label": "Termosellado",
    "type": "texto",
    "roles": [
      "impresion"
    ],
    "ref": "IMPRESIÓN!B24"
  },
  {
    "area": "impresion",
    "key": "encuadernacion",
    "label": "Encuadernación",
    "type": "texto",
    "roles": [
      "impresion"
    ],
    "ref": "IMPRESIÓN!B25"
  },
  {
    "area": "impresion",
    "key": "cantidadLibros",
    "label": "Cantidad de libros a imprimir",
    "type": "numero",
    "roles": [
      "impresion"
    ],
    "ref": "IMPRESIÓN!B26"
  },
  {
    "area": "impresion",
    "key": "otroMaterialPortada",
    "label": "Otro material de portada",
    "type": "texto",
    "roles": [
      "impresion"
    ],
    "ref": "IMPRESIÓN!E17"
  },
  {
    "area": "distribucion",
    "key": "fechaReunion",
    "label": "Reunión de distribución",
    "type": "fecha",
    "roles": [
      "distribucion"
    ],
    "ref": "DISTRIBUCIÓN!B7"
  },
  {
    "area": "distribucion",
    "key": "observacionesReunion",
    "label": "Observaciones de reunión de distribución",
    "type": "texto",
    "roles": [
      "distribucion"
    ],
    "ref": "DISTRIBUCIÓN!B9"
  },
  {
    "area": "distribucion",
    "key": "contratoInicio",
    "label": "Inicio del contrato de distribución",
    "type": "fecha",
    "roles": [
      "distribucion"
    ],
    "ref": "DISTRIBUCIÓN!B11"
  },
  {
    "area": "distribucion",
    "key": "contratoFin",
    "label": "Fin del contrato de distribución",
    "type": "fecha",
    "roles": [
      "distribucion"
    ],
    "ref": "DISTRIBUCIÓN!B12"
  },
  {
    "area": "distribucion",
    "key": "medios",
    "label": "Medios de distribución",
    "type": "texto",
    "roles": [
      "distribucion"
    ],
    "ref": "DISTRIBUCIÓN!B15"
  },
  {
    "area": "distribucion",
    "key": "ejemplares",
    "label": "Ejemplares a distribuir",
    "type": "numero",
    "roles": [
      "distribucion"
    ],
    "ref": "DISTRIBUCIÓN!B16"
  },
  {
    "area": "distribucion",
    "key": "detalles",
    "label": "Detalles de distribución",
    "type": "texto",
    "roles": [
      "distribucion"
    ],
    "ref": "DISTRIBUCIÓN!B17"
  },
  {
    "area": "distribucion",
    "key": "isbn",
    "label": "ISBN para distribución",
    "type": "texto",
    "roles": [
      "distribucion"
    ],
    "ref": "DISTRIBUCIÓN!B18"
  },
  {
    "area": "distribucion",
    "key": "requiereIsbn",
    "label": "¿Se debe tramitar ISBN nuevo?",
    "type": "booleano",
    "roles": [
      "distribucion"
    ],
    "ref": "DISTRIBUCIÓN!B19"
  },
  {
    "area": "distribucion",
    "key": "nuevoIsbn",
    "label": "Nuevo ISBN",
    "type": "texto",
    "roles": [
      "distribucion"
    ],
    "ref": "DISTRIBUCIÓN!B20"
  },
  {
    "area": "distribucion",
    "key": "detallesIsbn",
    "label": "Detalles de gestión ISBN",
    "type": "texto",
    "roles": [
      "distribucion"
    ],
    "ref": "DISTRIBUCIÓN!B21"
  }
];
