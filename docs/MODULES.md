# Modules & Interactions

## Module Overview

The application is organized into several key modules, each handling a specific domain of functionality. This document details each module, its responsibilities, key functions, and interactions with other modules.

## Module Inventory

```
src/
├── routes/
│   ├── authRoutes.js          # Authentication & Session
│   ├── adminRoutes.js         # Admin Panel & User Management
│   ├── attendanceRoutes.js    # Attendance Viewing/Editing
│   ├── importRoutes.js        # Excel Import Handling
│   ├── holidaysRoutes.js      # Holiday Management
│   ├── downloadRoutes.js      # File Download
│   └── apiRoutes.js           # JSON API Endpoints
├── services/
│   ├── bootstrap.js           # System Initialization
│   ├── excelParser.js         # Excel Parsing & Slot Matching
│   └── time.js                # Time Calculations
├── middleware/
│   └── auth.js                # Authentication & Authorization
├── db/
│   └── index.js               # Database Access Layer
└── config/
    └── env.js                 # Configuration Management
```

---

## Detailed Module Documentation

### 1. Authentication Module (`authRoutes.js`)

**Purpose**: Handle user login/logout and session management.

**Key Routes**:
- `GET /login` - Display login form
- `POST /auth/login` - Authenticate user
- `GET /auth/logout` - Terminate session

**Key Responsibilities**:
- Validate credentials against database
- Hash password comparison using bcryptjs
- Create/destroy user sessions
- Set user in req.session.user

**Interactions**:
- ↔️ Database Layer: Query user by username, fetch user record
- ↔️ Auth Middleware: Session data used by requireAuth
- → Presentation: Renders login form, redirects after auth

**Session Data Structure**:
```javascript
req.session.user = {
  id: number,
  username: string,
  role: 'admin' | 'employee',
  employeeId: number
}
```

---

### 2. Admin Routes Module (`adminRoutes.js`)

**Purpose**: Manage users, employees, and view admin dashboard.

**Key Routes**:
- `GET /admin` - Admin dashboard
- `GET /admin/users` - List users
- `GET /admin/users/new` - Create user form
- `POST /admin/users` - Create user
- `POST /admin/users/:id/update` - Update user
- `GET /admin/users/:id/delete` - Delete user
- `GET /admin/employees` - Manage employees

**Key Responsibilities**:
- User CRUD operations
- Role assignment (admin/employee)
- Employee linking
- Access control for admin-only routes

**Interactions**:
- ↔️ Database Layer: User/employee queries and updates
- ↔️ Auth Middleware: Enforces admin role check
- ↔️ Bootstrap Service: Initializes default admin
- → Presentation: Renders admin forms and lists

**Authorization**:
- All admin routes require `role === 'admin'`

---

### 3. Attendance Routes Module (`attendanceRoutes.js`)

**Purpose**: Display and edit attendance records.

**Key Routes**:
- `GET /attendance` - Monthly attendance view
- `POST /attendance/slot/:id/edit` - Edit slot
- `GET /api/audit/slots` - Audit history

**Key Responsibilities**:
- Fetch attendance records for month
- Display in calendar format
- Allow slot creation/editing
- Calculate and display totals
- Track audit trail for changes

**Interactions**:
- ↔️ Database Layer: Fetch attendance, holidays, audit logs
- ↔️ Auth Middleware: Requires authentication
- ↔️ Time Service: Calculate totals, minutes per day
- → Presentation: Renders attendance calendar

**Logic**:
- Normal users see only their own attendance
- Admins can view/edit any employee's attendance
- Slots are displayed/edited with entry/exit times

---

### 4. Import Routes Module (`importRoutes.js`)

**Purpose**: Handle Excel file uploads and attendance data import.

**Key Routes**:
- `GET /import` - Import form
- `POST /import` - Handle file upload

**Key Responsibilities**:
- Accept Excel file uploads via Multer
- Validate file format
- Parse Excel content
- Store imported data with versioning
- Handle import history

**Interactions**:
- ↔️ Excel Parser Service: Parse and validate Excel content
- ↔️ Database Layer: Store imported records
- ↔️ Auth Middleware: Requires admin role
- → File System: Store uploaded files in `/uploads`

**Process Flow**:
```
1. File Upload
2. Multer saves file to /uploads
3. excelParser reads and validates
4. Slot matching algorithm applied
5. Records inserted into database
6. Previous import marked inactive
7. Audit log created
```

---

### 5. Holidays Routes Module (`holidaysRoutes.js`)

**Purpose**: Manage holidays and special dates.

**Key Routes**:
- `GET /admin/holidays` - Holiday list
- `POST /admin/holidays/add` - Add holiday
- `POST /admin/holidays/:id/delete` - Delete holiday

**Key Responsibilities**:
- CRUD operations for holidays
- Store dates and descriptions
- Make holidays visible in attendance views

**Interactions**:
- ↔️ Database Layer: Holiday queries and mutations
- ↔️ Auth Middleware: Requires admin role
- ↔️ Attendance Routes: Highlights holidays in calendar

---

### 6. Download Routes Module (`downloadRoutes.js`)

**Purpose**: Enable users to download their import files.

**Key Routes**:
- `GET /download/attendance/:month` - Download month's Excel file

**Key Responsibilities**:
- Retrieve original uploaded file
- Stream file to client
- Handle file not found errors

**Interactions**:
- ↔️ Database Layer: Query for active import file path
- ↔️ Auth Middleware: Requires authentication
- → File System: Read and stream file

---

### 7. API Routes Module (`apiRoutes.js`)

**Purpose**: Provide RESTful JSON endpoints for frontend integrations.

**Key Routes**:
- `GET /api/attendance/monthly` - Get monthly attendance data
- `GET /api/audit/slots` - Get audit trail

**Key Responsibilities**:
- Return structured JSON responses
- Enable alternative frontends (React, mobile)
- Provide programmatic access to attendance data

**Interactions**:
- ↔️ Database Layer: Query attendance records
- ↔️ Auth Middleware: Requires authentication
- ↔️ Time Service: Calculate totals

**Response Format**:
```javascript
{
  days: [
    {
      date: "2026-02-15",
      dayOfWeek: "Sunday",
      isHoliday: false,
      slots: [
        { id: 1, entry: "08:00", exit: "12:00", minutes: 240 }
      ],
      totalMinutes: 240
    }
  ],
  summary: {
    totalMinutes: 8000,
    requiredMinutes: 8640,
    tolerance: 45,
    balance: -635
  }
}
```

---

## Service Modules

### 8. Bootstrap Service (`services/bootstrap.js`)

**Purpose**: Initialize application data and default users.

**Key Functions**:
- `bootstrapData()` - Initialize default admin user

**Responsibilities**:
- Create default admin if not exists
- Set up initial system state
- Run on application startup

**Interactions**:
- ↔️ Database Layer: Query and insert admin user
- → App Startup: Called from app.js

**Default Admin**:
- Username: `admin`
- Password: `pass1234*` (or env variable `ADMIN_DEFAULT_PASSWORD`)

---

### 9. Excel Parser Service (`services/excelParser.js`)

**Purpose**: Parse Excel files and extract attendance data.

**Key Functions**:
- `parseExcel(filePath)` - Parse and return attendance records
- Slot matching algorithm

**Responsibilities**:
- Read XLSX files
- Extract data from "Registros de asistencia" sheet
- Apply slot pairing logic:
  - Times ordered by day
  - Paired as entry/exit sequentially
  - Unpaired times (before/after noon) classified as entry/exit
- Validation of date/time formats

**Interactions**:
- ↔️ Import Routes: Called during file upload
- → XLSX Library: Read and parse Excel file

**Slot Matching Algorithm**:
```
For each day:
  1. Collect all recorded times
  2. Sort chronologically
  3. Pair as (entry, exit) sequentially
  4. If odd number of entries:
     - Before 12:00 PM → entry
     - After 12:00 PM → exit
  5. Validate exit > entry (no night shifts allowed)
```

---

### 10. Time Service (`services/time.js`)

**Purpose**: Calculate time-related metrics.

**Key Functions**:
- Calculate minutes between times
- Calculate daily totals
- Calculate monthly balance
- Apply employee-specific requirements

**Responsibilities**:
- Convert time to minutes
- Sum daily attendance
- Calculate vs. required hours
- Apply fixed 45-minute tolerance
- Determine monthly balance (positive/negative)

**Interactions**:
- ↔️ Attendance Routes: Calculate display totals
- ↔️ API Routes: Provide calculation data

---

## Middleware Modules

### 11. Authentication Middleware (`middleware/auth.js`)

**Purpose**: Enforce authentication and authorization.

**Key Functions**:
- `requireAuth(req, res, next)` - Enforce authentication
- `requireAdmin(req, res, next)` - Enforce admin role
- `requireEmployee(req, res, next)` - Enforce employee role

**Responsibilities**:
- Check session.user existence
- Verify user role
- Redirect unauthenticated requests to login
- Return 401 for API requests

**Interactions**:
- ↔️ All Route Modules: Applied as middleware
- ← Session Data: Read from req.session.user

**Usage**:
```javascript
app.use('/admin', requireAuth, requireAdmin);
app.get('/attendance', requireAuth, (req, res) => {...});
```

---

## Database Module

### 12. Database Layer (`db/index.js`)

**Purpose**: Abstract all database operations.

**Key Functions**:
- `getPool()` - Get/create connection pool
- `query(text, params)` - Execute parameterized query

**Responsibilities**:
- Manage MSSQL connection pool
- Handle SQL Server/Azure SQL connections
- Support multiple auth types (SQL, Azure AD)
- Execute parameterized queries (prevent SQL injection)

**Interactions**:
- ← All Service/Route Modules: Called for data access
- → MSSQL Library: Execute queries

**Configuration**:
- Supports SQL authentication (user/password)
- Supports Azure Active Directory Default authentication
- Connection pooling for performance
- Encryption and certificate options

---

## Module Interaction Map

```
┌─────────────────────────────────────────────────────────┐
│                 User Interface (EJS)                     │
└──────────┬──────────────────────────────────┬────────────┘
           │                                  │
      ┌────▼──────────┐            ┌─────────▼─────────┐
      │  HTML Routes  │            │   API Routes      │
      │               │            │                   │
      │ - auth        │            │ - /api/attendance │
      │ - admin       │            │ - /api/audit      │
      │ - attendance  │            └────────┬──────────┘
      │ - import      │                     │
      │ - holidays    │                     │
      │ - download    │                     │
      └────┬──────────┘                     │
           │                                │
           └────────────┬────────────────────┘
                        │
        ┌───────────────▼────────────────┐
        │   Auth Middleware              │
        │  (requireAuth, requireAdmin)    │
        └───────────────┬────────────────┘
                        │
    ┌───────────────────┼───────────────────┐
    │                   │                   │
┌───▼────────┐   ┌─────▼──────┐   ┌──────▼──────┐
│  Services  │   │  Bootstrap │   │  Time       │
│            │   │            │   │             │
│- Bootstrap │   │ Initialize │   │ - Calculate │
│- Parser    │   │ default    │   │ - Totals    │
│- Time      │   │ admin      │   │ - Balance   │
└───┬────────┘   └─────┬──────┘   └──────┬──────┘
    │                  │                 │
    └──────────────────┼─────────────────┘
                       │
                ┌──────▼──────────┐
                │  Database Layer │
                │  (MSSQL/Azure)  │
                │  - Connection   │
                │  - Query        │
                │  - Pool         │
                └─────────────────┘
```

---

## Data Flow Examples

### Example 1: User Login Flow

```
1. User → Login Form (GET /login)
2. User → POST /auth/login with credentials
3. authRoutes → Validate in database
4. authRoutes → Compare password (bcryptjs)
5. authRoutes → Create session (req.session.user)
6. authRoutes → Redirect to /
7. App → Middleware sets res.locals.user
8. App → Routes check requireAuth
9. User → Dashboard rendered
```

### Example 2: Attendance View Flow

```
1. User → GET /attendance?month=2026-02
2. attendanceRoutes → requireAuth middleware
3. attendanceRoutes → Get current user from session
4. attendanceRoutes → Query attendance records for month
5. attendanceRoutes → Query holidays
6. timeService → Calculate totals and balance
7. attendanceRoutes → Render EJS template
8. EJS → Format dates and display calendar
9. User → Sees monthly attendance grid
```

### Example 3: Excel Import Flow

```
1. User → POST /import with Excel file
2. importRoutes → requireAdmin middleware
3. Multer → Save file to /uploads
4. excelParser → Read XLSX file
5. excelParser → Extract from "Registros de asistencia" sheet
6. excelParser → Apply slot matching algorithm
7. Database → Insert attendance records
8. Database → Mark previous import inactive
9. Database → Create audit log entry
10. User → Redirected to attendance view
```

---

**See Also**:
- [Architecture Overview](./ARCHITECTURE.md) for system design
- [Module Interaction Diagrams](./MODULES_DIAGRAM.md) for visual representations
- [Concerns & Implementation](./CONCERNS.md) for implementation details
