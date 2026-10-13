const { query } = require('../db');

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
    isActive: Boolean(employee.is_active)
  };
}

function validateEmployee(body, existing = null) {
  const form = {
    employeeNumber: existing ? String(existing.employee_number) : scalarText(body.employeeNumber),
    displayName: scalarText(body.displayName),
    requiredHours: scalarText(body.requiredHours),
    requiredMinutes: scalarText(body.requiredMinutes),
    isActive: body.isActive === 'on'
  };
  const errors = {};
  const employeeNumber = positiveId(form.employeeNumber);
  if (!employeeNumber) errors.employeeNumber = 'Ingresa un número entero entre 1 y 2147483647.';
  if (!form.displayName || form.displayName.length > 120) {
    errors.displayName = 'Ingresa un nombre de hasta 120 caracteres.';
  }

  // Number 2 has a calendar-based requirement. Preserve its stored value on edit.
  let requiredMinutes = existing && employeeNumber === 2 ? existing.required_minutes : null;
  if (requiredMinutes === null) {
    const hours = Number(form.requiredHours);
    const minutes = Number(form.requiredMinutes);
    if (!/^\d+$/.test(form.requiredHours) || !Number.isInteger(hours) || hours < 0 || hours > 744) {
      errors.requiredHours = 'Ingresa horas enteras entre 0 y 744.';
    }
    if (!/^\d+$/.test(form.requiredMinutes) || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
      errors.requiredMinutes = 'Ingresa minutos enteros entre 0 y 59.';
    }
    requiredMinutes = hours * 60 + minutes;
    if (!errors.requiredHours && !errors.requiredMinutes && requiredMinutes > 744 * 60) {
      errors.requiredHours = 'El total mensual no puede superar 744 horas.';
    }
  } else {
    form.requiredHours = String(Math.floor(requiredMinutes / 60));
    form.requiredMinutes = String(requiredMinutes % 60);
  }
  return { form, errors, values: { employeeNumber, displayName: form.displayName, requiredMinutes, isActive: form.isActive ? 1 : 0 } };
}

function formatRequiredTime(minutes) {
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

async function canAssignEmployee(value, currentEmployeeId = null) {
  if (value === '' || value === undefined || value === null) return true;
  const employeeId = positiveId(value);
  if (!employeeId) return false;
  const rows = await query('SELECT employee_id, is_active FROM employees WHERE employee_id = @employeeId', { employeeId });
  return rows.length > 0 && (Boolean(rows[0].is_active) || employeeId === Number(currentEmployeeId));
}

module.exports = { positiveId, employeeForm, validateEmployee, formatRequiredTime, canAssignEmployee };
