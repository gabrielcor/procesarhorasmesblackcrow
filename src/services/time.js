const dayjs = require('dayjs');

function parseHm(value) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes, text: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` };
}

function toMinutes(hm) {
  return hm.hours * 60 + hm.minutes;
}

function isBeforeNoon(hm) {
  return hm.hours < 12;
}

function pairDailyPunches(rawTimes) {
  const parsed = rawTimes
    .map(parseHm)
    .filter(Boolean)
    .sort((a, b) => toMinutes(a) - toMinutes(b));

  const slots = [];
  for (let i = 0; i < parsed.length; i += 2) {
    const start = parsed[i] || null;
    const end = parsed[i + 1] || null;

    if (start && end && toMinutes(end) < toMinutes(start)) {
      slots.push({ start: start.text, end: null, incompleteReason: 'Salida menor que entrada' });
      continue;
    }

    if (start && !end) {
      if (isBeforeNoon(start)) {
        slots.push({ start: start.text, end: null, incompleteReason: 'Marca unica antes de mediodia, asumida como entrada' });
      } else {
        slots.push({ start: null, end: start.text, incompleteReason: 'Marca unica despues de mediodia, asumida como salida' });
      }
      continue;
    }

    slots.push({
      start: start ? start.text : null,
      end: end ? end.text : null,
      incompleteReason: null
    });
  }

  return slots.slice(0, 3);
}

function calculateWorkedMinutes(slots) {
  return slots.reduce((sum, slot, index) => {
    if (!slot.currentStartTime || !slot.currentEndTime) {
      return sum;
    }

    const start = parseHm(slot.currentStartTime);
    const end = parseHm(slot.currentEndTime);
    if (!start || !end) {
      return sum;
    }

    let minutes = toMinutes(end) - toMinutes(start);
    if (minutes > 0) {
      const isFirstSlot = Number(slot.slotIndex) === 1 || (slot.slotIndex == null && index === 0);
      if (isFirstSlot && minutes > 480) {
        // Subtract lunch up to 60 minutes without dropping below 480.
        minutes = Math.max(480, minutes - 60);
      }

      return sum + minutes;
    }

    return sum;
  }, 0);
}

function monthBoundaries(yearMonth) {
  const start = dayjs(`${yearMonth}-01`);
  return {
    start: start.format('YYYY-MM-DD'),
    end: start.endOf('month').format('YYYY-MM-DD')
  };
}

function scheduledDayMinutes(employee, date, isHoliday = false) {
  if (isHoliday) return 0;
  const selected = Number(employee.work_days_mask) & (1 << dayjs(date).day());
  return selected ? Number(employee.daily_required_minutes) : 0;
}

// Required time uses the saved rule; worked time is never filtered by this calendar.
function computeRequiredMinutes(employee, yearMonth, holidaySet = new Set()) {
  if (employee.requirement_mode !== 'weekly') {
    return Number(employee.required_minutes || 0);
  }

  const start = dayjs(`${yearMonth}-01`);
  const daysInMonth = start.daysInMonth();
  let requiredMinutes = 0;
  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = start.date(d);
    const dateStr = date.format('YYYY-MM-DD');
    requiredMinutes += scheduledDayMinutes(employee, dateStr, holidaySet.has(dateStr));
  }
  return requiredMinutes;
}

function calculateDayWorkedMinutes(day, employee) {
  if (day.dayType === 'V' || day.dayType === 'L') {
    return employee.requirement_mode === 'weekly'
      ? scheduledDayMinutes(employee, day.workDate, day.isHoliday) : 480;
  }
  const slots = day.slots.filter(slot => !slot.isDeleted).sort((a, b) => a.slotIndex - b.slotIndex);
  const baseMinutes = calculateWorkedMinutes(slots);
  // Preserve the existing double credit for actual work on holidays.
  return day.isHoliday ? baseMinutes * 2 : baseMinutes;
}

module.exports = {
  parseHm,
  pairDailyPunches,
  calculateWorkedMinutes,
  calculateDayWorkedMinutes,
  scheduledDayMinutes,
  monthBoundaries,
  computeRequiredMinutes
};
