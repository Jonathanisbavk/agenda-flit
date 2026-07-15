import { useSyncExternalStore } from "react";
import { getThemeChoice, subscribeTheme, type ThemeChoice } from "./theme";

/** Lee la elección de tema actual y se re-renderiza cuando cambia (store compartido). */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribeTheme, getThemeChoice, getThemeChoice);
}
