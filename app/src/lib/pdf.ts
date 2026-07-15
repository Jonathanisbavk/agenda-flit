import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { agenda, longDate } from "./agenda";
import type { SelectedEvent } from "../types/agenda";

type RGB = [number, number, number];

const CORAL: RGB = [254, 74, 36];
const MAGENTA: RGB = [254, 1, 82];
const VIOLET: RGB = [111, 37, 238];
const INK: RGB = [26, 16, 36];
const INK_SOFT: RGB = [90, 80, 100];
const ROW_ALT: RGB = [252, 244, 248];

interface DayGroup {
  label: string;
  tracks: { title: string; events: SelectedEvent[] }[];
}

/** Reagrupa los eventos seleccionados respetando el orden canónico de la agenda. */
function groupForPdf(selected: Set<string>): { groups: DayGroup[]; total: number } {
  const groups: DayGroup[] = [];
  let total = 0;
  for (const day of agenda.days) {
    const tracks: DayGroup["tracks"] = [];
    for (const track of day.tracks) {
      const events = track.events.filter((e) => selected.has(e.id));
      if (events.length === 0) continue;
      tracks.push({
        title: track.title,
        events: events.map((e) => ({
          ...e,
          dayId: day.id,
          weekday: day.weekday,
          date: day.date,
          dayNumber: day.day,
          trackId: track.id,
          trackTitle: track.title,
        })),
      });
      total += events.length;
    }
    if (tracks.length > 0) {
      groups.push({ label: longDate(day.weekday, day.date), tracks });
    }
  }
  return { groups, total };
}

function detailText(ev: SelectedEvent): string {
  const lines: string[] = [];
  if (ev.category && ev.category.toUpperCase() !== ev.title.toUpperCase()) {
    lines.push(ev.category);
  }
  lines.push(...ev.details.slice(0, 5));
  return lines.join("\n");
}

/**
 * Genera y descarga el cronograma personalizado en PDF con la identidad FLIT.
 * Devuelve el número de actividades incluidas.
 */
export function generateItineraryPdf(selected: Set<string>): number {
  const { groups, total } = groupForPdf(selected);
  if (total === 0) return 0;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ---- Cabecera de marca -------------------------------------------------
  doc.setFillColor(...MAGENTA);
  doc.rect(0, 0, pageW, 32, "F");

  const seg = pageW / 3;
  doc.setFillColor(...CORAL);
  doc.rect(0, 32, seg, 2.4, "F");
  doc.setFillColor(...MAGENTA);
  doc.rect(seg, 32, seg, 2.4, "F");
  doc.setFillColor(...VIOLET);
  doc.rect(seg * 2, 32, seg, 2.4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text("MI CRONOGRAMA", margin, 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("FLIT Arequipa 2026", margin, 22.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Tecnologia para ser mas humanos", margin, 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text(String(total), pageW - margin, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(total === 1 ? "actividad" : "actividades", pageW - margin, 22.5, {
    align: "right",
  });

  // ---- Meta --------------------------------------------------------------
  doc.setTextColor(...INK_SOFT);
  doc.setFontSize(9);
  doc.text(`${agenda.event.location}   ·   ${agenda.event.dates}`, margin, 42);
  const gen = new Date().toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  doc.text(`Generado el ${gen}`, pageW - margin, 42, { align: "right" });

  // ---- Cuerpo ------------------------------------------------------------
  let cursorY = 50;

  for (const group of groups) {
    if (cursorY > pageH - 40) {
      doc.addPage();
      cursorY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...VIOLET);
    doc.text(group.label.toUpperCase(), margin, cursorY);
    cursorY += 5;

    for (const track of group.tracks) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...CORAL);
      doc.text(track.title, margin, cursorY);
      cursorY += 1.5;

      autoTable(doc, {
        startY: cursorY + 1,
        margin: { left: margin, right: margin },
        head: [["Hora", "Actividad", "Detalles"]],
        body: track.events.map((ev) => [
          ev.start && ev.end ? `${ev.start}\n${ev.end}` : ev.time,
          ev.title,
          detailText(ev),
        ]),
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 2.2,
          valign: "top",
          lineColor: [235, 228, 238],
          lineWidth: 0.1,
          textColor: INK,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: MAGENTA,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
        },
        alternateRowStyles: { fillColor: ROW_ALT },
        columnStyles: {
          0: { cellWidth: 20, halign: "center", fontStyle: "bold", textColor: VIOLET },
          1: { cellWidth: 78, fontStyle: "bold" },
          2: { fontSize: 8, textColor: INK_SOFT },
        },
      });

      const last = (doc as unknown as { lastAutoTable?: { finalY: number } })
        .lastAutoTable;
      cursorY = (last?.finalY ?? cursorY) + 7;
    }
    cursorY += 2;
  }

  // ---- Pie de página -----------------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK_SOFT);
    doc.text("flit.com.pe  ·  Festival Latinoamericano de Innovacion y Tecnologia", margin, pageH - 8);
    doc.text(`Pagina ${i} de ${pages}`, pageW - margin, pageH - 8, { align: "right" });
  }

  doc.save("Cronograma-FLIT-Arequipa-2026.pdf");
  return total;
}
