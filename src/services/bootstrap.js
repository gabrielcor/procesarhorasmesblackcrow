const bcrypt = require('bcryptjs');
const { query } = require('../db');

async function ensureEmployees() {
  const defaults = [
    { number: 1, name: 'Empleado 1', requiredMinutes: 120 * 60 },
    { number: 2, name: 'Empleado 2', requiredMinutes: 160 * 60 },
    { number: 3, name: 'Empleado 3', requiredMinutes: 144 * 60 }
  ];

  for (const employee of defaults) {
    await query(
      `
      IF NOT EXISTS (SELECT 1 FROM employees WHERE employee_number = @number)
      INSERT INTO employees (employee_number, display_name, required_minutes)
      VALUES (@number, @name, @requiredMinutes)
      `,
      employee
    );
  }
}

async function ensureDefaultAdmin() {
  const username = 'admin';
  const password = process.env.ADMIN_DEFAULT_PASSWORD || 'pass1234*';
  const existing = await query('SELECT TOP 1 user_id FROM users WHERE username = @username', { username });

  if (existing.length > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await query(
    `
    INSERT INTO users (username, password_hash, is_admin, employee_id)
    VALUES (@username, @passwordHash, 1, NULL)
    `,
    { username, passwordHash }
  );
}

async function bootstrapData() {
  await ensureEmployees();
  await ensureDefaultAdmin();
}

module.exports = {
  bootstrapData
};
