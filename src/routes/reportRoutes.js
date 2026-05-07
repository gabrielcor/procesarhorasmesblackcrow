const express = require('express');
const dayjs = require('dayjs');
const { query } = require('../db');
const { requireAuth, canAccessEmployee } = require('../middleware/auth');
const { calculateWorkedMinutes } = require('../services/time');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
const MANUAL_DELETED_NOTE = 'Eliminado manualmente';
const DAY_TYPE_NORMAL = 'N';
const DAY_TYPE_VACATION = 'V';
const DAY_TYPE_LEAVE = 'L';

function normalizeDayType(value) {
  if (value === DAY_TYPE_VACATION || value === DAY_TYPE_LEAVE) {
    return value;
  }

  return DAY_TYPE_NORMAL;
}

function calculateDayWorkedMinutes(day) {
  if (day.dayType === DAY_TYPE_VACATION || day.dayType === DAY_TYPE_LEAVE) {
    return 480;
  }

  const activeSlots = day.slots
    .filter((slot) => !slot.isDeleted)
    .sort((a, b) => a.slotIndex - b.slotIndex);

  const baseMinutes = calculateWorkedMinutes(activeSlots);
  if (day.isHoliday) {
    return baseMinutes * 2;
  }

  return baseMinutes;
}

function parseMonth(value) {
  if (!value || typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = dayjs(`${value}-01`);
  return parsed.isValid() ? parsed.startOf('month') : null;
}

function buildMonthRange(fromMonth, toMonth) {
  const months = [];
  for (
    let cursor = fromMonth.startOf('month');
    !cursor.isAfter(toMonth, 'month');
    cursor = cursor.add(1, 'month')
  ) {
    months.push(cursor.format('YYYY-MM'));
  }
  return months;
}

router.get('/report', requireAuth, asyncHandler(async (req, res) => {
  const currentMonth = dayjs().format('YYYY-MM');
  const rawFrom = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
  const rawTo = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
  const rawEmployeeId = Array.isArray(req.query.employeeId) ? req.query.employeeId[0] : req.query.employeeId;

  const fromValue = rawFrom || currentMonth;
  const toValue = rawTo || fromValue;

  const fromMonth = parseMonth(fromValue);
  const toMonth = parseMonth(toValue);

  const employees = req.session.user.isAdmin
    ? await query('SELECT employee_id, employee_number, display_name FROM employees ORDER BY employee_number')
    : [];

  const employeeId = req.session.user.isAdmin
    ? Number(rawEmployeeId || 0)
    : Number(req.session.user.employeeId);

  if (!fromMonth || !toMonth) {
    return res.render('report', {
      from: fromValue,
      to: toValue,
      employeeId,
      employees,
      employee: null,
      months: [],
      summary: null,
      isAdmin: req.session.user.isAdmin,
      message: 'Mes invalido. Use formato YYYY-MM.'
    });
  }

  if (fromMonth.isAfter(toMonth, 'month')) {
    return res.render('report', {
      from: fromValue,
      to: toValue,
      employeeId,
      employees,
      employee: null,
      months: [],
      summary: null,
      isAdmin: req.session.user.isAdmin,
      message: 'El rango es invalido: From no puede ser mayor que To.'
    });
  }

  if (!employeeId) {
    return res.render('report', {
      from: fromValue,
      to: toValue,
      employeeId: null,
      employees,
      employee: null,
      months: [],
      summary: null,
      isAdmin: req.session.user.isAdmin,
      message: 'Seleccione un empleado'
    });
  }

  if (!canAccessEmployee(req, employeeId)) {
    return res.status(403).send('No autorizado');
  }

  const employeeRows = await query(
    'SELECT employee_id, employee_number, display_name, required_minutes FROM employees WHERE employee_id = @employeeId',
    { employeeId }
  );

  if (employeeRows.length === 0) {
    return res.status(404).send('Empleado no encontrado');
  }

  const employee = employeeRows[0];
  const monthsInRange = buildMonthRange(fromMonth, toMonth);
  const start = fromMonth.startOf('month').format('YYYY-MM-DD');
  const end = toMonth.endOf('month').format('YYYY-MM-DD');

  const rows = await query(
    `
    SELECT
      CONVERT(varchar(10), d.work_date, 23) AS work_date,
      CONVERT(varchar(7), d.work_date, 23) AS year_month,
      d.day_type,
      s.slot_index,
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
    SELECT
      CONVERT(varchar(10), holiday_date, 23) AS holiday_date,
      holiday_name
    FROM holidays
    WHERE holiday_date BETWEEN @start AND @end
    `,
    { start, end }
  );

  const holidayMap = new Map(holidays.map((row) => [row.holiday_date, row.holiday_name]));
  const monthDayMap = new Map();

  for (const row of rows) {
    const month = row.year_month;
    if (!monthDayMap.has(month)) {
      monthDayMap.set(month, new Map());
    }

    const dayMap = monthDayMap.get(month);
    if (!dayMap.has(row.work_date)) {
      dayMap.set(row.work_date, {
        workDate: row.work_date,
        dayType: normalizeDayType(row.day_type),
        isHoliday: holidayMap.has(row.work_date),
        slots: []
      });
    }

    const day = dayMap.get(row.work_date);
    day.dayType = normalizeDayType(row.day_type);

    if (row.slot_index) {
      day.slots.push({
        slotIndex: Number(row.slot_index),
        currentStartTime: row.current_start_time,
        currentEndTime: row.current_end_time,
        isDeleted: row.source_note === MANUAL_DELETED_NOTE
      });
    }
  }

  const allowanceMinutes = 45;
  const monthlyRows = monthsInRange.map((month) => {
    const dayMap = monthDayMap.get(month) || new Map();
    let totalWorkedMinutes = 0;

    for (const day of dayMap.values()) {
      totalWorkedMinutes += calculateDayWorkedMinutes(day);
    }

    const requiredMinutes = Number(employee.required_minutes || 0);
    const requiredAfterAllowance = requiredMinutes - allowanceMinutes;

    return {
      month,
      totalWorkedMinutes,
      requiredMinutes,
      allowanceMinutes,
      requiredAfterAllowance,
      balanceMinutes: totalWorkedMinutes - requiredAfterAllowance
    };
  });

  const summary = monthlyRows.reduce((acc, row) => ({
    totalWorkedMinutes: acc.totalWorkedMinutes + row.totalWorkedMinutes,
    requiredMinutes: acc.requiredMinutes + row.requiredMinutes,
    allowanceMinutes: acc.allowanceMinutes + row.allowanceMinutes,
    requiredAfterAllowance: acc.requiredAfterAllowance + row.requiredAfterAllowance,
    balanceMinutes: acc.balanceMinutes + row.balanceMinutes
  }), {
    totalWorkedMinutes: 0,
    requiredMinutes: 0,
    allowanceMinutes: 0,
    requiredAfterAllowance: 0,
    balanceMinutes: 0
  });

  return res.render('report', {
    from: fromMonth.format('YYYY-MM'),
    to: toMonth.format('YYYY-MM'),
    employeeId,
    employees,
    employee,
    months: monthlyRows,
    summary,
    isAdmin: req.session.user.isAdmin,
    message: null
  });
}));

module.exports = router;
