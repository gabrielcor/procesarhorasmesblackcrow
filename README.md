# procesarhorasmesblackcrow

Aplicacion web para importar hojas de asistencia mensuales, gestionarlas por usuario y calcular saldos mensuales.

## Funcionalidades implementadas

- Login con usuario y clave.
- Usuario admin por defecto: admin / pass1234* (se crea automaticamente al arrancar la app, si no existe).
- Gestion de usuarios por admin con asignacion a empleado.
- Administración de empleados por admin: crear, editar nombre y horas mensuales, desactivar y reactivar sin borrar historial.
- Importacion de archivos .xls/.xlsx desde hoja Registros de asistencia.
- Versionado de importaciones por empleado/mes (la ultima queda activa, las anteriores se conservan).
- Visualizacion mensual con:
	- Dia normal o feriado
	- Hasta 3 slots (6 marcas totales entrada/salida)
	- Minutos trabajados por dia
- Edicion de slots por admin o por el usuario del empleado.
- En UI de asistencia: solo se muestran slots con al menos una marca; se puede agregar slot con boton + hasta 3 por dia.
- Auditoria de cambios de slots (quien modifico, antes/despues).
- Descarga del archivo original del mes activo.
- Totales mensuales al pie:
	- Minutos trabajados
	- Minutos requeridos del empleado
	- Tolerancia fija de 45 minutos
	- Saldo final positivo/negativo

## Administrar empleados

1. Iniciar sesión como administrador y abrir **Empleados** en el menú superior (`/admin/employees`).
2. Completar un número único, el nombre y la **Regla de cálculo**, y pulsar **Crear empleado**. El número sugerido se puede cambiar antes de crear; después queda fijo.
3. Elegir **Horas/minutos por mes** para una cuota fija, o **Días de semana y horas por día** para seleccionar lunes, martes, etc. e indicar el tiempo diario. Esta segunda regla cuenta los días seleccionados del mes y excluye los feriados registrados en **Feriados**.
4. En el listado, abrir **Editar** para cambiar el nombre, la regla o el estado **Empleado activo**, y guardar los cambios.
5. Para dar acceso al empleado, abrir **Usuarios**, crear una cuenta y seleccionar el empleado activo.

Desactivar conserva la asistencia, las importaciones y las cuentas existentes. Impide nuevas importaciones y nuevas asignaciones de cuentas a ese empleado; no revoca el acceso de las cuentas ya vinculadas. Para revocar acceso, desactivar la cuenta en **Usuarios**. Asistencia y Reporte mantienen todos los empleados disponibles para consultar su historial.

Todas las horas registradas se suman al saldo mensual, aunque se trabajen fuera de los días seleccionados. Por ejemplo, una jornada pendiente de jueves puede recuperarse trabajando el martes. Se mantienen las reglas existentes de colación, tolerancia de 45 minutos y doble crédito por trabajo real en feriados. Para la regla semanal, vacaciones/licencias acreditan el tiempo diario configurado solo en días seleccionados no feriados; la regla mensual mantiene el crédito de 8 horas.

Asistencia, Reporte y la API usan la misma regla guardada. Cambiarla también actualiza los cálculos históricos. La regla del Nº 2 se convierte inicialmente a domingo a jueves, 8 horas por día, excluyendo feriados; luego se puede modificar como cualquier otra.

Al arrancar se ejecuta `sql/002_employee_requirements.sql`, una migración transaccional que agrega tres columnas a `employees`. Convierte la regla antigua del Nº 2 solo la primera vez y conserva las configuraciones posteriores, sin borrar registros. La cuenta de SQL necesita permiso para alterar la tabla; también se puede ejecutar ese archivo con una cuenta de migraciones antes de reiniciar. No ejecutar nuevamente `sql/001_schema.sql` sobre una base existente: ese archivo recrea las tablas. Las instalaciones nuevas ya incluyen las columnas y la regla inicial.

## Verificación

`npm test` ejecuta pruebas de calendarios y saldos, y pruebas HTTP con una base de datos simulada: permisos, validación, duplicados, creación, edición, estado, reglas e integración con usuarios/importación. Comprueba también que Asistencia, Reporte y API concuerden al compensar una jornada en otro día. Estas pruebas no ejecutan la migración ni escriben en la base configurada.

## Estructura

- src/app.js
- src/routes/
- src/services/
- src/db/
- views/
- public/
- sql/001_schema.sql

## 📚 Documentación Detallada

Para una revisión **in-depth** de la arquitectura, módulos, frameworks y patrones de implementación, consulta la **[Documentación Completa](./docs/README.md)**.

La documentación incluye:
- **[Arquitectura del Sistema](./docs/ARCHITECTURE.md)** - Diseño general, capas, flujos de datos
- **[Módulos e Interacciones](./docs/MODULES.md)** - Detalle de cada módulo y sus responsabilidades
- **[Diagramas de Interacción](./docs/MODULES_DIAGRAM.md)** - Representaciones visuales
- **[Frameworks & Tecnologías](./docs/FRAMEWORKS.md)** - Referencia completa de librerías usadas
- **[Concerns & Implementación](./docs/CONCERNS.md)** - Cómo se implementan vistas, APIs, BD, autenticación, etc.
- **[Guía de Despliegue](./docs/DEPLOYMENT.md)** - Instrucciones para diferentes ambientes

## Requisitos

- Node.js 20+
- SQL Server o Azure SQL

## Configuracion

1. Copiar .env.example como .env
2. Ajustar credenciales de SQL
3. Ejecutar script sql/001_schema.sql en la base de datos
4. Instalar dependencias:
	 npm install
5. Iniciar:
	 npm start

## Variables de entorno

- PORT
- SESSION_SECRET
- SQL_SERVER
- SQL_DATABASE
- SQL_USER
- SQL_PASSWORD
- SQL_ENCRYPT
- SQL_TRUST_CERT
- ADMIN_DEFAULT_PASSWORD (opcional, default pass1234*)

## Regla de emparejamiento aplicada en importacion

- Se detectan horas por dia y se ordenan.
- Se emparejan como entrada/salida en secuencia.
- Si queda una marca unica:
	- Antes de 12:00 se asume entrada.
	- Despues de 12:00 se asume salida.
- Si salida <= entrada, el slot queda incompleto con observacion (turno nocturno no permitido).

## Despliegue en Azure App Service

1. Crear Azure SQL y ejecutar sql/001_schema.sql.
2. Crear App Service Node.js.
3. Configurar App Settings con variables del .env.
4. Publicar el codigo (zip deploy o CI/CD).
5. Verificar login admin y flujo de importacion.

## Endpoints JSON (para frontend React o integraciones)

- GET /api/attendance/monthly?month=YYYY-MM&employeeId=ID
	- Usuario normal: ignora employeeId y devuelve su propio empleado.
	- Admin: requiere employeeId.
	- Devuelve dias del mes, slots existentes por dia, indices de slots disponibles y resumen mensual.

- GET /api/audit/slots?month=YYYY-MM&employeeId=ID
	- Usuario normal: ignora employeeId y devuelve su propio historial.
	- Admin: requiere employeeId.
	- Devuelve historial de cambios de slots del mes con usuario, fecha, valores antes/despues y comentario.

## Despliegue en Azure del paquete node
- Hacer un .zip con node_modules, public, sql, scr,view y los dos archivos package-lock.json y packaje.json
- Subirlo como .zip al Web App
app-deploy.zip
