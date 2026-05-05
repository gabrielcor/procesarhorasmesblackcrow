const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const env = require('./config/env');
const { bootstrapData } = require('./services/bootstrap');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const importRoutes = require('./routes/importRoutes');
const holidaysRoutes = require('./routes/holidaysRoutes');
const downloadRoutes = require('./routes/downloadRoutes');
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
  next();
});

app.use(authRoutes);
app.use(adminRoutes);
app.use(attendanceRoutes);
app.use(importRoutes);
app.use(holidaysRoutes);
app.use(downloadRoutes);

app.get('/', requireAuth, (req, res) => {
  res.render('dashboard');
});

app.use((err, _req, res, _next) => {
  res.status(500).send(err.message);
});

async function start() {
  await bootstrapData();
  app.listen(env.port, () => {
    console.log(`Servidor iniciado en puerto ${env.port}`);
  });
}

start().catch((error) => {
  console.error('Error iniciando aplicacion:', error.message);
  process.exit(1);
});
