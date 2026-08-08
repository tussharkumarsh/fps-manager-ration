import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfColumn {
  header: string;
  key: string;
}

export function exportRowsToPdf(
  title: string,
  subtitle: string,
  columns: PdfColumn[],
  rows: Record<string, string | number>[],
  fileName: string
): void {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(subtitle, 14, 21);

  autoTable(doc, {
    startY: 26,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(row[c.key] ?? ""))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 95] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.save(fileName);
}
