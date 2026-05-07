const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const dayjs = require('dayjs');
const env = require('./config/env');
const { bootstrapData } = require('./services/bootstrap');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const importRoutes = require('./routes/importRoutes');
const holidaysRoutes = require('./routes/holidaysRoutes');
const downloadRoutes = require('./routes/downloadRoutes');
const apiRoutes = require('./routes/apiRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { requireAuth } = require('./middleware/auth');

const app = express();

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.set('view engine', 'ejs');
app.set('views', path.resolve(process.cwd(), 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(process.cwd(), 'public')));
app.use(
  session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.formatDate = (value) => {
    if (!value) {
      return '';
    }
    // Extract YYYY-MM-DD without timezone conversion to avoid off-by-one
    const dateStr = value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
    const parsed = dayjs(dateStr);
    return parsed.isValid() ? parsed.format('DD-MM-YYYY') : String(value);
  };
  next();
});

app.use(authRoutes);
app.use(adminRoutes);
app.use(attendanceRoutes);
app.use(importRoutes);
app.use(holidaysRoutes);
app.use(downloadRoutes);
app.use(apiRoutes);
app.use(reportRoutes);

app.get('/', requireAuth, (req, res) => {
  res.render('dashboard');
});

app.use((err, req, res, _next) => {
  console.error('Request error:', err && (err.stack || err.message || err));

  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }

  return res.status(500).send(err.message || 'Error interno del servidor');
});

async function start() {
  app.listen(env.port, () => {
    console.log(`Servidor iniciado en puerto ${env.port}`);
  });

  try {
    await bootstrapData();
    console.log('Bootstrap completado');
  } catch (error) {
    const details = error && (error.stack || error.message || JSON.stringify(error));
    console.error('Error en bootstrap:', details);
  }
}

start().catch((error) => {
  const details = error && (error.stack || error.message || JSON.stringify(error));
  console.error('Error iniciando aplicacion:', details);
  process.exit(1);
});
