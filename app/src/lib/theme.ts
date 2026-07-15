export type ThemeChoice = "light" | "dark" | "system";

export const THEME_KEY = "flit-theme";

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function isDark(choice: ThemeChoice): boolean {
  return choice === "dark" || (choice === "system" && systemPrefersDark());
}

export function getStoredTheme(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(THEME_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

/** Aplica el tema al <html>: clase .dark, color-scheme y meta theme-color. */
export function applyTheme(choice: ThemeChoice): void {
  if (typeof document === "undefined") return;
  const dark = isDark(choice);
  const el = document.documentElement;
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0e0917" : "#fe0152");
}

// --- Store compartido -----------------------------------------------------
// Fuente única de la elección de tema, para que el toggle del header y los
// botones del cronograma se mantengan sincronizados sin recargar.

type ThemeListener = (choice: ThemeChoice) => void;
const themeListeners = new Set<ThemeListener>();
let currentChoice: ThemeChoice =
  typeof window === "undefined" ? "system" : getStoredTheme();

export function getThemeChoice(): ThemeChoice {
  return currentChoice;
}

export function subscribeTheme(fn: ThemeListener): () => void {
  themeListeners.add(fn);
  return () => {
    themeListeners.delete(fn);
  };
}

/** Cambia el tema: aplica al DOM, persiste y notifica a todos los suscriptores. */
export function setThemeChoice(choice: ThemeChoice): void {
  currentChoice = choice;
  applyTheme(choice);
  try {
    window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* almacenamiento no disponible */
  }
  themeListeners.forEach((l) => l(choice));
}
