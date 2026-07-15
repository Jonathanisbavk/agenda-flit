/**
 * Resalta las palabras clave de un título para poder escanear la agenda de un
 * vistazo. Módulo puro (sin React) — la UI lo renderiza en <EventTitle>.
 */

/**
 * Solo términos *distintivos* del festival. Palabras ubicuas en esta agenda
 * ("tecnología", "educación", "futuro") quedan fuera a propósito: si se
 * resalta casi todo, no se resalta nada.
 *
 * El orden no importa aquí — se ordenan por longitud al construir el regex,
 * para que gane la coincidencia más larga ("Agentic AI" antes que "AI").
 */
const KEYWORDS = [
  // IA y datos
  "Inteligencia Artificial",
  "Agentic AI",
  "GenAI",
  "GENAI",
  "LatamGPT",
  "IA",
  "AI",
  // Tecnologías concretas
  "Computación Cuántica",
  "Kubernetes",
  "Ciberseguridad",
  "Blockchain",
  "Drones",
  "EdTech",
  "Hacking",
  // Negocio y ecosistema
  "Startups",
  "Startup",
  "Emprendimiento",
  "Innovación",
  "Minería",
  "Pymes",
  "Pyme",
  "MYPEs",
  "Mypes",
  "Mype",
  "Empleabilidad",
  "liderazgo femenino",
  "pagos digitales",
  "credenciales digitales",
  "transformación digital",
  // Región
  "Latinoamérica",
  "LATAM",
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const KEYWORD_RE = new RegExp(
  `\\b(${[...KEYWORDS]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|")})\\b`,
  "gi",
);

export interface TitleSegment {
  text: string;
  keyword: boolean;
}

/** Parte un título en segmentos, marcando cuáles son palabra clave. */
export function splitKeywords(title: string): TitleSegment[] {
  const out: TitleSegment[] = [];
  let last = 0;

  for (const m of title.matchAll(KEYWORD_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: title.slice(last, at), keyword: false });
    out.push({ text: m[0], keyword: true });
    last = at + m[0].length;
  }
  if (last < title.length) out.push({ text: title.slice(last), keyword: false });

  return out;
}
