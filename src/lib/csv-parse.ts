/**
 * Parse a CSV string into rows of string[].
 * Handles quoted fields (e.g. "a,b" is one cell).
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  for (const line of lines) {
    const row: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let cell = '';
        i++;
        while (i < line.length) {
          if (line[i] === '"') {
            i++;
            if (line[i] === '"') {
              cell += '"';
              i++;
            } else break;
          } else {
            cell += line[i];
            i++;
          }
        }
        row.push(cell);
        if (line[i] === ',') i++;
      } else {
        let cell = '';
        while (i < line.length && line[i] !== ',') {
          cell += line[i];
          i++;
        }
        row.push(cell.trim());
        if (line[i] === ',') i++;
      }
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Get header index (case-insensitive, trimmed).
 */
export function headerIndex(headers: string[], name: string): number {
  const lower = name.toLowerCase().trim();
  return headers.findIndex((h) => h.toLowerCase().trim() === lower);
}

/**
 * Get cell by header name from a row (headers and row must align).
 */
export function getCell(row: string[], headers: string[], name: string): string {
  const i = headerIndex(headers, name);
  return i >= 0 && row[i] !== undefined ? String(row[i]).trim() : '';
}
