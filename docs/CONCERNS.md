# Concerns & Implementation

Detailed breakdown of how different application concerns (views, APIs, database, etc.) are implemented using the various frameworks and technologies.

---

## 1. Frontend - Server-Rendered Views (EJS)

### Overview
The application uses **server-side rendered HTML** via EJS templates. The server generates complete HTML pages that are sent to the browser, without JavaScript frameworks like React.

### Architecture

```
Browser Request (GET /attendance)
         │
         ▼
Express Routes Handler
         │
    ├─ Query Database
    ├─ Call Services
    ├─ Prepare Data
         │
         ▼
EJS Template Engine
         │
    ├─ Embed JavaScript logic
    ├─ Loop through data
    ├─ Conditional rendering
         │
         ▼
Complete HTML
         │
         ▼
Browser (Direct rendering, no compilation)
```

### Key Templates

#### login.ejs
- HTML form with username/password fields
- POST to `/auth/login`
- Error message display
- No authentication required

#### dashboard.ejs
- Main landing page after login
- Quick navigation links
- User greeting
- Role-based menu options

#### attendance.ejs
- **Core feature template**
- Monthly calendar grid
- Displays slots per day
- Shows hours and minutes per day
- Monthly totals footer
- Edit buttons (for admin/self)
- Features:
  - Calendar layout showing all days of month
  - Holiday highlighting
  - Slot display (entry/exit times)
  - Daily minutes calculation
  - "Add Slot" button (if less than 3 slots)
  - Monthly balance display

#### upload.ejs
- File input for Excel upload
- Form with `enctype="multipart/form-data"`
- Admin-only access
- Success/error messages
- Upload history display

#### users.ejs
- User management admin page
- User list table
- Edit/delete buttons
- Create new user form
- Role assignment

#### holidays.ejs
- Holiday management interface
- List existing holidays
- Add new holiday form
- Delete holiday option

### Partial Templates

#### partials/header.ejs
- Navigation bar
- User welcome message
- Logout button
- Logo/branding

#### partials/footer.ejs
- Footer content
- Copyright
- Version info

### Template Inheritance Pattern

```
Base Layout (via includes)
├── Header (partials/header.ejs)
├── Page-specific content
├── Footer (partials/footer.ejs)
```

### Dynamic Features in Templates

#### Date Formatting
```ejs
<!-- formatDate is a function passed from routes -->
<%= formatDate(attendanceRecord.date) %>
<!-- Output: 15-02-2026 -->
```

#### Conditionals
```ejs
<% if (user.role === 'admin') { %>
  <button>Edit User</button>
<% } %>
```

#### Loops
```ejs
<% attendance.forEach(day => { %>
  <div><%= day.date %></div>
<% }); %>
```

#### Data Display
```ejs
<%- include('partials/header') %>
<!-- include header partial -->

<div class="content">
  <%= data.title %>
</div>
```

### Styling
- **CSS Framework**: Custom CSS in `/public/styles.css`
- **Responsive Design**: Bootstrap classes (if included)
- **Static Assets**: Served from `/public` via `express.static()`

### Form Submission
- Traditional HTML forms (no AJAX by default)
- POST requests submit data
- Server responds with redirect or new page

```ejs
<form method="POST" action="/attendance/slot/edit">
  <input type="hidden" name="slotId" value="<%= slot.id %>">
  <input type="text" name="entryTime" value="<%= slot.entry %>">
  <input type="text" name="exitTime" value="<%= slot.exit %>">
  <button type="submit">Save</button>
</form>
```

---

## 2. REST APIs - JSON Endpoints

### Overview
RESTful JSON endpoints allow programmatic access to application data for integrations, mobile apps, or alternative frontends (React, Vue, etc.).

### API Endpoints

#### GET /api/attendance/monthly

**Purpose**: Retrieve monthly attendance data in JSON format.

**Query Parameters**:
- `month` (required) - Format: `YYYY-MM` (e.g., "2026-02")
- `employeeId` (optional) - Required for admin, ignored for employees

**Authorization**:
- Requires authentication (session)
- Employees can only access their own data
- Admins can access any employee's data

**Response**:
```javascript
{
  "days": [
    {
      "date": "2026-02-01",
      "dayOfWeek": "Sunday",
      "isHoliday": false,
      "slots": [
        {
          "id": 123,
          "entry": "08:00",
          "exit": "12:00",
          "minutes": 240
        },
        {
          "id": 124,
          "entry": "13:00",
          "exit": "17:30",
          "minutes": 270
        }
      ],
      "dayTotalMinutes": 510,
      "dayRequiredMinutes": 480
    }
    // ... more days
  ],
  "summary": {
    "totalMinutesWorked": 8100,
    "requiredMinutesMonth": 8640,
    "fixedTolerance": 45,
    "balance": -495,
    "status": "negative"
  }
}
```

**Implementation Flow**:
```javascript
// apiRoutes.js
app.get('/api/attendance/monthly', requireAuth, async (req, res) => {
  1. Extract month and employeeId from query
  2. Verify authorization (employee can only see own)
  3. Query attendance records from DB
  4. Query holidays from DB
  5. Call timeService to calculate totals
  6. Format response as JSON
  7. res.json(formattedData)
});
```

#### GET /api/audit/slots

**Purpose**: Retrieve audit history of slot changes.

**Query Parameters**:
- `month` (required) - Format: `YYYY-MM`
- `employeeId` (optional) - Required for admin

**Authorization**: Same as `/api/attendance/monthly`

**Response**:
```javascript
{
  "auditHistory": [
    {
      "date": "2026-02-10T14:30:00Z",
      "modifiedBy": "admin_user",
      "modifiedByRole": "admin",
      "day": "2026-02-15",
      "slotIndex": 1,
      "beforeValues": {
        "entry": "08:00",
        "exit": "12:00"
      },
      "afterValues": {
        "entry": "08:30",
        "exit": "12:00"
      },
      "comment": "Corrected entry time"
    }
    // ... more audit entries
  ]
}
```

### Response Formats

#### Success Response (HTTP 200)
```javascript
{
  "data": {...},
  "meta": {
    "month": "2026-02",
    "retrievedAt": "2026-02-15T10:30:00Z"
  }
}
```

#### Error Response (HTTP 400/500)
```javascript
{
  "error": "Invalid month format. Use YYYY-MM"
}
```

### Implementation Details

**Location**: `src/routes/apiRoutes.js`

**Middleware Chain**:
1. `requireAuth` - Check session exists
2. Route handler executes
3. Database queries
4. Response formatting

**Error Handling**:
- Invalid parameters → 400 Bad Request
- Unauthorized access → 401/403
- Server errors → 500 with error message

### API Contract

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/attendance/monthly` | GET | Yes | Get monthly attendance |
| `/api/audit/slots` | GET | Yes | Get change audit trail |

---

## 3. Database Layer

### Overview
All data persistence handled via MSSQL/Azure SQL with a custom query abstraction layer.

### Architecture

```
Application Code (Routes/Services)
         │
         ▼
Database Layer (src/db/index.js)
         │
    ├─ Connection Pool Management
    ├─ Query Parameterization
    ├─ Error Handling
         │
         ▼
MSSQL Library (npm mssql)
         │
         ▼
SQL Server / Azure SQL Database
```

### Connection Management

**Pool Creation** (`src/db/index.js`):
```javascript
async function getPool() {
  if (pool) return pool;
  
  pool = await sql.connect(buildSqlConfig());
  return pool;
}
```

**Benefits**:
- Single pool reused across requests
- Connection reuse improves performance
- Reduces connection overhead

**Configuration Sources**:
1. Environment variables (`.env`)
2. Connection string parsing
3. Auth method auto-detection

### Query Execution

**Parameterized Queries** (SQL Injection Prevention):
```javascript
const result = await query(
  'SELECT * FROM Users WHERE Username = @username AND Id = @id',
  {
    username: 'john_doe',
    id: 123
  }
);
```

**Named Parameters**:
- Prefixed with `@`
- Passed as object to query function
- MSSQL library handles parameterization

### Data Operations

#### Create (INSERT)
```javascript
await query(
  'INSERT INTO Attendance (EmployeeId, Date, EntryTime, ExitTime) VALUES (@empId, @date, @entry, @exit)',
  {
    empId: 5,
    date: '2026-02-15',
    entry: '08:00',
    exit: '17:00'
  }
);
```

#### Read (SELECT)
```javascript
const result = await query(
  'SELECT * FROM Users WHERE Id = @id',
  { id: 123 }
);
const users = result.recordset; // Array of records
```

#### Update
```javascript
await query(
  'UPDATE Attendance SET ExitTime = @exit WHERE Id = @id',
  { exit: '17:30', id: 456 }
);
```

#### Delete
```javascript
await query(
  'DELETE FROM Holidays WHERE Id = @id',
  { id: 789 }
);
```

### Schema Overview

```
Users
├── Id (PK)
├── Username (unique)
├── PasswordHash
├── Role (admin/employee)
└── CreatedAt

Employees
├── Id (PK)
├── UserId (FK)
├── Name
├── RequiredHoursPerDay
└── CreatedAt

Attendance
├── Id (PK)
├── EmployeeId (FK)
├── Date
├── SlotIndex (1-3)
├── EntryTime
├── ExitTime
├── IsActive
└── ImportId (FK)

Holidays
├── Id (PK)
├── Date
├── Description
└── CreatedAt

AuditLogs
├── Id (PK)
├── EmployeeId (FK)
├── ModifiedBy (FK)
├── Date
├── Change
├── BeforeValue
├── AfterValue
└── Timestamp

ImportHistory
├── Id (PK)
├── EmployeeId (FK)
├── FileName
├── UploadedAt
├── IsActive
└── RecordCount
```

### Transaction Handling

**Multi-step Operations**:
```javascript
const transaction = pool.transaction();

await transaction.begin();
try {
  // Mark previous import inactive
  await transaction.request().query('UPDATE ImportHistory SET IsActive = 0 WHERE EmployeeId = @empId AND IsActive = 1');
  
  // Insert new records
  await transaction.request().query('INSERT INTO Attendance ...');
  
  await transaction.commit();
} catch (err) {
  await transaction.rollback();
  throw err;
}
```

**Benefits**:
- All-or-nothing operations
- Data consistency
- Rollback on failure

### Error Handling

```javascript
try {
  const result = await query(sql, params);
} catch (error) {
  if (error.message.includes('PRIMARY KEY')) {
    // Duplicate key error
    res.status(400).json({ error: 'Duplicate entry' });
  } else {
    // Other database error
    res.status(500).json({ error: 'Database error' });
  }
}
```

### Authentication Methods

#### 1. SQL Authentication
```javascript
{
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE
}
```
Used for local development with local SQL Server.

#### 2. Azure Active Directory
```javascript
{
  authentication: {
    type: 'azure-active-directory-default'
  },
  server: 'myserver.database.windows.net',
  database: process.env.SQL_DATABASE
}
```
Used in Azure App Service for seamless AAD integration.

### Connection String Support

**Full Connection String** (optional):
```
Server=myserver.database.windows.net;Database=mydb;Authentication="Active Directory Default";Encrypt=true;
```

Parsed automatically in `env.js` if `SQL_CONNECTION_STRING` is provided.

---

## 4. Authentication & Authorization

### Overview
Session-based authentication with role-based access control (RBAC).

### Authentication Flow

```
1. User visits /login
   ├─ GET /login renders login form
   
2. User submits credentials
   ├─ POST /auth/login
   ├─ Username/password in form data
   
3. Server validates
   ├─ Query user by username
   ├─ bcryptjs.compare(submitted, hash)
   
4. If valid:
   ├─ Create session
   ├─ req.session.user = {...}
   ├─ Redirect to /
   
5. Subsequent requests:
   ├─ Browser sends session cookie
   ├─ Express-session retrieves session
   ├─ req.session.user available
   ├─ Middleware allows access
   
6. On logout:
   ├─ GET /auth/logout
   ├─ req.session.destroy()
   ├─ Redirect to /login
```

### Session Data Structure

```javascript
req.session = {
  user: {
    id: 1,
    username: 'john_doe',
    role: 'employee',
    employeeId: 5
  },
  // Internal session properties
  cookie: {
    originalMaxAge: null,
    expires: null,
    httpOnly: true,
    path: '/',
    domain: null,
    secure: false,
    sameSite: undefined
  }
}
```

### Role-Based Access Control (RBAC)

#### Roles
1. **admin** - Full system access
2. **employee** - Limited to own records

#### Middleware Enforcement

```javascript
// src/middleware/auth.js

// Check if authenticated
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// Check if admin
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send('Forbidden');
  }
  next();
}

// Check if employee
function requireEmployee(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'employee') {
    return res.status(403).send('Forbidden');
  }
  next();
}
```

#### Route Protection

```javascript
// Admin-only routes
app.get('/admin', requireAuth, requireAdmin, (req, res) => {...});

// Employee routes
app.get('/attendance', requireAuth, (req, res) => {...});

// Public routes (before auth middleware)
app.get('/login', (req, res) => {...});
```

### Data Access Control

**Employee accessing own data**:
```javascript
// Attendance for current employee
const attendanceData = await query(
  'SELECT * FROM Attendance WHERE EmployeeId = @empId AND Date >= @startDate AND Date <= @endDate',
  {
    empId: req.session.user.employeeId,
    startDate: '2026-02-01',
    endDate: '2026-02-28'
  }
);
```

**Admin accessing any employee data**:
```javascript
// Attendance for specified employee (via query param)
const employeeId = req.query.employeeId || req.session.user.employeeId;
if (req.session.user.role === 'employee' && employeeId !== req.session.user.employeeId) {
  return res.status(403).json({ error: 'Forbidden' });
}

const attendanceData = await query(
  'SELECT * FROM Attendance WHERE EmployeeId = @empId AND Date >= @startDate AND Date <= @endDate',
  { empId: employeeId, startDate, endDate }
);
```

### Password Security

#### Hashing (bcryptjs)
```javascript
// When creating/updating user
const hashedPassword = await bcryptjs.hash(plainPassword, 10);
// 10 = cost factor (hashing rounds)

await query(
  'INSERT INTO Users (Username, PasswordHash, Role) VALUES (@user, @pass, @role)',
  { user, pass: hashedPassword, role }
);
```

#### Verification
```javascript
// During login
const user = await query('SELECT * FROM Users WHERE Username = @user', { user });
const isValidPassword = await bcryptjs.compare(
  submittedPassword,
  user.recordset[0].PasswordHash
);

if (isValidPassword) {
  req.session.user = { ... };
} else {
  res.send('Invalid credentials');
}
```

---

## 5. File Processing & Import

### Overview
Excel files are uploaded, parsed, validated, and processed to populate attendance records.

### Import Flow

```
┌────────────────────────────────────────┐
│ User uploads Excel file (POST /import) │
└────────┬───────────────────────────────┘
         │
         ▼
    ┌──────────────────┐
    │ Multer Middleware│  ← Saves file
    │ /uploads dir     │
    └────────┬─────────┘
             │
             ▼
    ┌────────────────────────────┐
    │ excelParser.parseExcel()   │
    │                            │
    │ 1. Read XLSX file          │
    │ 2. Extract data            │
    │ 3. Validate format         │
    │ 4. Apply slot algorithm    │
    └────────┬───────────────────┘
             │
             ▼
    ┌────────────────────────────┐
    │ Database Transaction       │
    │                            │
    │ 1. Mark prev inactive      │
    │ 2. Insert new records      │
    │ 3. Create audit log        │
    │ 4. Commit                  │
    └────────┬───────────────────┘
             │
             ▼
    ┌──────────────────────────┐
    │ Redirect to attendance   │
    │ Show success message     │
    └──────────────────────────┘
```

### Excel File Format

**Expected Structure**:
- Sheet name: "Registros de asistencia" (Attendance Records)
- Headers: Date, Employee Name/ID, Time entries
- Format: Standard XLSX (Excel 2007+)

**Example**:
```
| Date       | Employee | Time 1 | Time 2 | Time 3 | Time 4 | Time 5 | Time 6 |
|------------|----------|--------|--------|--------|--------|--------|--------|
| 02/01/2026 | John Doe | 08:00  | 12:30  | 13:00  | 17:00  |        |        |
| 02/02/2026 | John Doe | 08:15  | 12:45  | 13:30  | 17:30  |        |        |
```

### Slot Matching Algorithm

**Purpose**: Pair entry/exit times and handle incomplete records.

**Algorithm**:
```
For each day:
  1. Collect all recorded times
  2. Sort chronologically
  3. Pair sequentially as (entry, exit)
  4. If odd number of times:
     - Before 12:00 PM → entry time
     - After 12:00 PM → exit time
     - Otherwise → single slot (incomplete)
  5. Validate exit > entry (no overnight shifts)
  6. If exit < entry → mark slot as incomplete/invalid
  7. Calculate minutes worked (exit - entry)
  8. Store up to 3 slots per day max
```

**Examples**:

| Times | Result |
|-------|--------|
| 08:00, 12:30, 13:00, 17:00 | Slot 1: 08:00-12:30 (270 min), Slot 2: 13:00-17:00 (240 min) |
| 08:00, 12:30 | Slot 1: 08:00-12:30 (270 min) |
| 08:00 | Slot 1: 08:00 entry (before noon) |
| 17:00 | Slot 1: 17:00 exit (after noon) |
| 08:00, 17:00, 20:00 | Slot 1: 08:00-17:00 (540 min), Slot 2: 20:00 exit |

### Excel Parser Implementation

**Location**: `src/services/excelParser.js`

**Key Functions**:
- `parseExcel(filePath)` - Main parser
- `extractTimesForDay()` - Extract times for single day
- `matchSlots()` - Apply pairing algorithm
- `validateSlot()` - Validate slot data

**Error Handling**:
- Invalid file format → Error message
- Missing sheet → Error message
- Invalid date format → Skip record
- Invalid time format → Skip time entry

### Data Versioning

**Import History**:
```javascript
// Previous import marked inactive
UPDATE ImportHistory SET IsActive = 0 
WHERE EmployeeId = @empId AND IsActive = 1;

// New import stored
INSERT INTO ImportHistory (EmployeeId, FileName, UploadedAt, IsActive, RecordCount)
VALUES (@empId, @fileName, GETUTCDATE(), 1, @count);

// Attendance records linked
INSERT INTO Attendance (..., ImportId, IsActive) 
VALUES (..., @newImportId, 1);
```

**Benefits**:
- Complete history of imports maintained
- Can revert to previous version if needed
- Audit trail of changes

### File Download

**Location**: `src/routes/downloadRoutes.js`

**Flow**:
```javascript
1. Query ImportHistory for active import
2. Get file path from database
3. Read file from /uploads
4. Stream to client
5. Browser triggers download
```

---

## 6. Business Logic - Time Calculations

### Overview
Core calculations for attendance metrics.

### Time Service (`src/services/time.js`)

**Key Calculations**:

#### 1. Minutes Between Times
```javascript
function minutesBetween(entryTime, exitTime) {
  // Convert "HH:MM" to minutes since midnight
  // Calculate difference
  // Return minutes
}
```

#### 2. Daily Totals
```javascript
function calculateDayTotal(slots) {
  // Sum minutes from all slots for day
  // Handle incomplete slots
  // Return total minutes
}
```

#### 3. Monthly Totals
```javascript
function calculateMonthlyTotal(attendanceRecords) {
  let totalMinutes = 0;
  
  attendanceRecords.forEach(day => {
    totalMinutes += calculateDayTotal(day.slots);
  });
  
  return totalMinutes;
}
```

#### 4. Required Hours
```javascript
function calculateRequiredHours(employee, monthDays) {
  // Get employee required hours per day
  // Multiply by weekdays in month
  // Subtract holidays
  // Return required minutes
}
```

#### 5. Balance Calculation
```javascript
function calculateBalance(totalWorked, requiredHours, tolerance = 45) {
  // balance = totalWorked - requiredHours + tolerance
  // Positive = credit
  // Negative = debt
  
  return totalWorked - requiredHours + tolerance;
}
```

### Calculation Example

```
Employee: John Doe
Required: 8 hours per day
Month: February 2026 (22 weekdays)

Days worked:
- Feb 1:  Slot 1: 08:00-12:30 = 270 min
          Slot 2: 13:00-17:00 = 240 min
          Daily total: 510 min
- Feb 2:  Slot 1: 08:30-12:45 = 255 min
          Slot 2: 13:30-17:30 = 240 min
          Daily total: 495 min
- ...
- Feb 28: Slot 1: 08:00-17:00 = 540 min
          Daily total: 540 min

Totals:
- Total worked: 8,100 min
- Required: 22 days × 480 min = 10,560 min
- Tolerance: +45 min
- Balance: 8,100 - 10,560 + 45 = -2,415 min = -40.25 hours

Status: NEGATIVE (40 hours 15 minutes behind)
```

### Display in Templates

```ejs
<div class="totals">
  <p>Minutos trabajados: <%= summary.totalMinutesWorked %> (<%=  Math.floor(summary.totalMinutesWorked / 60) %>h <%= summary.totalMinutesWorked % 60 %>m)</p>
  <p>Minutos requeridos: <%= summary.requiredMinutes %> (<%= Math.floor(summary.requiredMinutes / 60) %>h)</p>
  <p>Tolerancia: +<%= summary.tolerance %> min</p>
  <p class="<%= summary.balance >= 0 ? 'positive' : 'negative' %>">
    Saldo: <%= summary.balance %> min
  </p>
</div>
```

---

## 7. Audit Logging

### Overview
Track all changes to attendance records for compliance and transparency.

### Audit Entry Structure

```javascript
{
  id: 1,
  employeeId: 5,
  modifiedByUserId: 1,
  date: "2026-02-15T14:30:00Z",
  recordDay: "2026-02-10",
  slotIndex: 1,
  beforeValues: {
    entry: "08:00",
    exit: "12:00"
  },
  afterValues: {
    entry: "08:30",
    exit: "12:00"
  },
  comment: "Corrected entry time per employee request"
}
```

### Audit Recording

When slot is edited:
```javascript
// 1. Get current slot values (before)
const beforeSlot = await query('SELECT * FROM Attendance WHERE Id = @id', { id: slotId });

// 2. Update slot
await query('UPDATE Attendance SET EntryTime = @entry, ExitTime = @exit WHERE Id = @id', {...});

// 3. Log to audit table
await query(
  'INSERT INTO AuditLogs (EmployeeId, ModifiedBy, Date, RecordDay, SlotIndex, BeforeValue, AfterValue) VALUES (...)',
  {
    employeeId: employeeId,
    modifiedBy: req.session.user.id,
    date: new Date(),
    recordDay: day,
    slotIndex: slotIndex,
    beforeValue: JSON.stringify(beforeSlot.recordset[0]),
    afterValue: JSON.stringify(newValues)
  }
);
```

### Audit Retrieval

**API Endpoint**: `GET /api/audit/slots?month=YYYY-MM&employeeId=ID`

```javascript
const auditEntries = await query(
  `SELECT a.*, u.Username as ModifiedByUser
   FROM AuditLogs a
   JOIN Users u ON a.ModifiedBy = u.Id
   WHERE a.EmployeeId = @empId AND YEAR(a.Date) = @year AND MONTH(a.Date) = @month
   ORDER BY a.Date DESC`,
  { empId, year, month }
);
```

---

**See Also**:
- [Modules & Interactions](./MODULES.md) for module details
- [Frameworks & Technologies](./FRAMEWORKS.md) for technology reference
