import { useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { setThemeChoice, type ThemeChoice } from "../lib/theme";
import { useThemeChoice } from "../lib/useTheme";

const ORDER: ThemeChoice[] = ["system", "light", "dark"];
const META: Record<ThemeChoice, { icon: typeof Sun; label: string }> = {
  system: { icon: Monitor, label: "Tema del sistema" },
  light: { icon: Sun, label: "Tema claro" },
  dark: { icon: Moon, label: "Tema oscuro" },
};

export default function ThemeToggle() {
  const choice = useThemeChoice();

  // Si está en "system", reacciona a los cambios del SO en vivo.
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setThemeChoice("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  const next = () =>
    setThemeChoice(ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length]);

  const { icon: Icon, label } = META[choice];

  return (
    <button
      onClick={next}
      title={`${label} (toca para cambiar)`}
      aria-label={`${label}. Toca para cambiar de tema.`}
      className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border border-edge bg-surface text-fg transition-colors hover:bg-surface2"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
