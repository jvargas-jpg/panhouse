// Traduce los nombres en español de PAISES (autores/paises.ts) al nombre
// en inglés que usa el topojson de world-atlas (properties.name) — ver
// MapaCalorPaises.tsx. Un simple .toLowerCase() NO alcanza acá: el
// dataset usa nombres en inglés y varios abreviados/distintos
// ("Bosnia and Herz.", "Dem. Rep. Congo", "Czechia", "eSwatini",
// "Côte d'Ivoire"), así que "españa" nunca va a calzar con "spain" solo
// normalizando mayúsculas — hace falta esta tabla de traducción.
//
// Generado leyendo el topojson real (cdn.jsdelivr.net/npm/world-atlas@2/
// countries-110m.json, 177 países) y cruzándolo a mano contra PAISES
// (195 entradas) — los que no aparecen acá (microestados, la mayoría
// islas del Caribe/Pacífico, Vaticano, San Marino, Mónaco, Liechtenstein,
// Malta, Singapur, etc.) simplemente no existen como forma propia en
// este dataset de baja resolución (110m): no hay nada que pintar para
// ellos, así que un autor con ese país no tiene entrada acá a propósito
// — MapaCalorPaises.tsx no falla por esto, ese país solo no aparece
// resaltado en el mapa (el ranking en las tarjetas KPI no depende del mapa).
export const PAIS_A_NOMBRE_MAPA: Record<string, string> = {
  Afganistán: 'Afghanistan',
  Albania: 'Albania',
  Alemania: 'Germany',
  Angola: 'Angola',
  'Arabia Saudita': 'Saudi Arabia',
  Argelia: 'Algeria',
  Argentina: 'Argentina',
  Armenia: 'Armenia',
  Australia: 'Australia',
  Austria: 'Austria',
  Azerbaiyán: 'Azerbaijan',
  Bahamas: 'Bahamas',
  Bangladés: 'Bangladesh',
  Bélgica: 'Belgium',
  Belice: 'Belize',
  Benín: 'Benin',
  Bielorrusia: 'Belarus',
  Birmania: 'Myanmar',
  Bolivia: 'Bolivia',
  'Bosnia y Herzegovina': 'Bosnia and Herz.',
  Botsuana: 'Botswana',
  Brasil: 'Brazil',
  Brunéi: 'Brunei',
  Bulgaria: 'Bulgaria',
  'Burkina Faso': 'Burkina Faso',
  Burundi: 'Burundi',
  Bután: 'Bhutan',
  Camboya: 'Cambodia',
  Camerún: 'Cameroon',
  Canadá: 'Canada',
  Catar: 'Qatar',
  Chad: 'Chad',
  Chile: 'Chile',
  China: 'China',
  Chipre: 'Cyprus',
  Colombia: 'Colombia',
  'Corea del Norte': 'North Korea',
  'Corea del Sur': 'South Korea',
  'Costa de Marfil': "Côte d'Ivoire",
  'Costa Rica': 'Costa Rica',
  Croacia: 'Croatia',
  Cuba: 'Cuba',
  Dinamarca: 'Denmark',
  Ecuador: 'Ecuador',
  Egipto: 'Egypt',
  'El Salvador': 'El Salvador',
  'Emiratos Árabes Unidos': 'United Arab Emirates',
  Eritrea: 'Eritrea',
  Eslovaquia: 'Slovakia',
  Eslovenia: 'Slovenia',
  España: 'Spain',
  'Estados Unidos': 'United States of America',
  Estonia: 'Estonia',
  Esuatini: 'eSwatini',
  Etiopía: 'Ethiopia',
  Filipinas: 'Philippines',
  Finlandia: 'Finland',
  Fiyi: 'Fiji',
  Francia: 'France',
  Gabón: 'Gabon',
  Gambia: 'Gambia',
  Georgia: 'Georgia',
  Ghana: 'Ghana',
  Grecia: 'Greece',
  Guatemala: 'Guatemala',
  Guyana: 'Guyana',
  Guinea: 'Guinea',
  'Guinea-Bisáu': 'Guinea-Bissau',
  'Guinea Ecuatorial': 'Eq. Guinea',
  Haití: 'Haiti',
  Honduras: 'Honduras',
  Hungría: 'Hungary',
  India: 'India',
  Indonesia: 'Indonesia',
  Irak: 'Iraq',
  Irán: 'Iran',
  Irlanda: 'Ireland',
  Islandia: 'Iceland',
  'Islas Salomón': 'Solomon Is.',
  Israel: 'Israel',
  Italia: 'Italy',
  Jamaica: 'Jamaica',
  Japón: 'Japan',
  Jordania: 'Jordan',
  Kazajistán: 'Kazakhstan',
  Kenia: 'Kenya',
  Kirguistán: 'Kyrgyzstan',
  Kuwait: 'Kuwait',
  Laos: 'Laos',
  Lesoto: 'Lesotho',
  Letonia: 'Latvia',
  Líbano: 'Lebanon',
  Liberia: 'Liberia',
  Libia: 'Libya',
  Lituania: 'Lithuania',
  Luxemburgo: 'Luxembourg',
  'Macedonia del Norte': 'Macedonia',
  Madagascar: 'Madagascar',
  Malasia: 'Malaysia',
  Malaui: 'Malawi',
  Malí: 'Mali',
  Marruecos: 'Morocco',
  Mauritania: 'Mauritania',
  México: 'Mexico',
  Moldavia: 'Moldova',
  Mongolia: 'Mongolia',
  Montenegro: 'Montenegro',
  Mozambique: 'Mozambique',
  Namibia: 'Namibia',
  Nepal: 'Nepal',
  Nicaragua: 'Nicaragua',
  Níger: 'Niger',
  Nigeria: 'Nigeria',
  Noruega: 'Norway',
  'Nueva Zelanda': 'New Zealand',
  Omán: 'Oman',
  'Países Bajos': 'Netherlands',
  Pakistán: 'Pakistan',
  Panamá: 'Panama',
  'Papúa Nueva Guinea': 'Papua New Guinea',
  Paraguay: 'Paraguay',
  Perú: 'Peru',
  Polonia: 'Poland',
  Portugal: 'Portugal',
  'Reino Unido': 'United Kingdom',
  'República Centroafricana': 'Central African Rep.',
  'República Checa': 'Czechia',
  'República del Congo': 'Congo',
  'República Democrática del Congo': 'Dem. Rep. Congo',
  'República Dominicana': 'Dominican Rep.',
  Ruanda: 'Rwanda',
  Rumanía: 'Romania',
  Rusia: 'Russia',
  Senegal: 'Senegal',
  Serbia: 'Serbia',
  'Sierra Leona': 'Sierra Leone',
  Siria: 'Syria',
  Somalia: 'Somalia',
  'Sri Lanka': 'Sri Lanka',
  Sudáfrica: 'South Africa',
  Sudán: 'Sudan',
  'Sudán del Sur': 'S. Sudan',
  Suecia: 'Sweden',
  Suiza: 'Switzerland',
  Surinam: 'Suriname',
  Tailandia: 'Thailand',
  Taiwán: 'Taiwan',
  Tanzania: 'Tanzania',
  Tayikistán: 'Tajikistan',
  'Timor Oriental': 'Timor-Leste',
  Togo: 'Togo',
  'Trinidad y Tobago': 'Trinidad and Tobago',
  Túnez: 'Tunisia',
  Turkmenistán: 'Turkmenistan',
  Turquía: 'Turkey',
  Ucrania: 'Ukraine',
  Uganda: 'Uganda',
  Uruguay: 'Uruguay',
  Uzbekistán: 'Uzbekistan',
  Vanuatu: 'Vanuatu',
  Venezuela: 'Venezuela',
  Vietnam: 'Vietnam',
  Yemen: 'Yemen',
  Yibuti: 'Djibouti',
  Zambia: 'Zambia',
  Zimbabue: 'Zimbabwe',
};

// Quita tildes/diacríticos, pasa a minúsculas y recorta espacios — así
// "Perú", "PERÚ", "perú" y "Peru" (sin tilde) normalizan todos al mismo
// valor. Necesario porque `pais` viene de datos mezclados (texto libre
// de antes de que CrearAutorForm.tsx lo convirtiera en <select>, ej.
// "venezuela" en minúsculas o con espacios extra).
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Índice único, armado una sola vez a partir de PAIS_A_NOMBRE_MAPA:
// normalizeName(nombre en español) → nombre EXACTO de properties.name en
// el topojson. También indexa el propio nombre en inglés normalizado
// (por si en la BD alguien ya escribió el país directamente en inglés,
// ej. "United States"). Reemplaza la tabla de minúsculas anterior: al
// normalizar los dos lados (BD y diccionario) por igual, cubre tildes y
// mayúsculas a la vez en vez de solo mayúsculas.
const NOMBRE_NORMALIZADO_A_TOPOJSON = new Map<string, string>();
for (const [espanol, nombreTopojson] of Object.entries(PAIS_A_NOMBRE_MAPA)) {
  NOMBRE_NORMALIZADO_A_TOPOJSON.set(normalizeName(espanol), nombreTopojson);
  NOMBRE_NORMALIZADO_A_TOPOJSON.set(normalizeName(nombreTopojson), nombreTopojson);
}

// pais tal como viene de la fila de autor (server/helpers/metricas.ts:
// PaisRanking.pais) → nombre exacto de properties.name en el topojson,
// o undefined si no hay coincidencia segura (el país no está en este
// dataset, o el valor no matchea ni en español ni en inglés).
export function nombreParaMapa(pais: string): string | undefined {
  return NOMBRE_NORMALIZADO_A_TOPOJSON.get(normalizeName(pais));
}
