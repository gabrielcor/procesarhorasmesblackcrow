-- Safe to run repeatedly. No employees, attendance records or imports are removed.
SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @migrateLegacyRule BIT = CASE WHEN COL_LENGTH('employees', 'requirement_mode') IS NULL THEN 1 ELSE 0 END;

  IF COL_LENGTH('employees', 'requirement_mode') IS NULL
    ALTER TABLE employees ADD requirement_mode VARCHAR(10) NOT NULL CONSTRAINT DF_employees_requirement_mode DEFAULT 'monthly';
  IF COL_LENGTH('employees', 'work_days_mask') IS NULL
    ALTER TABLE employees ADD work_days_mask TINYINT NOT NULL CONSTRAINT DF_employees_work_days_mask DEFAULT 0;
  IF COL_LENGTH('employees', 'daily_required_minutes') IS NULL
    ALTER TABLE employees ADD daily_required_minutes INT NOT NULL CONSTRAINT DF_employees_daily_required_minutes DEFAULT 0;

  -- Compile after ADD COLUMN. Convert number 2 only on the first migration;
  -- later startups must preserve any rule saved through the interface.
  IF @migrateLegacyRule = 1
    EXEC sys.sp_executesql N'UPDATE employees SET requirement_mode = ''weekly'', work_days_mask = 31, daily_required_minutes = 480 WHERE employee_number = 2';

  IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('employees') AND name = 'CK_employees_requirement')
    EXEC sys.sp_executesql N'ALTER TABLE employees WITH CHECK ADD CONSTRAINT CK_employees_requirement CHECK (
      requirement_mode IN (''monthly'', ''weekly'') AND work_days_mask BETWEEN 0 AND 127
      AND daily_required_minutes BETWEEN 0 AND 1440
      AND (requirement_mode = ''monthly'' OR (work_days_mask > 0 AND daily_required_minutes > 0))
    )';

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
