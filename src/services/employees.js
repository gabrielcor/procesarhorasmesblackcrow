const { query } = require('../db');

// Bit positions match dayjs().day(): Sunday = 0, Monday = 1, ..., Saturday = 6.
const WEEKDAYS = [
  { value: '1', label: 'Lunes' }, { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' }, { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' }, { value: '6', label: 'Sábado' }, { value: '0', label: 'Domingo' }
];

function scalarText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function positiveId(value) {
  const text = scalarText(value);
  const number = Number(text);
  return /^\d+$/.test(text) && Number.isInteger(number) && number > 0 && number <= 2147483647
    ? number : null;
}

function employeeForm(employee) {
  return {
    employeeNumber: String(employee.employee_number),
    displayName: employee.display_name,
    requiredHours: String(Math.floor(employee.required_minutes / 60)),
    requiredMinutes: String(employee.required_minutes % 60),
    requirementMode: employee.requirement_mode,
    workDays: WEEKDAYS.filter(day => employee.work_days_mask & (1 << Number(day.value))).map(day => day.value),
    dailyHours: String(Math.floor((employee.daily_required_minutes || 480) / 60)),
    dailyMinutes: String((employee.daily_required_minutes || 480) % 60),
    isActive: Boolean(employee.is_active)
  };
}

function validateEmployee(body, existing = null) {
  const rawDays = body.workDays === undefined ? [] : Array.isArray(body.workDays) ? body.workDays : [body.workDays];
  const form = {
    employeeNumber: existing ? String(existing.employee_number) : scalarText(body.employeeNumber),
    displayName: scalarText(body.displayName),
    requiredHours: scalarText(body.requiredHours),
    requiredMinutes: scalarText(body.requiredMinutes),
    requirementMode: scalarText(body.requirementMode),
    workDays: rawDays.filter(day => typeof day === 'string' && /^[0-6]$/.test(day)),
    dailyHours: scalarText(body.dailyHours),
    dailyMinutes: scalarText(body.dailyMinutes),
    isActive: body.isActive === 'on'
  };
  const errors = {};
  const employeeNumber = positiveId(form.employeeNumber);
  if (!employeeNumber) errors.employeeNumber = 'Ingresa un número entero entre 1 y 2147483647.';
  if (!form.displayName || form.displayName.length > 120) {
    errors.displayName = 'Ingresa un nombre de hasta 120 caracteres.';
  }

  if (!['monthly', 'weekly'].includes(form.requirementMode)) errors.requirementMode = 'Selecciona un tipo de cálculo.';
  function duration(hoursField, minutesField, maxHours, minTotal) {
    const hours = Number(form[hoursField]);
    const minutes = Number(form[minutesField]);
    if (!/^\d+$/.test(form[hoursField]) || !Number.isInteger(hours) || hours < 0 || hours > maxHours) {
      errors[hoursField] = `Ingresa horas enteras entre 0 y ${maxHours}.`;
    }
    if (!/^\d+$/.test(form[minutesField]) || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
      errors[minutesField] = 'Ingresa minutos enteros entre 0 y 59.';
    }
    const total = hours * 60 + minutes;
    if (!errors[hoursField] && !errors[minutesField] && (total < minTotal || total > maxHours * 60)) {
      errors[hoursField] = `El total debe estar entre ${minTotal} y ${maxHours * 60} minutos.`;
    }
    return total;
  }
  let requiredMinutes = existing?.required_minutes || 0;
  let workDaysMask = existing?.work_days_mask || 0;
  let dailyRequiredMinutes = existing?.daily_required_minutes || 0;
  if (form.requirementMode === 'monthly') {
    requiredMinutes = duration('requiredHours', 'requiredMinutes', 744, 0);
  } else if (form.requirementMode === 'weekly') {
    if (!form.workDays.length || rawDays.length > 7 || rawDays.length !== form.workDays.length) {
      errors.workDays = 'Selecciona al menos un día de la semana válido.';
    }
    workDaysMask = form.workDays.reduce((mask, day) => mask | (1 << Number(day)), 0);
    dailyRequiredMinutes = duration('dailyHours', 'dailyMinutes', 24, 1);
  }
  // Keep the inactive branch available when correcting errors or switching modes.
  if (form.requirementMode === 'weekly') {
    form.requiredHours = String(Math.floor(requiredMinutes / 60));
    form.requiredMinutes = String(requiredMinutes % 60);
  } else {
    form.workDays = WEEKDAYS.filter(day => workDaysMask & (1 << Number(day.value))).map(day => day.value);
    form.dailyHours = String(Math.floor((dailyRequiredMinutes || 480) / 60));
    form.dailyMinutes = String((dailyRequiredMinutes || 480) % 60);
  }
  return { form, errors, values: { employeeNumber, displayName: form.displayName, requiredMinutes,
    requirementMode: form.requirementMode, workDaysMask, dailyRequiredMinutes, isActive: form.isActive ? 1 : 0 } };
}

function formatRequiredTime(minutes) {
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

function requirementDescription(employee) {
  if (employee.requirement_mode !== 'weekly') return `${formatRequiredTime(employee.required_minutes)} al mes`;
  const days = WEEKDAYS.filter(day => employee.work_days_mask & (1 << Number(day.value))).map(day => day.label);
  return `${formatRequiredTime(employee.daily_required_minutes)} por día · ${days.join(', ')} · sin feriados`;
}

async function canAssignEmployee(value, currentEmployeeId = null) {
  if (value === '' || value === undefined || value === null) return true;
  const employeeId = positiveId(value);
  if (!employeeId) return false;
  const rows = await query('SELECT employee_id, is_active FROM employees WHERE employee_id = @employeeId', { employeeId });
  return rows.length > 0 && (Boolean(rows[0].is_active) || employeeId === Number(currentEmployeeId));
}

module.exports = { WEEKDAYS, positiveId, employeeForm, validateEmployee, formatRequiredTime, requirementDescription, canAssignEmployee };
