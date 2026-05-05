const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/admin/users', requireAdmin, asyncHandler(async (req, res) => {
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
}));

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

router.post('/admin/users/:id/update', requireAdmin, asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const { username, password, employeeId, isAdmin, isActive } = req.body;

  if (!userId || !username) {
    return res.redirect('/admin/users?message=Datos+de+usuario+invalidos');
  }

  const employee = employeeId ? Number(employeeId) : null;
  const adminValue = isAdmin === 'on' ? 1 : 0;
  const activeValue = isActive === 'on' ? 1 : 0;

  if (password && String(password).trim()) {
    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      `
      UPDATE users
      SET username = @username,
          password_hash = @passwordHash,
          is_admin = @isAdmin,
          employee_id = @employee,
          is_active = @isActive
      WHERE user_id = @userId
      `,
      { userId, username, passwordHash, isAdmin: adminValue, employee, isActive: activeValue }
    );
  } else {
    await query(
      `
      UPDATE users
      SET username = @username,
          is_admin = @isAdmin,
          employee_id = @employee,
          is_active = @isActive
      WHERE user_id = @userId
      `,
      { userId, username, isAdmin: adminValue, employee, isActive: activeValue }
    );
  }

  return res.redirect('/admin/users?message=Usuario+actualizado');
}));

router.post('/admin/users/:id/delete', requireAdmin, asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) {
    return res.redirect('/admin/users?message=Usuario+invalido');
  }

  await query('DELETE FROM users WHERE user_id = @userId AND user_id <> @currentUserId', {
    userId,
    currentUserId: req.session.user.id
  });

  return res.redirect('/admin/users?message=Usuario+eliminado');
}));

module.exports = router;
