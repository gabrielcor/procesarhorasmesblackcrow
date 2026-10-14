const crypto = require('crypto');
const express = require('express');
const { query } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { WEEKDAYS, positiveId, employeeForm, validateEmployee, requirementDescription } = require('../services/employees');

const router = express.Router();
router.use('/admin/employees', requireAdmin, (req, res, next) => {
  if (!req.session.employeeCsrfToken) req.session.employeeCsrfToken = crypto.randomBytes(32).toString('hex');
  res.locals.employeeCsrfToken = req.session.employeeCsrfToken;
  if (req.method === 'POST' && req.body.csrfToken !== req.session.employeeCsrfToken) {
    return res.status(403).send('Formulario inválido. Recarga la página y vuelve a intentarlo.');
  }
  return next();
});

async function findEmployee(id) {
  const rows = await query(
    'SELECT employee_id, employee_number, display_name, required_minutes, requirement_mode, work_days_mask, daily_required_minutes, is_active FROM employees WHERE employee_id = @employeeId',
    { employeeId: id }
  );
  return rows[0] || null;
}

async function renderEmployees(res, options = {}) {
  const employees = await query(`
    SELECT e.employee_id, e.employee_number, e.display_name, e.required_minutes, e.requirement_mode, e.work_days_mask, e.daily_required_minutes, e.is_active,
      (SELECT COUNT(*) FROM users u WHERE u.employee_id = e.employee_id) AS user_count
    FROM employees e
    ORDER BY e.employee_number
  `);
  const nextNumber = employees.reduce((max, employee) => Math.max(max, employee.employee_number), 0) + 1;
  return res.status(options.status || 200).render('employees', {
    employees,
    form: options.form || { employeeNumber: nextNumber <= 2147483647 ? String(nextNumber) : '', displayName: '', requiredHours: '160', requiredMinutes: '0',
      requirementMode: 'monthly', workDays: [], dailyHours: '8', dailyMinutes: '0', isActive: true },
    errors: options.errors || {},
    message: options.message || null,
    requirementDescription,
    weekdays: WEEKDAYS
  });
}

function renderEdit(res, employee, options = {}) {
  return res.status(options.status || 200).render('employee-edit', {
    employee,
    form: options.form || employeeForm(employee),
    errors: options.errors || {},
    weekdays: WEEKDAYS
  });
}

function databaseError(error) {
  const numbers = [error.number, error.originalError?.info?.number, ...(error.precedingErrors || []).map(item => item.number)];
  return numbers.some(number => number === 2601 || number === 2627)
    ? { employeeNumber: 'Este número ya está registrado. Usa otro número.' }
    : { general: 'No se pudo guardar el empleado. Vuelve a intentarlo.' };
}

router.get('/admin/employees', asyncHandler(async (req, res) => {
  const messages = { created: 'Empleado creado. Puedes asignarle una cuenta en Usuarios.', updated: 'Empleado actualizado.' };
  return renderEmployees(res, { message: messages[req.query.result] || null });
}));

router.post('/admin/employees', asyncHandler(async (req, res) => {
  const { form, errors, values } = validateEmployee(req.body);
  if (Object.keys(errors).length) return renderEmployees(res, { form, errors, status: 400 });
  try {
    await query(`
      INSERT INTO employees (employee_number, display_name, required_minutes, requirement_mode, work_days_mask, daily_required_minutes, is_active)
      VALUES (@employeeNumber, @displayName, @requiredMinutes, @requirementMode, @workDaysMask, @dailyRequiredMinutes, @isActive)
    `, values);
  } catch (error) {
    return renderEmployees(res, { form, errors: databaseError(error), status: 400 });
  }
  return res.redirect('/admin/employees?result=created');
}));

router.get('/admin/employees/:id/edit', asyncHandler(async (req, res) => {
  const employeeId = positiveId(req.params.id);
  const employee = employeeId ? await findEmployee(employeeId) : null;
  if (!employee) return res.status(404).send('Empleado no encontrado');
  return renderEdit(res, employee);
}));

router.post('/admin/employees/:id/update', asyncHandler(async (req, res) => {
  const employeeId = positiveId(req.params.id);
  const employee = employeeId ? await findEmployee(employeeId) : null;
  if (!employee) return res.status(404).send('Empleado no encontrado');
  const { form, errors, values } = validateEmployee(req.body, employee);
  if (Object.keys(errors).length) return renderEdit(res, employee, { form, errors, status: 400 });
  try {
    await query(`
      UPDATE employees
      SET display_name = @displayName, required_minutes = @requiredMinutes, requirement_mode = @requirementMode,
          work_days_mask = @workDaysMask, daily_required_minutes = @dailyRequiredMinutes, is_active = @isActive
      WHERE employee_id = @employeeId
    `, { ...values, employeeId });
  } catch (error) {
    return renderEdit(res, employee, { form, errors: databaseError(error), status: 400 });
  }
  return res.redirect('/admin/employees?result=updated');
}));

module.exports = router;
