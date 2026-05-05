const express = require('express');
const dayjs = require('dayjs');
const { query } = require('../db');
const { requireAuth, canAccessEmployee } = require('../middleware/auth');
const { calculateWorkedMinutes, parseHm } = require('../services/time');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
const MANUAL_CREATED_NOTE = 'Creado manualmente';
const MANUAL_DELETED_NOTE = 'Eliminado manualmente';

// Sanitize a param that may arrive as array or comma-separated string; always return first value
function firstParam(value) {
  if (Array.isArray(value)) return value[0] || '';
  if (typeof value === 'string' && value.includes(',')) return value.split(',')[0];
  return value || '';
}

function hasAnySlotEntry(slot) {
  if (slot.isDeleted) {
    return false;
  }

  return Boolean(
    slot.currentStartTime ||
    slot.currentEndTime ||
    slot.originalStartTime ||
    slot.originalEndTime ||
    slot.isManuallyCreated
  );
}

function normalizeDaySlots(existingSlots = []) {
  const sortedSlots = existingSlots
    .map((slot) => ({ ...slot, slotIndex: Number(slot.slotIndex) }))
    .sort((a, b) => a.slotIndex - b.slotIndex);

  const activeSlots = sortedSlots.filter((slot) => !slot.isDeleted);

  const visibleSlots = activeSlots.filter(hasAnySlotEntry);
  const used = new Set(activeSlots.map((slot) => slot.slotIndex));

  const missingSlotIndices = [];
  for (let i = 1; i <= 3; i += 1) {
    if (!used.has(i)) {
      missingSlotIndices.push(i);
    }
  }

  return { visibleSlots, missingSlotIndices };
}

function buildMonthDays(yearMonth) {
  const start = dayjs(`${yearMonth}-01`);
  const end = start.endOf('month');
  const result = [];
  for (let d = 1; d <= end.date(); d += 1) {
    result.push(start.date(d).format('YYYY-MM-DD'));
  }
  return result;
}

router.get('/attendance', requireAuth, asyncHandler(async (req, res) => {
  const rawMonth = Array.isArray(req.query.month) ? req.query.month[0] : req.query.month;
  const rawEmployeeId = Array.isArray(req.query.employeeId) ? req.query.employeeId[0] : req.query.employeeId;
  const yearMonth = rawMonth || dayjs().format('YYYY-MM');
  const employeeId = req.session.user.isAdmin
    ? Number(rawEmployeeId || 0)
    : Number(req.session.user.employeeId);

  if (!employeeId) {
    const employees = await query('SELECT employee_id, employee_number, display_name FROM employees ORDER BY employee_number');
    return res.render('attendance', {
      yearMonth,
      employeeId: null,
      employees,
      days: [],
      summary: null,
      message: 'Seleccione un empleado',
      isAdmin: req.session.user.isAdmin
    });
  }

  if (!canAccessEmployee(req, employeeId)) {
    return res.status(403).send('No autorizado');
  }

  const employees = req.session.user.isAdmin
    ? await query('SELECT employee_id, employee_number, display_name FROM employees ORDER BY employee_number')
    : [];

  const employeeRows = await query(
    'SELECT employee_id, employee_number, display_name, required_minutes FROM employees WHERE employee_id = @employeeId',
    { employeeId }
  );

  if (employeeRows.length === 0) {
    return res.status(404).send('Empleado no encontrado');
  }

  const employee = employeeRows[0];

  const start = `${yearMonth}-01`;
  const end = dayjs(start).endOf('month').format('YYYY-MM-DD');

  const rows = await query(
    `
    SELECT
      d.day_id,
      CONVERT(varchar(10), d.work_date, 23) AS work_date,
      s.slot_id,
      s.slot_index,
      s.original_start_time,
      s.original_end_time,
      s.current_start_time,
      s.current_end_time,
      s.source_note
    FROM attendance_days d
    INNER JOIN import_batches b ON b.import_batch_id = d.import_batch_id AND b.is_active = 1
    LEFT JOIN attendance_slots s ON s.day_id = d.day_id
    WHERE d.employee_id = @employeeId
      AND d.work_date BETWEEN @start AND @end
    ORDER BY d.work_date, s.slot_index
    `,
    { employeeId, start, end }
  );

  const holidays = await query(
    `
    SELECT CONVERT(varchar(10), holiday_date, 23) AS holiday_date, holiday_name
    FROM holidays
    WHERE holiday_date BETWEEN @start AND @end
    `,
    { start, end }
  );

  const holidayMap = new Map(holidays.map((x) => [x.holiday_date, x.holiday_name]));

  const dayMap = new Map();
  buildMonthDays(yearMonth).forEach((date) => {
    dayMap.set(date, {
      dayId: null,
      workDate: date,
      slots: [],
      isHoliday: holidayMap.has(date),
      holidayName: holidayMap.get(date) || null,
      workedMinutes: 0
    });
  });

  for (const row of rows) {
    if (!dayMap.has(row.work_date)) {
      continue;
    }
    const day = dayMap.get(row.work_date);
    day.dayId = day.dayId || row.day_id;

    if (row.slot_id) {
      day.slots.push({
        slotId: row.slot_id,
        slotIndex: row.slot_index,
        originalStartTime: row.original_start_time,
        originalEndTime: row.original_end_time,
        currentStartTime: row.current_start_time,
        currentEndTime: row.current_end_time,
        sourceNote: row.source_note,
        isManuallyCreated: row.source_note === MANUAL_CREATED_NOTE,
        isDeleted: row.source_note === MANUAL_DELETED_NOTE
      });
    }
  }

  let totalWorkedMinutes = 0;
  const days = Array.from(dayMap.values()).map((day) => {
    const normalized = normalizeDaySlots(day.slots);
    day.visibleSlots = normalized.visibleSlots;
    day.missingSlotIndices = normalized.missingSlotIndices;
    day.workedMinutes = calculateWorkedMinutes(day.slots);
    totalWorkedMinutes += day.workedMinutes;
    return day;
  });

  const allowanceMinutes = 45;
  const requiredMinutes = Number(employee.required_minutes || 0);
  const requiredAfterAllowance = requiredMinutes - allowanceMinutes;
  const balanceMinutes = totalWorkedMinutes - requiredAfterAllowance;

  return res.render('attendance', {
    yearMonth,
    employeeId,
    employees,
    employee,
    days,
    isAdmin: req.session.user.isAdmin,
    message: req.query.message || null,
    summary: {
      totalWorkedMinutes,
      requiredMinutes,
      allowanceMinutes,
      requiredAfterAllowance,
      balanceMinutes
    }
  });
}));

router.post('/attendance/slot/:slotId', requireAuth, asyncHandler(async (req, res) => {
  const slotId = Number(req.params.slotId);
  const { currentStartTime, currentEndTime } = req.body;
  const month = firstParam(req.body.month);
  const employeeId = firstParam(req.body.employeeId);

  const slotRows = await query(
    `
    SELECT s.slot_id, s.current_start_time, s.current_end_time, s.original_start_time, s.original_end_time, s.source_note, d.employee_id
    FROM attendance_slots s
    INNER JOIN attendance_days d ON d.day_id = s.day_id
    WHERE s.slot_id = @slotId
    `,
    { slotId }
  );

  if (slotRows.length === 0) {
    return res.status(404).send('Slot no encontrado');
  }

  const slot = slotRows[0];
  if (!canAccessEmployee(req, slot.employee_id)) {
    return res.status(403).send('No autorizado');
  }

  const parsedStart = currentStartTime ? parseHm(currentStartTime) : null;
  const parsedEnd = currentEndTime ? parseHm(currentEndTime) : null;

  if (currentStartTime && !parsedStart) {
    return res.redirect(`/attendance?month=${month}&employeeId=${employeeId}&message=Hora+de+entrada+invalida`);
  }
  if (currentEndTime && !parsedEnd) {
    return res.redirect(`/attendance?month=${month}&employeeId=${employeeId}&message=Hora+de+salida+invalida`);
  }
  if (parsedStart && parsedEnd) {
    const startMinutes = parsedStart.hours * 60 + parsedStart.minutes;
    const endMinutes = parsedEnd.hours * 60 + parsedEnd.minutes;
    if (endMinutes <= startMinutes) {
      return res.redirect(`/attendance?month=${month}&employeeId=${employeeId}&message=Salida+debe+ser+mayor+que+entrada`);
    }
  }

  const newStart = parsedStart ? parsedStart.text : null;
  const newEnd = parsedEnd ? parsedEnd.text : null;

  await query(
    `
    UPDATE attendance_slots
    SET current_start_time = @newStart,
        current_end_time = @newEnd,
        source_note = @sourceNote,
        updated_at = SYSUTCDATETIME(),
        updated_by = @updatedBy
    WHERE slot_id = @slotId
    `,
    {
      newStart,
      newEnd,
      sourceNote: slot.source_note === MANUAL_DELETED_NOTE ? MANUAL_CREATED_NOTE : slot.source_note,
      updatedBy: req.session.user.id,
      slotId
    }
  );

  await query(
    `
    INSERT INTO attendance_slot_audit
    (slot_id, changed_by, old_start_time, old_end_time, new_start_time, new_end_time, comment)
    VALUES
    (@slotId, @changedBy, @oldStart, @oldEnd, @newStart, @newEnd, @comment)
    `,
    {
      slotId,
      changedBy: req.session.user.id,
      oldStart: slot.current_start_time,
      oldEnd: slot.current_end_time,
      newStart,
      newEnd,
      comment: 'Edicion manual'
    }
  );

  return res.redirect(`/attendance?month=${month}&employeeId=${employeeId}&message=Registro+actualizado`);
}));

router.post('/attendance/day/:dayId/slot/:slotIndex', requireAuth, asyncHandler(async (req, res) => {
  const dayId = Number(req.params.dayId);
  const slotIndex = Number(req.params.slotIndex);
  const { currentStartTime, currentEndTime } = req.body;
  const month = firstParam(req.body.month);
  const employeeId = firstParam(req.body.employeeId);

  if (!dayId || slotIndex < 1 || slotIndex > 3) {
    return res.status(400).send('Parametros invalidos');
  }

  const dayRows = await query(
    `
    SELECT d.day_id, d.employee_id
    FROM attendance_days d
    WHERE d.day_id = @dayId
    `,
    { dayId }
  );

  if (dayRows.length === 0) {
    return res.status(404).send('Dia no encontrado');
  }

  const day = dayRows[0];
  if (!canAccessEmployee(req, day.employee_id)) {
    return res.status(403).send('No autorizado');
  }

  const parsedStart = currentStartTime ? parseHm(currentStartTime) : null;
  const parsedEnd = currentEndTime ? parseHm(currentEndTime) : null;

  if (currentStartTime && !parsedStart) {
    return res.redirect(`/attendance?month=${month}&employeeId=${employeeId}&message=Hora+de+entrada+invalida`);
  }
  if (currentEndTime && !parsedEnd) {
    return res.redirect(`/attendance?month=${month}&employeeId=${employeeId}&message=Hora+de+salida+invalida`);
  }
  if (parsedStart && parsedEnd) {
    const startMinutes = parsedStart.hours * 60 + parsedStart.minutes;
    const endMinutes = parsedEnd.hours * 60 + parsedEnd.minutes;
    if (endMinutes <= startMinutes) {
      return res.redirect(`/attendance?month=${month}&employeeId=${employeeId}&message=Salida+debe+ser+mayor+que+entrada`);
    }
  }

  const newStart = parsedStart ? parsedStart.text : null;
  const newEnd = parsedEnd ? parsedEnd.text : null;

  if (!newStart && !newEnd) {
    return res.redirect(`/attendance?month=${month}&employeeId=${employeeId}&message=Debe+ingresar+entrada+o+salida`);
  }

  const existingRows = await query(
    `
    SELECT slot_id, current_start_time, current_end_time, source_note
    FROM attendance_slots
    WHERE day_id = @dayId AND slot_index = @slotIndex
    `,
    { dayId, slotIndex }
  );

  let slotId;
  let oldStart = null;
  let oldEnd = null;

  if (existingRows.length > 0) {
    slotId = existingRows[0].slot_id;
    oldStart = existingRows[0].current_start_time;
    oldEnd = existingRows[0].current_end_time;

    await query(
      `
      UPDATE attendance_slots
      SET current_start_time = @newStart,
          current_end_time = @newEnd,
          source_note = @sourceNote,
          updated_at = SYSUTCDATETIME(),
          updated_by = @updatedBy
      WHERE slot_id = @slotId
      `,
      {
        newStart,
        newEnd,
        sourceNote: existingRows[0].source_note === MANUAL_DELETED_NOTE ? MANUAL_CREATED_NOTE : existingRows[0].source_note,
        updatedBy: req.session.user.id,
        slotId
      }
    );
  } else {
    const inserted = await query(
      `
      INSERT INTO attendance_slots
        (day_id, slot_index, original_start_time, original_end_time, current_start_time, current_end_time, source_note, updated_by, updated_at)
      OUTPUT INSERTED.slot_id
      VALUES
        (@dayId, @slotIndex, NULL, NULL, @newStart, @newEnd, @sourceNote, @updatedBy, SYSUTCDATETIME())
      `,
      { dayId, slotIndex, newStart, newEnd, sourceNote: MANUAL_CREATED_NOTE, updatedBy: req.session.user.id }
    );
    slotId = inserted[0].slot_id;
  }

  await query(
    `
    INSERT INTO attendance_slot_audit
    (slot_id, changed_by, old_start_time, old_end_time, new_start_time, new_end_time, comment)
    VALUES
    (@slotId, @changedBy, @oldStart, @oldEnd, @newStart, @newEnd, @comment)
    `,
    {
      slotId,
      changedBy: req.session.user.id,
      oldStart,
      oldEnd,
      newStart,
      newEnd,
      comment: existingRows.length > 0 ? 'Edicion manual' : 'Creacion manual de slot'
    }
  );

  return res.redirect(`/attendance?month=${month}&employeeId=${employeeId}&message=Registro+actualizado`);
}));

router.post('/attendance/slot/:slotId/delete', requireAuth, asyncHandler(async (req, res) => {
  const slotId = Number(req.params.slotId);
  const month = firstParam(req.body.month);
  const employeeId = firstParam(req.body.employeeId);

  const slotRows = await query(
    `
    SELECT s.slot_id, s.current_start_time, s.current_end_time, s.original_start_time, s.original_end_time, s.source_note, d.employee_id
    FROM attendance_slots s
    INNER JOIN attendance_days d ON d.day_id = s.day_id
    WHERE s.slot_id = @slotId
    `,
    { slotId }
  );

  if (slotRows.length === 0) {
    return res.redirect(`/attendance?month=${month}&employeeId=${employeeId}&message=Slot+no+encontrado`);
  }

  const slot = slotRows[0];
  if (!canAccessEmployee(req, slot.employee_id)) {
    return res.status(403).send('No autorizado');
  }

  if (slot.original_start_time || slot.original_end_time) {
    await query(
      `
      UPDATE attendance_slots
      SET current_start_time = NULL,
          current_end_time = NULL,
          source_note = @sourceNote,
          updated_at = SYSUTCDATETIME(),
          updated_by = @updatedBy
      WHERE slot_id = @slotId
      `,
      { sourceNote: MANUAL_DELETED_NOTE, updatedBy: req.session.user.id, slotId }
    );

    await query(
      `
      INSERT INTO attendance_slot_audit
      (slot_id, changed_by, old_start_time, old_end_time, new_start_time, new_end_time, comment)
      VALUES
      (@slotId, @changedBy, @oldStart, @oldEnd, NULL, NULL, @comment)
      `,
      {
        slotId,
        changedBy: req.session.user.id,
        oldStart: slot.current_start_time,
        oldEnd: slot.current_end_time,
        comment: 'Limpieza de slot importado'
      }
    );

    return res.redirect(`/attendance?month=${month}&employeeId=${employeeId}&message=Slot+limpiado`);
  }

  await query(
    `
    UPDATE attendance_slots
    SET current_start_time = NULL,
        current_end_time = NULL,
        source_note = @sourceNote,
        updated_at = SYSUTCDATETIME(),
        updated_by = @updatedBy
    WHERE slot_id = @slotId
    `,
    { sourceNote: MANUAL_DELETED_NOTE, updatedBy: req.session.user.id, slotId }
  );

  await query(
    `
    INSERT INTO attendance_slot_audit
    (slot_id, changed_by, old_start_time, old_end_time, new_start_time, new_end_time, comment)
    VALUES
    (@slotId, @changedBy, @oldStart, @oldEnd, NULL, NULL, @comment)
    `,
    {
      slotId,
      changedBy: req.session.user.id,
      oldStart: slot.current_start_time,
      oldEnd: slot.current_end_time,
      comment: 'Eliminacion de slot manual'
    }
  );

  return res.redirect(`/attendance?month=${month}&employeeId=${employeeId}&message=Slot+eliminado`);
}));

module.exports = router;
