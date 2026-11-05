/** Export only the records visible to the current user. Neutralize spreadsheet formulas. */
export function csvContent(
  headers: string[],
  rows: (string | number)[][],
): string {
  const cell = (value: string | number) => {
    const text = String(value);
    const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(cell).join(";")).join("\r\n")
  );
}

export function downloadCsv(
  name: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const url = URL.createObjectURL(
    new Blob([csvContent(headers, rows)], { type: "text/csv;charset=utf-8;" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `FEGCON-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
