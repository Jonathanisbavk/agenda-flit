import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CalendarRange, List } from "lucide-react";
import type { AgendaEvent } from "./types/agenda";
import { agenda, trackTitleByEvent } from "./lib/agenda";
import Header from "./components/Header";
import Hero from "./components/Hero";
import DayNav from "./components/DayNav";
import TrackSection from "./components/TrackSection";
import CalendarView from "./components/CalendarView";
import EventDetailSheet from "./components/EventDetailSheet";
import ItineraryModal from "./components/ItineraryModal";
import SelectionBar from "./components/SelectionBar";
import AdminPanel, { ADMIN_SLUG } from "./components/AdminPanel";

type View = "calendar" | "list";

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const opts: { id: View; label: string; icon: typeof List }[] = [
    { id: "calendar", label: "Calendario", icon: CalendarRange },
    { id: "list", label: "Lista", icon: List },
  ];
  return (
    <div
      role="group"
      aria-label="Cambiar vista"
      className="inline-flex items-center gap-1 rounded-full border border-edge bg-surface p-1 shadow-sm"
    >
      {opts.map(({ id, label, icon: Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={[
              "flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors",
              active ? "bg-flit-gradient text-white" : "text-muted hover:bg-surface2",
            ].join(" ")}
          >
            <Icon className="h-5 w-5" /> {label}
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  const [activeDayId, setActiveDayId] = useState(agenda.days[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<AgendaEvent | null>(null);
  const [itineraryOpen, setItineraryOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  // Panel de admin (verificación manual del "en vivo"): solo si la URL trae el
  // slug secreto ?panel=<slug>. Los visitantes normales nunca lo ven.
  const [adminOpen, setAdminOpen] = useState(false);
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("panel");
    if (slug && slug === ADMIN_SLUG) setAdminOpen(true);
  }, []);
  /** Marca que el próximo cambio de día viene del nav y debe reencuadrarse. */
  const reframe = useRef(false);

  const searching = query.trim().length > 0;

  const activeDay = useMemo(
    () => agenda.days.find((d) => d.id === activeDayId) ?? agenda.days[0],
    [activeDayId],
  );

  const daysToRender = searching ? agenda.days : activeDay ? [activeDay] : [];

  // Cambiar de día desde el nav reemplaza el contenido bajo el scroll actual:
  // sin reencuadrar, quien venía del final de la lista aterriza en mitad del
  // día nuevo. Se sube justo al inicio de la lista, con el nav aún a la vista.
  const selectDay = (dayId: string) => {
    if (dayId === activeDayId) return;
    reframe.current = true;
    setActiveDayId(dayId);
  };

  // El reencuadre va en un efecto y no junto al click: hasta que React no
  // confirma el día nuevo, la página conserva el alto del anterior, y el
  // reajuste del navegador al cambiar ese alto cancela el scroll en curso.
  useEffect(() => {
    if (!reframe.current) return;
    reframe.current = false;
    const content = document.getElementById("day-content");
    const nav = document.getElementById("day-nav");
    if (!content || !nav) return;
    const headerH =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--header-h"),
      ) || 0;
    const top =
      content.getBoundingClientRect().top +
      window.scrollY -
      headerH -
      nav.getBoundingClientRect().height;
    // Nunca hacia abajo: quien ya está arriba no debe ser arrastrado.
    if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
  }, [activeDayId]);

  // Al elegir todo un track, llevamos al usuario a la siguiente selección.
  const advanceFrom = (dayId: string, trackId: string) => {
    const day = agenda.days.find((d) => d.id === dayId);
    if (!day) return;
    const idx = day.tracks.findIndex((t) => t.id === trackId);
    const next = day.tracks[idx + 1];
    if (next) {
      requestAnimationFrame(() =>
        document
          .getElementById(`track-${next.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
      return;
    }
    const dIdx = agenda.days.findIndex((d) => d.id === dayId);
    const nextDay = agenda.days[dIdx + 1];
    if (nextDay) {
      setActiveDayId(nextDay.id);
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
    }
  };

  const showCalendar = view === "calendar" && !searching;

  return (
    <div className="min-h-dvh pb-28">
      <Header query={query} onQuery={setQuery} onOpenItinerary={() => setItineraryOpen(true)} />

      {!searching && (
        <div className="mx-auto max-w-3xl px-4">
          <Hero />
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4">
        {!searching && (
          <div className="mt-5 flex justify-center">
            <ViewToggle view={view} onChange={setView} />
          </div>
        )}

        {/* Selector de día (salto rápido) — útil en lista y en calendario.
            Va como hijo directo de <main> a propósito: un sticky solo puede
            desplazarse dentro de su padre, así que envolverlo en un div a su
            medida lo dejaba fijo solo mientras se veía a sí mismo. */}
        {!searching && <DayNav activeDayId={activeDayId} onSelect={selectDay} />}

        {searching && (
          <p className="mt-5 flex items-center gap-2 text-sm font-medium text-muted">
            <Search className="h-4 w-4" />
            Resultados para «{query.trim()}»
          </p>
        )}

        <div id="day-content">
          {showCalendar ? (
            <CalendarView
              activeDayId={activeDayId}
              onSelectDay={selectDay}
              onOpenEvent={setDetail}
            />
          ) : (
            <div className="mx-auto max-w-3xl">
              {daysToRender.map((day) => (
                <div key={day.id}>
                  {searching && (
                    <h2 className="mt-6 font-display text-sm font-bold uppercase tracking-wide text-tintv-fg">
                      {day.weekday} {day.day}
                    </h2>
                  )}
                  {day.tracks.map((track) => (
                    <TrackSection
                      key={track.id}
                      track={track}
                      query={query.trim()}
                      onOpenEvent={setDetail}
                      onPickedAll={searching ? undefined : () => advanceFrom(day.id, track.id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="mx-auto mt-12 max-w-3xl border-t border-edge pt-6 text-center text-xs text-muted">
          <p className="text-flit-gradient font-semibold">FLIT Arequipa 2026</p>
          <p className="mt-1">
            Tu plan se guarda en este dispositivo. Festival Latinoamericano de Innovación y
            Tecnología.
          </p>
        </footer>
      </main>

      <SelectionBar onView={() => setItineraryOpen(true)} />

      <EventDetailSheet
        event={detail}
        trackTitle={detail ? trackTitleByEvent[detail.id] : undefined}
        onClose={() => setDetail(null)}
      />
      <ItineraryModal open={itineraryOpen} onClose={() => setItineraryOpen(false)} />
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
    </div>
  );
}
