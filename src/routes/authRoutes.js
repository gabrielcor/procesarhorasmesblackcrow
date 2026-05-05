const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }

  return res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.render('login', { error: 'Usuario y clave son requeridos' });
    }

    const users = await query(
      `
      SELECT u.user_id, u.username, u.password_hash, u.is_admin, u.employee_id, e.display_name
      FROM users u
      LEFT JOIN employees e ON e.employee_id = u.employee_id
      WHERE u.username = @username AND u.is_active = 1
      `,
      { username }
    );

    if (users.length === 0) {
      return res.render('login', { error: 'Credenciales invalidas' });
    }

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.render('login', { error: 'Credenciales invalidas' });
    }

    req.session.user = {
      id: user.user_id,
      username: user.username,
      isAdmin: Boolean(user.is_admin),
      employeeId: user.employee_id,
      employeeName: user.display_name
    };

    return res.redirect('/');
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
