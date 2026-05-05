const express = require('express');
const dayjs = require('dayjs');
const { query } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/admin/holidays', requireAdmin, asyncHandler(async (req, res) => {
  const year = Number(req.query.year || dayjs().year());
  const start = `${year}-01-01`;
  const end = dayjs(start).endOf('month').format('YYYY-MM-DD');
  const yearEnd = `${year}-12-31`;

  const holidays = await query(
    `
    SELECT holiday_id, holiday_date, holiday_name
    FROM holidays
    WHERE holiday_date BETWEEN @start AND @end
    ORDER BY holiday_date
    `,
    { start, end: yearEnd }
  );

  res.render('holidays', {
    holidays,
    year,
    message: req.query.message || null
  });
}));

router.post('/admin/holidays', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { holidayDate, holidayName } = req.body;
    await query(
      'INSERT INTO holidays (holiday_date, holiday_name, created_by) VALUES (CONVERT(date, @holidayDate, 23), @holidayName, @createdBy)',
      { holidayDate, holidayName, createdBy: req.session.user.id }
    );

    return res.redirect(`/admin/holidays?year=${holidayDate.slice(0, 4)}&message=Feriado+agregado`);
  } catch (error) {
    return res.redirect(`/admin/holidays?message=${encodeURIComponent(`Error: ${error.message}`)}`);
  }
}));

router.post('/admin/holidays/:id/delete', requireAdmin, asyncHandler(async (req, res) => {
  const year = Number(req.body.year || dayjs().year());
  await query('DELETE FROM holidays WHERE holiday_id = @id', { id: Number(req.params.id) });
  return res.redirect(`/admin/holidays?year=${year}&message=Feriado+eliminado`);
}));

module.exports = router;
