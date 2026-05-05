const XLSX = require('xlsx');
const { pairDailyPunches } = require('./time');

function parseExcelDateRange(cells) {
  const regex = /(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/;
  for (const value of cells) {
    const text = String(value || '');
    const match = text.match(regex);
    if (match) {
      return {
        from: match[1],
        to: match[2],
        yearMonth: match[1].slice(0, 7)
      };
    }
  }
  return null;
}

function findDayHeaderRow(rows) {
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const numbers = row
      .map((v, i) => ({ v: Number(v), i }))
      .filter((x) => Number.isInteger(x.v) && x.v >= 1 && x.v <= 31);

    if (numbers.length < 10) {
      continue;
    }

    const sorted = numbers.slice().sort((a, b) => a.i - b.i);
    let sequence = 1;
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].v === sorted[i - 1].v + 1) {
        sequence += 1;
      }
    }

    if (sequence >= 10) {
      return r;
    }
  }

  return -1;
}

function extractTimesFromValue(value) {
  if (value === null || value === undefined || value === '') {
    return [];
  }

  const text = String(value);
  const matches = text.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/g);
  return matches || [];
}

function parseAttendanceSheet(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const sheet = workbook.Sheets['Registros de asistencia'];

  if (!sheet) {
    throw new Error('No se encontro la hoja Registros de asistencia');
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const flatCells = rows.flat();
  const range = parseExcelDateRange(flatCells);

  if (!range) {
    throw new Error('No se pudo detectar el rango de fechas en el archivo');
  }

  const dayHeaderRow = findDayHeaderRow(rows);
  if (dayHeaderRow < 0) {
    throw new Error('No se pudo detectar la fila de dias del mes');
  }

  const dayRow = rows[dayHeaderRow] || [];
  const dayColumns = [];
  for (let c = 0; c < dayRow.length; c += 1) {
    const day = Number(dayRow[c]);
    if (Number.isInteger(day) && day >= 1 && day <= 31) {
      dayColumns.push({ col: c, day });
    }
  }

  const resultDays = [];
  for (const dayCol of dayColumns) {
    const collected = [];

    for (let r = dayHeaderRow + 1; r <= Math.min(rows.length - 1, dayHeaderRow + 8); r += 1) {
      const value = rows[r] ? rows[r][dayCol.col] : '';
      collected.push(...extractTimesFromValue(value));
    }

    const slots = pairDailyPunches(collected);
    resultDays.push({
      day: dayCol.day,
      slots,
      sourceTimes: collected
    });
  }

  return {
    yearMonth: range.yearMonth,
    from: range.from,
    to: range.to,
    days: resultDays
  };
}

module.exports = {
  parseAttendanceSheet
};
