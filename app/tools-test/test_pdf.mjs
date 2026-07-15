// Validación headless: genera el PDF con datos reales y lo escribe a disco.
import { readFileSync, writeFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import autoTableImport from "jspdf-autotable";
const autoTable = autoTableImport.default ?? autoTableImport;

const agenda = JSON.parse(readFileSync(new URL("../src/data/agenda.json", import.meta.url)));

// Selecciona los primeros 3 eventos no-break de cada track (muestra representativa).
const selected = new Set();
for (const day of agenda.days)
  for (const track of day.tracks)
    track.events.filter((e) => !e.isBreak).slice(0, 3).forEach((e) => selected.add(e.id));

const doc = new jsPDF({ unit: "mm", format: "a4" });
const pageW = doc.internal.pageSize.getWidth();
let total = 0;
let cursorY = 20;
doc.setFontSize(16);
doc.text("MI CRONOGRAMA FLIT 2026 (test)", 14, cursorY);
cursorY += 8;

for (const day of agenda.days) {
  for (const track of day.tracks) {
    const evs = track.events.filter((e) => selected.has(e.id));
    if (!evs.length) continue;
    total += evs.length;
    autoTable(doc, {
      startY: cursorY,
      margin: { left: 14, right: 14 },
      head: [["Hora", "Actividad", "Detalles"]],
      body: evs.map((e) => [
        e.start ?? e.time,
        e.title,
        [e.category, ...e.details.slice(0, 3)].filter(Boolean).join("\n"),
      ]),
      styles: { fontSize: 9, overflow: "linebreak" },
      headStyles: { fillColor: [254, 1, 82] },
    });
    cursorY = doc.lastAutoTable.finalY + 6;
    if (cursorY > 260) {
      doc.addPage();
      cursorY = 20;
    }
  }
}

const buf = Buffer.from(doc.output("arraybuffer"));
const out = new URL("./_itinerary.test.pdf", import.meta.url);
writeFileSync(out, buf);
console.log(`OK: ${total} eventos, ${doc.getNumberOfPages()} paginas, ${buf.length} bytes`);
console.log(`PDF valido: ${buf.subarray(0, 5).toString() === "%PDF-"}`);
