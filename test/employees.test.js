const assert = require('node:assert/strict');
const { test, before, after, beforeEach } = require('node:test');
const { createApp, state, reset } = require('./helpers/employeeApp');
const { validateEmployee, positiveId } = require('../src/services/employees');
const { computeRequiredMinutes } = require('../src/services/time');

let server;
let base;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(reset);

async function request(url, options = {}) {
  return fetch(base + url, { redirect: 'manual', ...options });
}
async function adminForm(url = '/admin/employees') {
  const response = await request(url, { headers: { 'x-test-role': 'admin' } });
  const html = await response.text();
  assert.equal(response.status, 200);
  return { html, token: html.match(/name="csrfToken" value="([^"]+)"/)[1], cookie: response.headers.get('set-cookie').split(';')[0] };
}
async function submit(url, values, form) {
  return request(url, { method: 'POST', headers: { 'x-test-role': 'admin', cookie: form.cookie },
    body: new URLSearchParams({ csrfToken: form.token, ...values }) });
}
const valid = { employeeNumber: '4', displayName: 'Ana Pérez', requiredHours: '160', requiredMinutes: '30', isActive: 'on' };

test('all employee routes require an admin', async () => {
  for (const [url, method] of [['/admin/employees', 'GET'], ['/admin/employees', 'POST'], ['/admin/employees/1/edit', 'GET'], ['/admin/employees/1/update', 'POST']]) {
    const guest = await request(url, { method });
    assert.equal(guest.status, 302);
    assert.equal(guest.headers.get('location'), '/login');
    assert.equal((await request(url, { method, headers: { 'x-test-role': 'employee' } })).status, 403);
  }
});

test('rejects missing, incorrect and cross-session CSRF tokens without writes', async () => {
  const form = await adminForm();
  for (const csrfToken of ['', 'incorrect']) assert.equal((await submit('/admin/employees', { ...valid, csrfToken }, form)).status, 403);
  const secondSession = await adminForm();
  assert.equal((await submit('/admin/employees/1/update', { ...valid, csrfToken: secondSession.token }, form)).status, 403);
  assert.equal(state.employees.length, 3);
});

test('creates an employee with exact minute conversion and exposes it in Users and Import', async () => {
  const form = await adminForm();
  assert.match(form.html, /href="\/admin\/employees"/);
  const response = await submit('/admin/employees', { ...valid, displayName: ' Ana Pérez ' }, form);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/admin/employees?result=created');
  assert.deepEqual(state.employees[3], { employee_id: 4, employee_number: 4, display_name: 'Ana Pérez', required_minutes: 9630, is_active: true });
  for (const url of ['/admin/users', '/import']) {
    const html = await (await request(url, { headers: { 'x-test-role': 'admin' } })).text();
    assert.match(html, /#4 - Ana Pérez/);
  }
});

test('duplicate numbers and database failures retain safely escaped input', async () => {
  const form = await adminForm();
  const duplicate = await submit('/admin/employees', { ...valid, employeeNumber: '1', displayName: '<script>alert(1)</script>' }, form);
  assert.equal(duplicate.status, 400);
  const html = await duplicate.text();
  assert.match(html, /Este número ya está registrado/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  state.mutationError = new Error('sensitive internal database details');
  const failure = await submit('/admin/employees', valid, form);
  assert.equal(failure.status, 400);
  const failureHtml = await failure.text();
  assert.match(failureHtml, /No se pudo guardar/);
  assert.doesNotMatch(failureHtml, /sensitive internal/);
  assert.equal(state.employees.length, 3);
});

test('rejects malformed fields, duplicate form keys and monthly totals above the bound', async () => {
  const form = await adminForm();
  for (const fields of [{ employeeNumber: '-4' }, { employeeNumber: '2.5' }, { employeeNumber: '2147483648' },
    { displayName: ' ' }, { displayName: 'a'.repeat(121) }, { requiredHours: '' }, { requiredHours: '-1' },
    { requiredHours: '10.5' }, { requiredHours: 'Infinity' }, { requiredHours: '744', requiredMinutes: '1' },
    { requiredMinutes: '60' }, { requiredMinutes: '1e1' }]) {
    assert.equal((await submit('/admin/employees', { ...valid, ...fields }, form)).status, 400);
  }
  const body = new URLSearchParams({ csrfToken: form.token, ...valid });
  body.append('employeeNumber', '9');
  assert.equal((await request('/admin/employees', { method: 'POST', headers: { 'x-test-role': 'admin', cookie: form.cookie }, body })).status, 400);
  assert.equal(state.employees.length, 3);
  assert.equal(Object.keys(validateEmployee({ ...valid, requiredHours: '744', requiredMinutes: '0' }).errors).length, 0);
  assert.equal(Object.keys(validateEmployee({ ...valid, requiredHours: '0', requiredMinutes: '0' }).errors).length, 0);
  for (const id of ['0', '1.5', '-1', '1e2', {}, ['1']]) assert.equal(positiveId(id), null);
});

test('edits and reactivates while preserving identity, attendance rules and account links', async () => {
  const form = await adminForm('/admin/employees/3/edit');
  const response = await submit('/admin/employees/3/update', { ...valid, employeeNumber: '2', displayName: 'Nuevo nombre', requiredHours: '144', requiredMinutes: '15' }, form);
  assert.equal(response.status, 302);
  assert.equal(state.employees[2].employee_number, 3);
  assert.equal(state.employees[2].display_name, 'Nuevo nombre');
  assert.equal(state.employees[2].required_minutes, 8655);
  assert.equal(state.employees[2].is_active, true);
  assert.equal(state.users[0].employee_id, 3);
  assert.equal(computeRequiredMinutes(state.employees[2], '2026-10', new Set()), 8655);
});

test('number 2 keeps its calendar requirement even when forged hours and number are submitted', async () => {
  const form = await adminForm('/admin/employees/2/edit');
  assert.match(form.html, /Horas calculadas automáticamente/);
  assert.doesNotMatch(form.html, /name="requiredHours"/);
  const previousRequirement = computeRequiredMinutes(state.employees[1], '2026-10', new Set(['2026-10-01']));
  const response = await submit('/admin/employees/2/update', { ...valid, employeeNumber: '9', requiredHours: '0', displayName: 'Nombre real' }, form);
  assert.equal(response.status, 302);
  assert.equal(state.employees[1].employee_number, 2);
  assert.equal(state.employees[1].required_minutes, 9600);
  assert.equal(computeRequiredMinutes(state.employees[1], '2026-10', new Set(['2026-10-01'])), previousRequirement);
});

test('deactivation preserves the record, removes it from new selections, and retains existing user links', async () => {
  const form = await adminForm('/admin/employees/1/edit');
  assert.equal((await submit('/admin/employees/1/update', { ...valid, isActive: '', displayName: 'Empleado retirado' }, form)).status, 302);
  assert.equal(state.employees[0].is_active, false);
  assert.equal(state.employees.length, 3);
  const listing = await adminForm();
  assert.match(listing.html, /Empleado retirado/);
  assert.match(listing.html, /Inactivo/);
  const importHtml = await (await request('/import', { headers: { 'x-test-role': 'admin' } })).text();
  assert.doesNotMatch(importHtml, /Empleado retirado|Empleado 3/);
  const usersHtml = await (await request('/admin/users', { headers: { 'x-test-role': 'admin' } })).text();
  assert.match(usersHtml, /Empleado 3 \(inactivo\)/);
  assert.doesNotMatch(usersHtml, /Empleado retirado/);
  const inactiveAssignment = await submit('/admin/users', { username: 'Nueva cuenta', password: 'test-only', employeeId: '3' }, form);
  assert.match(inactiveAssignment.headers.get('location'), /Selecciona\+un\+empleado\+activo/);
  assert.equal(state.users.length, 1);
  const keepLink = await submit('/admin/users/1/update', { username: 'Cuenta renombrada', employeeId: '3', isActive: 'on' }, form);
  assert.equal(keepLink.status, 302);
  assert.equal(state.users[0].employee_id, 3);
});

test('rejects uploaded workbooks for inactive employees before parsing and cleans the temporary file', async () => {
  const fs = require('fs');
  const path = require('path');
  const name = `inactive-test-${process.pid}.xlsx`;
  const body = new FormData();
  body.append('employeeId', '3');
  body.append('worksheet', new Blob(['not a workbook']), name);
  const response = await request('/import', { method: 'POST', headers: { 'x-test-role': 'admin' }, body });
  assert.equal(response.status, 302);
  assert.match(response.headers.get('location'), /Selecciona\+un\+empleado\+activo/);
  assert.equal(fs.readdirSync(path.resolve('uploads')).some(file => file.endsWith(name)), false);
});

test('missing employee and invalid edits do not write', async () => {
  for (const id of ['999', '-1', '1.5']) {
    assert.equal((await request(`/admin/employees/${id}/edit`, { headers: { 'x-test-role': 'admin' } })).status, 404);
  }
  const form = await adminForm('/admin/employees/1/edit');
  assert.equal((await submit('/admin/employees/999/update', valid, form)).status, 404);
  assert.equal((await submit('/admin/employees/1/update', { ...valid, requiredMinutes: '90' }, form)).status, 400);
  assert.equal(state.employees[0].required_minutes, 7200);
});
