const express = require('express');
const { query } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/admin/holidays', requireAdmin, async (req, res) => {
  const yearMonth = req.query.month || new Date().toISOString().slice(0, 7);
  const start = `${yearMonth}-01`;
  const end = `${yearMonth}-31`;

  const holidays = await query(
    `
    SELECT holiday_id, holiday_date, holiday_name
    FROM holidays
    WHERE holiday_date BETWEEN @start AND @end
    ORDER BY holiday_date
    `,
    { start, end }
  );

  res.render('holidays', {
    holidays,
    yearMonth,
    message: req.query.message || null
  });
});

router.post('/admin/holidays', requireAdmin, async (req, res) => {
  try {
    const { holidayDate, holidayName } = req.body;
    await query(
      'INSERT INTO holidays (holiday_date, holiday_name, created_by) VALUES (@holidayDate, @holidayName, @createdBy)',
      { holidayDate, holidayName, createdBy: req.session.user.id }
    );

    return res.redirect(`/admin/holidays?month=${holidayDate.slice(0, 7)}&message=Feriado+agregado`);
  } catch (error) {
    return res.redirect(`/admin/holidays?message=${encodeURIComponent(`Error: ${error.message}`)}`);
  }
});

router.post('/admin/holidays/:id/delete', requireAdmin, async (req, res) => {
  await query('DELETE FROM holidays WHERE holiday_id = @id', { id: Number(req.params.id) });
  return res.redirect('/admin/holidays?message=Feriado+eliminado');
});

module.exports = router;
