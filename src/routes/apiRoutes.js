const express = require('express');
const dayjs = require('dayjs');
const { query } = require('../db');
const { requireAuth, canAccessEmployee } = require('../middleware/auth');
const { calculateWorkedMinutes } = require('../services/time');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
const MANUAL_DELETED_NOTE = 'Eliminado manualmente';

function buildMonthDays(yearMonth) {
  const start = dayjs(`${yearMonth}-01`);
  const end = start.endOf('month');
  const result = [];
  for (let d = 1; d <= end.date(); d += 1) {
    result.push(start.date(d).format('YYYY-MM-DD'));
  }
  return result;
}

function parseEmployeeId(req) {
  if (req.session.user.isAdmin) {
    return Number(req.query.employeeId || 0);
  }
  return Number(req.session.user.employeeId);
}

router.get('/api/attendance/monthly', requireAuth, asyncHandler(async (req, res) => {
  const yearMonth = req.query.month || dayjs().format('YYYY-MM');
  const employeeId = parseEmployeeId(req);

  if (!employeeId) {
    return res.status(400).json({ error: 'employeeId es requerido para admin' });
  }

  if (!canAccessEmployee(req, employeeId)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const employeeRows = await query(
    'SELECT employee_id, employee_number, display_name, required_minutes FROM employees WHERE employee_id = @employeeId',
    { employeeId }
  );

  if (employeeRows.length === 0) {
    return res.status(404).json({ error: 'Empleado no encontrado' });
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

  const holidayMap = new Map(holidays.map((h) => [h.holiday_date, h.holiday_name]));
  const dayMap = new Map();

  buildMonthDays(yearMonth).forEach((date) => {
    dayMap.set(date, {
      dayId: null,
      workDate: date,
      isHoliday: holidayMap.has(date),
      holidayName: holidayMap.get(date) || null,
      slots: [],
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
        slotIndex: Number(row.slot_index),
        originalStartTime: row.original_start_time,
        originalEndTime: row.original_end_time,
        currentStartTime: row.current_start_time,
        currentEndTime: row.current_end_time,
        sourceNote: row.source_note,
        isDeleted: row.source_note === MANUAL_DELETED_NOTE
      });
    }
  }

  let totalWorkedMinutes = 0;
  const days = Array.from(dayMap.values()).map((day) => {
    day.slots = day.slots
      .filter((slot) => !slot.isDeleted)
      .sort((a, b) => a.slotIndex - b.slotIndex);
    day.workedMinutes = calculateWorkedMinutes(day.slots);
    totalWorkedMinutes += day.workedMinutes;

    const used = new Set(day.slots.map((slot) => slot.slotIndex));
    const availableSlotIndices = [];
    for (let i = 1; i <= 3; i += 1) {
      if (!used.has(i)) {
        availableSlotIndices.push(i);
      }
    }

    return {
      ...day,
      availableSlotIndices
    };
  });

  const allowanceMinutes = 45;
  const requiredMinutes = Number(employee.required_minutes || 0);
  const requiredAfterAllowance = requiredMinutes - allowanceMinutes;

  return res.json({
    month: yearMonth,
    employee: {
      id: employee.employee_id,
      number: employee.employee_number,
      name: employee.display_name
    },
    summary: {
      totalWorkedMinutes,
      requiredMinutes,
      allowanceMinutes,
      requiredAfterAllowance,
      balanceMinutes: totalWorkedMinutes - requiredAfterAllowance
    },
    days
  });
}));

router.get('/api/audit/slots', requireAuth, asyncHandler(async (req, res) => {
  const yearMonth = req.query.month || dayjs().format('YYYY-MM');
  const employeeId = parseEmployeeId(req);

  if (!employeeId) {
    return res.status(400).json({ error: 'employeeId es requerido para admin' });
  }

  if (!canAccessEmployee(req, employeeId)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const start = `${yearMonth}-01`;
  const end = dayjs(start).endOf('month').format('YYYY-MM-DD');

  const history = await query(
    `
    SELECT
      a.audit_id,
      a.changed_at,
      a.old_start_time,
      a.old_end_time,
      a.new_start_time,
      a.new_end_time,
      a.comment,
      u.user_id,
      u.username,
      CONVERT(varchar(10), d.work_date, 23) AS work_date,
      s.slot_index
    FROM attendance_slot_audit a
    INNER JOIN attendance_slots s ON s.slot_id = a.slot_id
    INNER JOIN attendance_days d ON d.day_id = s.day_id
    INNER JOIN users u ON u.user_id = a.changed_by
    WHERE d.employee_id = @employeeId
      AND d.work_date BETWEEN @start AND @end
    ORDER BY a.changed_at DESC, d.work_date DESC, s.slot_index ASC
    `,
    { employeeId, start, end }
  );

  return res.json({
    month: yearMonth,
    employeeId,
    records: history.map((item) => ({
      auditId: item.audit_id,
      changedAt: item.changed_at,
      changedBy: {
        id: item.user_id,
        username: item.username
      },
      workDate: item.work_date,
      slotIndex: Number(item.slot_index),
      oldStartTime: item.old_start_time,
      oldEndTime: item.old_end_time,
      newStartTime: item.new_start_time,
      newEndTime: item.new_end_time,
      comment: item.comment
    }))
  });
}));

module.exports = router;
