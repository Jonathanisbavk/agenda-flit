import { MapPin, CalendarDays, Sparkles, CheckCircle2 } from "lucide-react";
import { agenda } from "../lib/agenda";
import { useSelection } from "../store/SelectionContext";
import Countdown from "./Countdown";

export default function Hero() {
  const { event, stats } = agenda;
  const { count } = useSelection();
  const pct = Math.min(100, Math.round((count / stats.events) * 100));

  return (
    <section className="mx-auto max-w-3xl px-4 pt-5">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-flit-gradient p-5 text-white shadow-xl shadow-flit-500/25 sm:p-7">
        {/* textura de puntos para dar profundidad */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-2xl"
        />
        <Sparkles className="pointer-events-none absolute right-4 top-4 h-6 w-6 text-white/40" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
            {event.subtitle}
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-[2.6rem]">
            {event.name}
          </h1>
          <p className="mt-2 max-w-md text-sm text-white/90">
            Eje 2026: <span className="font-semibold">«{event.eje}»</span>
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium ring-1 ring-white/20 backdrop-blur-sm">
              <CalendarDays className="h-4 w-4" /> {event.dates}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium ring-1 ring-white/20 backdrop-blur-sm">
              <MapPin className="h-4 w-4" /> {event.location}
            </span>
          </div>

          <Countdown />

          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { n: stats.days, l: "Días" },
              { n: stats.tracks, l: "Tracks" },
              { n: stats.events, l: "Actividades" },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-2xl bg-white/15 px-3 py-2.5 text-center ring-1 ring-white/20 backdrop-blur-md"
              >
                <div className="font-display text-xl font-bold">{s.n}</div>
                <div className="text-[11px] uppercase tracking-wide text-white/80">{s.l}</div>
              </div>
            ))}
          </div>

          {/* progreso de selección */}
          {count > 0 && (
            <div className="mt-4 rounded-2xl bg-white/15 p-3 ring-1 ring-white/20 backdrop-blur-md">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Tu plan
                </span>
                <span>
                  {count} de {stats.events}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 px-1 text-sm text-muted">
        Toca una actividad para agregarla a tu plan, o «Elegir todo» para un track completo.
        Cuando termines, descarga tu cronograma en PDF.
      </p>
    </section>
  );
}
