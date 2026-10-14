SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('attendance_slot_audit', 'U') IS NOT NULL DROP TABLE attendance_slot_audit;
IF OBJECT_ID('attendance_slots', 'U') IS NOT NULL DROP TABLE attendance_slots;
IF OBJECT_ID('attendance_days', 'U') IS NOT NULL DROP TABLE attendance_days;
IF OBJECT_ID('import_batches', 'U') IS NOT NULL DROP TABLE import_batches;
IF OBJECT_ID('holidays', 'U') IS NOT NULL DROP TABLE holidays;
IF OBJECT_ID('users', 'U') IS NOT NULL DROP TABLE users;
IF OBJECT_ID('employees', 'U') IS NOT NULL DROP TABLE employees;
GO

CREATE TABLE employees (
  employee_id INT IDENTITY(1,1) PRIMARY KEY,
  employee_number INT NOT NULL UNIQUE,
  display_name NVARCHAR(120) NOT NULL,
  required_minutes INT NOT NULL,
  requirement_mode VARCHAR(10) NOT NULL CONSTRAINT DF_employees_requirement_mode DEFAULT 'monthly',
  work_days_mask TINYINT NOT NULL CONSTRAINT DF_employees_work_days_mask DEFAULT 0,
  daily_required_minutes INT NOT NULL CONSTRAINT DF_employees_daily_required_minutes DEFAULT 0,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_employees_requirement CHECK (
    requirement_mode IN ('monthly', 'weekly') AND work_days_mask BETWEEN 0 AND 127
    AND daily_required_minutes BETWEEN 0 AND 1440
    AND (requirement_mode = 'monthly' OR (work_days_mask > 0 AND daily_required_minutes > 0))
  )
);
GO

CREATE TABLE users (
  user_id INT IDENTITY(1,1) PRIMARY KEY,
  username NVARCHAR(60) NOT NULL UNIQUE,
  password_hash NVARCHAR(255) NOT NULL,
  is_admin BIT NOT NULL DEFAULT 0,
  employee_id INT NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_users_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);
GO

CREATE TABLE holidays (
  holiday_id INT IDENTITY(1,1) PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  holiday_name NVARCHAR(120) NOT NULL,
  created_by INT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_holidays_user FOREIGN KEY (created_by) REFERENCES users(user_id)
);
GO

CREATE TABLE import_batches (
  import_batch_id INT IDENTITY(1,1) PRIMARY KEY,
  employee_id INT NOT NULL,
  year_month CHAR(7) NOT NULL,
  original_file_name NVARCHAR(255) NOT NULL,
  stored_file_path NVARCHAR(500) NOT NULL,
  uploaded_by INT NOT NULL,
  uploaded_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  is_active BIT NOT NULL DEFAULT 1,
  CONSTRAINT FK_import_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
  CONSTRAINT FK_import_user FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
);
GO

CREATE TABLE attendance_days (
  day_id INT IDENTITY(1,1) PRIMARY KEY,
  employee_id INT NOT NULL,
  work_date DATE NOT NULL,
  day_type CHAR(1) NOT NULL DEFAULT 'N',
  import_batch_id INT NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_day_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
  CONSTRAINT FK_day_batch FOREIGN KEY (import_batch_id) REFERENCES import_batches(import_batch_id),
  CONSTRAINT CK_attendance_days_type CHECK (day_type IN ('N', 'V', 'L')),
  CONSTRAINT UQ_day UNIQUE (employee_id, work_date, import_batch_id)
);
GO

CREATE TABLE attendance_slots (
  slot_id INT IDENTITY(1,1) PRIMARY KEY,
  day_id INT NOT NULL,
  slot_index TINYINT NOT NULL,
  original_start_time CHAR(5) NULL,
  original_end_time CHAR(5) NULL,
  current_start_time CHAR(5) NULL,
  current_end_time CHAR(5) NULL,
  source_note NVARCHAR(255) NULL,
  updated_by INT NULL,
  updated_at DATETIME2 NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_slot_day FOREIGN KEY (day_id) REFERENCES attendance_days(day_id),
  CONSTRAINT FK_slot_user FOREIGN KEY (updated_by) REFERENCES users(user_id),
  CONSTRAINT UQ_slot UNIQUE (day_id, slot_index)
);
GO

CREATE TABLE attendance_slot_audit (
  audit_id INT IDENTITY(1,1) PRIMARY KEY,
  slot_id INT NOT NULL,
  changed_by INT NOT NULL,
  old_start_time CHAR(5) NULL,
  old_end_time CHAR(5) NULL,
  new_start_time CHAR(5) NULL,
  new_end_time CHAR(5) NULL,
  comment NVARCHAR(255) NULL,
  changed_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_audit_slot FOREIGN KEY (slot_id) REFERENCES attendance_slots(slot_id),
  CONSTRAINT FK_audit_user FOREIGN KEY (changed_by) REFERENCES users(user_id)
);
GO

CREATE INDEX IX_import_employee_month ON import_batches(employee_id, year_month, is_active);
CREATE INDEX IX_days_employee_date ON attendance_days(employee_id, work_date);
CREATE INDEX IX_holidays_date ON holidays(holiday_date);
GO

INSERT INTO employees (employee_number, display_name, required_minutes, requirement_mode, work_days_mask, daily_required_minutes)
VALUES
  (1, N'Empleado 1', 7200, 'monthly', 0, 0),
  (2, N'Empleado 2', 9600, 'weekly', 31, 480),
  (3, N'Empleado 3', 8640, 'monthly', 0, 0);
GO
