export interface Speaker {
  name: string | null;
  role: string | null;
  country: string | null;
  /** Código ISO 3166-1 alpha-2 para la bandera (PE, CL, BR, MX…). */
  iso: string | null;
  moderator: boolean;
  /** Reservado: URL de la foto del ponente (placeholder por ahora). */
  photo?: string | null;
  /** Reservado: mini CV / bio del ponente (placeholder por ahora). */
  bio?: string | null;
}

export interface AgendaEvent {
  id: string;
  time: string;
  start: string | null;
  end: string | null;
  title: string;
  category: string | null;
  details: string[];
  country: string | null;
  /** Código ISO del país principal del evento. */
  iso: string | null;
  speakers: Speaker[];
  /** Reservado: imagen/portada del evento (placeholder por ahora). */
  image?: string | null;
  isBreak: boolean;
}

export interface Track {
  id: string;
  title: string;
  subtitle: string;
  span: string | null;
  events: AgendaEvent[];
}

export interface Day {
  id: string;
  date: string | null;
  weekday: string;
  day: number | null;
  tracks: Track[];
}

export interface Agenda {
  event: {
    name: string;
    subtitle: string;
    eje: string;
    location: string;
    dates: string;
  };
  brand: {
    coral: string;
    magenta: string;
    violet: string;
  };
  stats: {
    days: number;
    tracks: number;
    events: number;
  };
  days: Day[];
}

/** Evento enriquecido con el contexto de su día y track (para itinerario / PDF). */
export interface SelectedEvent extends AgendaEvent {
  dayId: string;
  weekday: string;
  date: string | null;
  dayNumber: number | null;
  trackId: string;
  trackTitle: string;
}
