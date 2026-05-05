const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/admin/users', requireAdmin, async (req, res) => {
  const users = await query(
    `
    SELECT u.user_id, u.username, u.is_admin, u.is_active, u.employee_id, e.display_name
    FROM users u
    LEFT JOIN employees e ON e.employee_id = u.employee_id
    ORDER BY u.user_id DESC
    `
  );

  const employees = await query('SELECT employee_id, employee_number, display_name FROM employees ORDER BY employee_number');

  res.render('users', {
    users,
    employees,
    error: null,
    message: req.query.message || null
  });
});

router.post('/admin/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, employeeId, isAdmin } = req.body;
    if (!username || !password) {
      return res.redirect('/admin/users?message=Usuario+y+clave+requeridos');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const employee = employeeId ? Number(employeeId) : null;

    await query(
      `
      INSERT INTO users (username, password_hash, is_admin, employee_id)
      VALUES (@username, @passwordHash, @isAdmin, @employee)
      `,
      {
        username,
        passwordHash,
        isAdmin: isAdmin === 'on' ? 1 : 0,
        employee
      }
    );

    return res.redirect('/admin/users?message=Usuario+creado');
  } catch (error) {
    return res.redirect(`/admin/users?message=${encodeURIComponent(`Error: ${error.message}`)}`);
  }
});

module.exports = router;
