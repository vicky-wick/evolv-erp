/* CSV / Excel / Print exports */

type Cell = string | number;

const escape = (value: Cell): string => {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCSV(filename: string, columns: string[], rows: Cell[][]) {
  const content = [columns, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
  download(new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

export function exportExcel(filename: string, columns: string[], rows: Cell[][], title?: string) {
  const head = columns.map((c) => `<th>${c}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${String(c ?? "")}</td>`).join("")}</tr>`)
    .join("");
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" />
  <style>table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;font-family:Arial;font-size:12px}th{background:#f3f3f3}</style>
  </head><body>${title ? `<h3>${title}</h3>` : ""}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  download(new Blob([html], { type: "application/vnd.ms-excel" }), `${filename}.xls`);
}

export function printTable(
  title: string,
  subtitle: string,
  columns: string[],
  rows: Cell[][]
) {
  const w = window.open("", "_blank");
  if (!w) return;
  const head = columns.map((c) => `<th>${c}</th>`).join("");
  const body = rows
    .map(
      (r, i) =>
        `<tr class="${i % 2 ? "alt" : ""}">${r.map((c) => `<td>${String(c ?? "")}</td>`).join("")}</tr>`
    )
    .join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;color:#111;padding:36px;font-size:12px}
    h1{font-size:18px;margin:0 0 4px}
    p.meta{color:#666;margin:0 0 24px;font-size:12px}
    table{border-collapse:collapse;width:100%}
    th{text-align:left;background:#f4f4f5;border-bottom:2px solid #111;padding:8px;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
    td{padding:7px 8px;border-bottom:1px solid #e4e4e7}
    tr.alt td{background:#fafafa}
    .brand{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:24px;border-bottom:1px solid #ddd;padding-bottom:12px}
    .brand b{font-size:14px} .brand span{color:#888}
  </style></head><body>
  <div class="brand"><b>Evolve Creative Agency — ERP</b><span>Generated ${new Date().toLocaleString("en-IN")}</span></div>
  <h1>${title}</h1><p class="meta">${subtitle}</p>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}
