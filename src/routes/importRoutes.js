const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const dayjs = require('dayjs');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { parseAttendanceSheet } = require('../services/excelParser');
const { getPool, sql } = require('../db');
const { query } = require('../db');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(process.cwd(), 'uploads'));
  },
  filename: (_req, file, cb) => {
    const name = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, name);
  }
});

const upload = multer({ storage });

router.get('/import', requireAuth, requireAdmin, async (req, res) => {
  const employees = await query('SELECT employee_id, employee_number, display_name FROM employees ORDER BY employee_number');
  return res.render('upload', {
    employees,
    message: req.query.message || null
  });
});

router.post('/import', requireAuth, requireAdmin, upload.single('worksheet'), async (req, res) => {
  if (!req.file) {
    return res.redirect('/import?message=Debe+seleccionar+un+archivo');
  }

  const employeeId = Number(req.body.employeeId);
  if (!employeeId) {
    return res.redirect('/import?message=Debe+seleccionar+empleado');
  }

  const absPath = path.resolve(req.file.path);

  try {
    const parsed = parseAttendanceSheet(absPath);

    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      await new sql.Request(tx)
        .input('employeeId', employeeId)
        .input('yearMonth', parsed.yearMonth)
        .query(
          'UPDATE import_batches SET is_active = 0 WHERE employee_id = @employeeId AND year_month = @yearMonth AND is_active = 1'
        );

      const batchResult = await new sql.Request(tx)
        .input('employeeId', employeeId)
        .input('yearMonth', parsed.yearMonth)
        .input('originalFileName', req.file.originalname)
        .input('storedFilePath', absPath)
        .input('uploadedBy', req.session.user.id)
        .query(
          `
          INSERT INTO import_batches
            (employee_id, year_month, original_file_name, stored_file_path, uploaded_by, is_active)
          OUTPUT INSERTED.import_batch_id
          VALUES
            (@employeeId, @yearMonth, @originalFileName, @storedFilePath, @uploadedBy, 1)
          `
        );

      const importBatchId = batchResult.recordset[0].import_batch_id;

      for (const day of parsed.days) {
        const workDate = dayjs(`${parsed.yearMonth}-${String(day.day).padStart(2, '0')}`).format('YYYY-MM-DD');

        const dayResult = await new sql.Request(tx)
          .input('employeeId', employeeId)
          .input('workDate', workDate)
          .input('importBatchId', importBatchId)
          .query(
            `
            INSERT INTO attendance_days (employee_id, work_date, import_batch_id)
            OUTPUT INSERTED.day_id
            VALUES (@employeeId, @workDate, @importBatchId)
            `
          );

        const dayId = dayResult.recordset[0].day_id;

        for (let i = 0; i < Math.min(day.slots.length, 6); i += 1) {
          const slot = day.slots[i];
          await new sql.Request(tx)
            .input('dayId', dayId)
            .input('slotIndex', i + 1)
            .input('originalStartTime', slot.start)
            .input('originalEndTime', slot.end)
            .input('currentStartTime', slot.start)
            .input('currentEndTime', slot.end)
            .input('sourceNote', slot.incompleteReason)
            .query(
              `
              INSERT INTO attendance_slots
                (day_id, slot_index, original_start_time, original_end_time, current_start_time, current_end_time, source_note)
              VALUES
                (@dayId, @slotIndex, @originalStartTime, @originalEndTime, @currentStartTime, @currentEndTime, @sourceNote)
              `
            );
        }
      }

      await tx.commit();
      return res.redirect(`/attendance?month=${parsed.yearMonth}&employeeId=${employeeId}&message=Importacion+completada`);
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  } catch (error) {
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }
    return res.redirect(`/import?message=${encodeURIComponent(`Error al importar: ${error.message}`)}`);
  }
});

module.exports = router;
