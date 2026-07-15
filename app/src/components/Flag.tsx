import PE from "country-flag-icons/react/3x2/PE";
import CL from "country-flag-icons/react/3x2/CL";
import BR from "country-flag-icons/react/3x2/BR";
import MX from "country-flag-icons/react/3x2/MX";
import AR from "country-flag-icons/react/3x2/AR";
import CO from "country-flag-icons/react/3x2/CO";
import EC from "country-flag-icons/react/3x2/EC";
import BO from "country-flag-icons/react/3x2/BO";
import UY from "country-flag-icons/react/3x2/UY";
import PY from "country-flag-icons/react/3x2/PY";
import ES from "country-flag-icons/react/3x2/ES";
import US from "country-flag-icons/react/3x2/US";
import VE from "country-flag-icons/react/3x2/VE";
import PA from "country-flag-icons/react/3x2/PA";
import CR from "country-flag-icons/react/3x2/CR";

// Todas las banderas comparten el tipo de componente de la librería.
const FLAGS: Record<string, typeof PE> = {
  PE, CL, BR, MX, AR, CO, EC, BO, UY, PY, ES, US, VE, PA, CR,
};

interface FlagProps {
  iso: string | null | undefined;
  country?: string | null;
  /** clases de tamaño, p.ej. "h-3.5 w-5" */
  className?: string;
}

/** Bandera SVG del país; null si no hay código o no está soportado. */
export default function Flag({ iso, country, className = "h-3.5 w-5" }: FlagProps) {
  if (!iso) return null;
  const Svg = FLAGS[iso.toUpperCase()];
  if (!Svg) return null;
  return (
    <span
      className={`inline-block shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10 dark:ring-white/25 ${className}`}
      title={country ?? iso}
    >
      <Svg title={country ?? iso} className="h-full w-full object-cover" />
    </span>
  );
}
