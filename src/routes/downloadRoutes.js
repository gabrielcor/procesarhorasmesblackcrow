const express = require('express');
const path = require('path');
const { query } = require('../db');
const { requireAuth, canAccessEmployee } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/download', requireAuth, asyncHandler(async (req, res) => {
  const yearMonth = req.query.month;
  const employeeId = req.session.user.isAdmin ? Number(req.query.employeeId) : Number(req.session.user.employeeId);

  if (!yearMonth || !employeeId) {
    return res.status(400).send('Parametros invalidos');
  }

  if (!canAccessEmployee(req, employeeId)) {
    return res.status(403).send('No autorizado');
  }

  const batches = await query(
    `
    SELECT TOP 1 stored_file_path, original_file_name
    FROM import_batches
    WHERE employee_id = @employeeId
      AND year_month = @yearMonth
      AND is_active = 1
    ORDER BY uploaded_at DESC
    `,
    { employeeId, yearMonth }
  );

  if (batches.length === 0) {
    return res.status(404).send('No hay archivo para ese mes');
  }

  const file = batches[0];
  const absPath = path.resolve(file.stored_file_path);
  return res.download(absPath, file.original_file_name);
}));

module.exports = router;
