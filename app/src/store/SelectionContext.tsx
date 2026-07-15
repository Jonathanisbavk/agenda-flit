import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

const STORAGE_KEY = "flit-agenda-2026.selection";

type State = { ids: Set<string> };

type Action =
  | { type: "toggle"; id: string }
  | { type: "add"; ids: string[] }
  | { type: "remove"; ids: string[] }
  | { type: "clear" }
  | { type: "hydrate"; ids: string[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "toggle": {
      const ids = new Set(state.ids);
      ids.has(action.id) ? ids.delete(action.id) : ids.add(action.id);
      return { ids };
    }
    case "add": {
      const ids = new Set(state.ids);
      action.ids.forEach((id) => ids.add(id));
      return { ids };
    }
    case "remove": {
      const ids = new Set(state.ids);
      action.ids.forEach((id) => ids.delete(id));
      return { ids };
    }
    case "clear":
      return { ids: new Set() };
    case "hydrate":
      return { ids: new Set(action.ids) };
    default:
      return state;
  }
}

interface SelectionContextValue {
  selected: Set<string>;
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  add: (ids: string[]) => void;
  remove: (ids: string[]) => void;
  clear: () => void;
  /** true si TODOS los ids dados están seleccionados */
  allSelected: (ids: string[]) => boolean;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

function loadInitial(): State {
  if (typeof window === "undefined") return { ids: new Set() };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return { ids: new Set(JSON.parse(raw) as string[]) };
  } catch {
    /* ignore corrupt storage */
  }
  return { ids: new Set() };
}

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.ids]));
    } catch {
      /* storage full / unavailable */
    }
  }, [state.ids]);

  const value = useMemo<SelectionContextValue>(
    () => ({
      selected: state.ids,
      count: state.ids.size,
      has: (id) => state.ids.has(id),
      toggle: (id) => dispatch({ type: "toggle", id }),
      add: (ids) => dispatch({ type: "add", ids }),
      remove: (ids) => dispatch({ type: "remove", ids }),
      clear: () => dispatch({ type: "clear" }),
      allSelected: (ids) => ids.length > 0 && ids.every((id) => state.ids.has(id)),
    }),
    [state.ids],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection debe usarse dentro de <SelectionProvider>");
  return ctx;
}
