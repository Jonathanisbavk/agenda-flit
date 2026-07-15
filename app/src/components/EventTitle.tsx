import { splitKeywords } from "../lib/highlight";

interface EventTitleProps {
  title: string;
  /** Clases del texto base; las palabras clave siempre suben de peso sobre él. */
  className?: string;
}

/**
 * Título de ponencia con las palabras clave en negrita, para escanear la
 * agenda de un vistazo. El contraste lo hace el peso: el texto base va en
 * `font-medium` y la clave en `font-extrabold` (no se usa color, que aquí ya
 * está reservado para el estado de selección).
 */
export default function EventTitle({ title, className }: EventTitleProps) {
  return (
    <span className={className}>
      {splitKeywords(title).map((seg, i) =>
        seg.keyword ? (
          <strong key={i} className="font-extrabold">
            {seg.text}
          </strong>
        ) : (
          seg.text
        ),
      )}
    </span>
  );
}
