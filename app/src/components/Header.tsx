import { useEffect, useRef } from "react";
import { CalendarCheck, Search, X } from "lucide-react";
import { useSelection } from "../store/SelectionContext";
import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  query: string;
  onQuery: (q: string) => void;
  onOpenItinerary: () => void;
}

export default function Header({ query, onQuery, onOpenItinerary }: HeaderProps) {
  const { count } = useSelection();
  const ref = useRef<HTMLElement>(null);

  // El alto real del header se publica como --header-h: DayNav se pega justo
  // debajo con `top-[var(--header-h)]`. Medirlo (y no fijarlo) evita que el
  // selector de día quede tapado cuando el header cambia de alto.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty(
        "--header-h",
        `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header
      ref={ref}
      className="sticky top-0 z-30 border-b border-edge bg-surface/85 backdrop-blur-md"
    >
      <div className="mx-auto max-w-3xl px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-flit-gradient font-display text-xl font-extrabold leading-none tracking-tight">
              FLIT
            </span>
            <span className="text-[11px] font-medium leading-tight text-muted">
              Arequipa 2026 · Mi agenda
            </span>
          </div>

          <ThemeToggle />

          <button
            onClick={onOpenItinerary}
            className="relative flex h-11 cursor-pointer items-center gap-2 rounded-full bg-flit-gradient px-4 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95"
            aria-label={`Ver mi cronograma, ${count} actividades seleccionadas`}
          >
            <CalendarCheck className="h-5 w-5" />
            <span className="hidden sm:inline">Mi plan</span>
            {count > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-xs font-bold text-flit-600">
                {count}
              </span>
            )}
          </button>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <label htmlFor="search" className="sr-only">
            Buscar actividad o ponente
          </label>
          <input
            id="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Buscar charla, tema o ponente…"
            className="w-full rounded-full border border-edge bg-surface py-2.5 pl-9 pr-9 text-sm text-fg outline-none transition-colors placeholder:text-muted/70 focus:border-violet"
          />
          {query && (
            <button
              onClick={() => onQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-muted transition-colors hover:bg-surface2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
