const path = require('path');
const express = require('express');
const session = require('express-session');

// Isolate HTTP tests from the configured SQL database before loading any routes.
const state = { employees: [], users: [], attendance: [], holidays: [], mutationError: null };
function reset() {
  state.employees = [
    { employee_id: 1, employee_number: 1, display_name: 'Empleado 1', required_minutes: 7200, requirement_mode: 'monthly', work_days_mask: 0, daily_required_minutes: 0, is_active: true },
    { employee_id: 2, employee_number: 2, display_name: 'Empleado 2', required_minutes: 9600, requirement_mode: 'weekly', work_days_mask: 31, daily_required_minutes: 480, is_active: true },
    { employee_id: 3, employee_number: 3, display_name: 'Empleado 3', required_minutes: 8640, requirement_mode: 'monthly', work_days_mask: 0, daily_required_minutes: 0, is_active: false }
  ];
  state.users = [{ user_id: 1, username: 'Cuenta existente', employee_id: 3, is_admin: false, is_active: true }];
  state.mutationError = null;
  state.attendance = [];
  state.holidays = [];
}

async function query(text, params = {}) {
  const sql = text.replace(/\s+/g, ' ').trim();
  if (/^(INSERT|UPDATE)/.test(sql) && state.mutationError) throw state.mutationError;
  if (sql.startsWith('INSERT INTO employees')) {
    if (state.employees.some(employee => employee.employee_number === params.employeeNumber)) {
      throw Object.assign(new Error('duplicate'), { number: 2627 });
    }
    state.employees.push({ employee_id: Math.max(0, ...state.employees.map(e => e.employee_id)) + 1,
      employee_number: params.employeeNumber, display_name: params.displayName,
      required_minutes: params.requiredMinutes, requirement_mode: params.requirementMode, work_days_mask: params.workDaysMask,
      daily_required_minutes: params.dailyRequiredMinutes, is_active: Boolean(params.isActive) });
    return [];
  }
  if (sql.startsWith('UPDATE employees')) {
    const employee = state.employees.find(e => e.employee_id === params.employeeId);
    Object.assign(employee, { display_name: params.displayName, required_minutes: params.requiredMinutes, requirement_mode: params.requirementMode,
      work_days_mask: params.workDaysMask, daily_required_minutes: params.dailyRequiredMinutes, is_active: Boolean(params.isActive) });
    return [];
  }
  if (sql.startsWith('INSERT INTO users')) {
    state.users.push({ user_id: state.users.length + 1, username: params.username, employee_id: params.employee,
      is_admin: Boolean(params.isAdmin), is_active: true });
    return [];
  }
  if (sql.startsWith('UPDATE users')) {
    const user = state.users.find(u => u.user_id === params.userId);
    Object.assign(user, { username: params.username, employee_id: params.employee,
      is_admin: Boolean(params.isAdmin), is_active: Boolean(params.isActive) });
    return [];
  }
  if (sql.startsWith('SELECT employee_id FROM users')) return state.users.filter(u => u.user_id === params.userId);
  if (sql.startsWith('SELECT u.user_id')) return state.users.map(u => ({ ...u, display_name: state.employees.find(e => e.employee_id === u.employee_id)?.display_name }));
  if (sql.includes('FROM attendance_days')) return state.attendance.filter(row => row.employee_id === params.employeeId && row.work_date >= params.start && row.work_date <= params.end);
  if (sql.includes('FROM holidays')) return state.holidays.filter(row => row.holiday_date >= params.start && row.holiday_date <= params.end);
  if (sql.includes('FROM employees')) {
    let employees = state.employees;
    if (sql.includes('WHERE employee_id = @employeeId')) employees = employees.filter(e => e.employee_id === params.employeeId);
    if (sql.includes('is_active = 1')) employees = employees.filter(e => e.is_active);
    return employees.map(e => ({ ...e, user_count: state.users.filter(u => u.employee_id === e.employee_id).length }));
  }
  throw new Error(`Unexpected test query: ${sql}`);
}

require.cache[require.resolve('../../src/db')] = { id: require.resolve('../../src/db'), filename: require.resolve('../../src/db'), loaded: true, exports: { query } };
const employeeRoutes = require('../../src/routes/employeeRoutes');
const adminRoutes = require('../../src/routes/adminRoutes');
const importRoutes = require('../../src/routes/importRoutes');
const attendanceRoutes = require('../../src/routes/attendanceRoutes');
const reportRoutes = require('../../src/routes/reportRoutes');
const apiRoutes = require('../../src/routes/apiRoutes');

function createApp(defaultRole = null) {
  const app = express();
  app.set('views', path.resolve(__dirname, '../../views'));
  app.set('view engine', 'ejs');
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.resolve(__dirname, '../../public')));
  app.use(session({ secret: 'isolated-test-session', resave: false, saveUninitialized: false }));
  app.use((req, res, next) => {
    const role = req.get('x-test-role') || defaultRole;
    req.session.user = role ? { id: 99, username: 'Administrador de prueba', isAdmin: role === 'admin' } : null;
    res.locals.user = req.session.user;
    res.locals.formatDate = value => value;
    next();
  });
  app.use(employeeRoutes);
  app.use(adminRoutes);
  app.use(importRoutes);
  app.use(attendanceRoutes);
  app.use(reportRoutes);
  app.use(apiRoutes);
  app.use((error, req, res, next) => res.status(500).send(error.message));
  return app;
}
module.exports = { createApp, state, reset };
