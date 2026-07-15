import { Mic, User } from "lucide-react";
import type { Speaker } from "../types/agenda";
import Flag from "./Flag";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function SpeakerCard({ speaker }: { speaker: Speaker }) {
  const { name, role, country, iso, moderator, photo, bio } = speaker;

  return (
    <div className="flex gap-3 rounded-2xl border border-edge bg-surface p-3">
      {/* Foto del ponente — placeholder reservado (skeleton / iniciales) */}
      <div className="relative shrink-0">
        {photo ? (
          <img
            src={photo}
            alt={name ?? "Ponente"}
            loading="lazy"
            className="h-14 w-14 rounded-2xl object-cover"
          />
        ) : name ? (
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-flit-gradient font-display text-lg font-bold text-white">
            {initials(name)}
          </div>
        ) : (
          <div className="grid h-14 w-14 animate-pulse place-items-center rounded-2xl bg-tintf text-tintf-fg">
            <User className="h-6 w-6" />
          </div>
        )}
        {iso && (
          <Flag
            iso={iso}
            country={country}
            className="absolute -bottom-1 -right-1 h-4 w-6 ring-2 ring-surface"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {moderator && (
            <span className="inline-flex items-center gap-1 rounded-full bg-tintv px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-tintv-fg">
              <Mic className="h-3 w-3" /> Modera
            </span>
          )}
        </div>
        <p className="truncate font-semibold leading-tight text-fg">
          {name ?? role ?? "Ponente por confirmar"}
        </p>
        {name && role && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted">{role}</p>
        )}

        {/* Mini CV — placeholder reservado para la biografía */}
        {bio ? (
          <p className="mt-2 text-xs leading-relaxed text-muted">{bio}</p>
        ) : (
          <div className="mt-2" aria-label="Mini CV próximamente">
            <div className="space-y-1.5">
              <span className="block h-2 w-full animate-pulse rounded-full bg-fg/10" />
              <span className="block h-2 w-4/5 animate-pulse rounded-full bg-fg/10" />
            </div>
            <span className="mt-1.5 inline-block text-[10px] font-medium uppercase tracking-wide text-muted/80">
              Mini CV · próximamente
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
