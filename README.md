# procesarhorasmesblackcrow

Aplicacion web para importar hojas de asistencia mensuales, gestionarlas por usuario y calcular saldos mensuales.

## Funcionalidades implementadas

- Login con usuario y clave.
- Usuario admin por defecto: admin / pass1234* (se crea automaticamente al arrancar la app, si no existe).
- Gestion de usuarios por admin con asignacion a empleado.
- Importacion de archivos .xls/.xlsx desde hoja Registros de asistencia.
- Versionado de importaciones por empleado/mes (la ultima queda activa, las anteriores se conservan).
- Visualizacion mensual con:
	- Dia normal o feriado
	- Hasta 6 slots (entrada/salida)
	- Minutos trabajados por dia
- Edicion de slots por admin o por el usuario del empleado.
- Auditoria de cambios de slots (quien modifico, antes/despues).
- Descarga del archivo original del mes activo.
- Totales mensuales al pie:
	- Minutos trabajados
	- Minutos requeridos del empleado
	- Tolerancia fija de 45 minutos
	- Saldo final positivo/negativo

## Estructura

- src/app.js
- src/routes/
- src/services/
- src/db/
- views/
- public/
- sql/001_schema.sql

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

## Nota importante del entorno actual

En este entorno de trabajo no hay Node.js ni npm instalados, por lo que no fue posible ejecutar ni validar la app en runtime aqui. El codigo y scripts quedaron implementados para que puedas correrlos localmente o en CI/CD con Node disponible.