# Module Interaction Diagrams

Visual representations of how different modules interact and communicate in the Procesarhorasmesblackcrow application.

## 1. High-Level System Diagram

```
┌─────────────────────────────────────────────────────┐
│              Client Requests (HTTP)                 │
│        Browser / API Consumer / Mobile              │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │  Express.js Server      │
        │  ├─ Routing             │
        │  ├─ Middleware          │
        │  └─ Session Mgmt        │
        └────────────┬────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼──────┐  ┌─────▼──────┐  ┌───┬──▼────┐
│ EJS      │  │ Static     │  │ JS│ API   │
│Templates │  │ Assets     │  │Lib│Routes │
│(HTML)    │  │(CSS/Img)   │  │   │(JSON) │
└──────────┘  └────────────┘  └───┴──────┘
                      │
                      └─ Served to Client

        ┌────────────────────────────┐
        │  Express Routes            │
        │  ├─ authRoutes             │
        │  ├─ adminRoutes            │
        │  ├─ attendanceRoutes       │
        │  ├─ importRoutes           │
        │  ├─ holidaysRoutes         │
        │  ├─ downloadRoutes         │
        │  └─ apiRoutes              │
        └────────────┬───────────────┘
                     │
        ┌────────────▼───────────────┐
        │  Middleware Chain          │
        │  ├─ Body Parser            │
        │  ├─ Session                │
        │  ├─ Auth Check             │
        │  └─ Error Handler          │
        └────────────┬───────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼──────┐  ┌─────▼──────┐  ┌─────▼─────┐
│Services  │  │ Bootstrap  │  │ Middleware│
│- Parser  │  │ - Init     │  │ - Auth    │
│- Time    │  │ - Admin    │  │ - Enforce │
└──────────┘  └────────────┘  └───────────┘
                     │
        ┌────────────▼───────────────┐
        │  Database Layer            │
        │  ├─ Connection Pool        │
        │  ├─ Query Execution        │
        │  └─ Error Handling         │
        └────────────┬───────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
│SQL Server│  │ Azure SQL  │  │  File      │
│Local Dev │  │ Production │  │  System    │
└──────────┘  └────────────┘  └────────────┘
```

## 2. Route Module Interaction Diagram

```
┌──────────────────────────────────────────────┐
│         Request Entry Points (Routes)        │
└──────────────────────────────────────────────┘

┌─────────────────┐
│  authRoutes     │  ←→ Session Management
│                 │  ←→ User Authentication
│ GET  /login     │  ←→ DB: User queries
│ POST /login     │  ←→ bcryptjs: Password verify
│ GET  /logout    │
└────────┬────────┘
         │
         │ requireAuth middleware

┌────────────────────────────┐
│    adminRoutes             │  ←→ Admin Panel
│                            │  ←→ User/Employee CRUD
│ GET  /admin                │  ←→ DB: User/Employee ops
│ GET  /admin/users          │  ←→ requireAdmin check
│ POST /admin/users          │
│ POST /admin/employees      │
└────────┬───────────────────┘
         │
         │ requireAuth, requireAdmin

┌────────────────────────────┐
│  attendanceRoutes          │  ←→ Attendance Views
│                            │  ←→ Edit Slots
│ GET  /attendance           │  ←→ DB: Attendance query
│ POST /attendance/slot/edit │  ←→ timeService: Calc
│ GET  /api/audit/slots      │
└────────┬───────────────────┘
         │
         │ requireAuth

┌────────────────────────────┐
│   importRoutes             │  ←→ File Upload
│                            │  ←→ Excel Processing
│ GET  /import               │  ←→ Multer: File save
│ POST /import               │  ←→ excelParser: Parse
│                            │  ←→ DB: Store records
└────────┬───────────────────┘
         │
         │ requireAuth, requireAdmin

┌────────────────────────────┐
│  holidaysRoutes            │  ←→ Holiday Management
│                            │  ←→ Special Dates
│ GET  /admin/holidays       │  ←→ DB: Holiday ops
│ POST /admin/holidays/add   │
└────────┬───────────────────┘
         │
         │ requireAuth, requireAdmin

┌────────────────────────────┐
│  downloadRoutes            │  ←→ File Download
│                            │  ←→ Retrieve Uploads
│ GET  /download/attendance  │  ←→ DB: File paths
│                            │  ←→ File System: Read
└────────┬───────────────────┘
         │
         │ requireAuth

┌────────────────────────────┐
│   apiRoutes                │  ←→ JSON Responses
│                            │  ←→ API Integration
│ GET  /api/attendance/...   │  ←→ DB: Data query
│ GET  /api/audit/slots      │  ←→ timeService: Calc
└────────┬───────────────────┘
         │
         │ All routes converge to:
         │ - Database queries
         │ - Service calculations
         │ - Response formatting
```

## 3. Service Layer Interaction Diagram

```
┌─────────────────────────────────────────────┐
│         Service Layer (Business Logic)      │
└─────────────────────────────────────────────┘

      Routes call Services

         │
    ┌────┴─────┐
    │           │
    │           │

┌───▼──────────────┐
│ excelParser.js   │  ─┐
│                  │   ├─ File Upload Processing
│ parseExcel()     │ ──┤
│ slotMatching()   │   └─ Input: File path
│                  │   └─ Output: Parsed records
│ validateSlots()  │
└────────┬─────────┘
         │
         │ Returns parsed
         │ attendance records
         │
         ▼
    ┌─────────────────┐
    │ Database Layer  │
    │ (Insert/Update) │
    └─────────────────┘

    ┌──────────────────────┐
    │ timeService.js       │  ─┐
    │                      │   ├─ Time Calculations
    │ calculateMinutes()   │ ──┤
    │ calculateDayTotal()  │   └─ Input: Attendance records
    │ calculateBalance()   │   └─ Output: Totals, balance
    │ applyTolerance()     │
    └────────┬─────────────┘
             │
             │ Returns calculated
             │ time metrics
             │
             ▼
         ┌────────────────┐
         │ EJS Rendering  │
         │ or JSON resp   │
         └────────────────┘

┌─────────────────────────┐
│ bootstrap.js            │  ─┐
│                         │   ├─ Initialization
│ bootstrapData()         │ ──┤
│ createDefaultAdmin()    │   └─ Run at startup
│                         │   └─ One-time setup
└────────┬────────────────┘
         │
         │ Initializes
         │ system state
         │
         ▼
    ┌─────────────────┐
    │ Database Layer  │
    │ (Create)        │
    └─────────────────┘
```

## 4. Authentication & Authorization Flow

```
Request arrives at route

         │
         ▼
    ┌──────────────────────┐
    │ requireAuth          │  → Check session exists
    │ middleware           │  → Check req.session.user
    └──────────┬───────────┘
               │
         ┌─────┴──────┐
         │            │
    (auth)        (no auth)
         │            │
         │        ┌───▼────────┐
         │        │  Redirect  │
         │        │ to /login  │
         │        └────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ requireAdmin middleware    │  → Check role
    │ (if needed)                │  → Check role === 'admin'
    └──────────┬─────────────────┘
               │
         ┌─────┴─────┐
         │           │
      (admin)    (not admin)
         │           │
         │       ┌───▼──────┐
         │       │ 403      │
         │       │ Forbidden│
         │       └──────────┘
         │
         ▼
    ┌──────────────────────┐
    │ Route Handler        │
    │ Process request      │
    │ Access session data  │
    └──────────────────────┘
```

## 5. Data Processing Pipeline (Import)

```
Client Upload

     │
     ▼ (POST /import)
  
┌──────────────────┐
│ importRoutes     │
│ handler          │
└────────┬─────────┘
         │
         ▼
┌──────────────────────┐
│ Multer Middleware    │  ← File upload handling
│ Save to /uploads     │
└────────┬─────────────┘
         │
         ▼
    ┌─────────────────────────────┐
    │ excelParser.parseExcel()    │
    │                             │
    │ 1. Read XLSX file           │
    │ 2. Extract from sheet       │
    │ 3. For each day:            │
    │    - Collect times          │
    │    - Sort chronologically   │
    │    - Pair entry/exit        │
    │    - Classify unpaired      │
    │ 4. Validate data            │
    └────────┬────────────────────┘
             │
             ▼ Parsed records
    ┌─────────────────────────────┐
    │ Database Layer              │
    │                             │
    │ 1. Start transaction        │
    │ 2. Mark prev import         │
    │    inactive                 │
    │ 3. Insert new records       │
    │ 4. Create audit log         │
    │ 5. Commit transaction       │
    └────────┬────────────────────┘
             │
             ▼
      ┌──────────────┐
      │ Success      │
      │ message to   │
      │ client       │
      └──────────────┘
```

## 6. View Rendering & Data Display

```
┌────────────────┐
│ Client Request │
│ GET /attendance│
└────────┬───────┘
         │
         ▼
┌─────────────────────────────┐
│ attendanceRoutes Handler    │
│                             │
│ 1. Get user from session    │
│ 2. Query attendance DB      │
│ 3. Query holidays DB        │
│ 4. Call timeService         │
│    - Calculate totals       │
│    - Calculate balance      │
└────────┬────────────────────┘
         │
         ▼ Data object
    ┌─────────────────────────────┐
    │ EJS Template                │
    │ (attendance.ejs)            │
    │                             │
    │ res.locals variables:       │
    │ - user (session data)       │
    │ - attendanceData            │
    │ - monthlyTotals             │
    │ - holidays                  │
    │ - formatDate (function)     │
    └────────┬────────────────────┘
             │
             ▼ Renders
    ┌─────────────────────────────┐
    │ HTML Output                 │
    │                             │
    │ - Calendar grid             │
    │ - Slot display              │
    │ - Totals row                │
    │ - Edit buttons              │
    └────────┬────────────────────┘
             │
             ▼
      ┌──────────────┐
      │ HTTP 200     │
      │ HTML body    │
      └──────────────┘
```

## 7. Session & User Context Flow

```
┌─────────────────────────────┐
│ User Logs In                │
│ POST /auth/login            │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Verify Credentials          │
│ Query DB for user           │
│ Compare password (bcryptjs) │
└────────┬────────────────────┘
         │
    ┌────┴─────┐
    │           │
(valid)    (invalid)
    │           │
    │       └─► Render login
    │           with error
    │
    ▼
┌─────────────────────────────┐
│ Create Session              │
│ req.session.user = {        │
│   id: ...,                  │
│   username: ...,            │
│   role: 'admin'/'employee', │
│   employeeId: ...           │
│ }                           │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Store in Session Store      │
│ (memory by default)         │
│ Set session cookie          │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Redirect to /               │
│ Dashboard                   │
└─────────────────────────────┘

Subsequent Requests:

┌──────────────────────────────┐
│ Client sends request with    │
│ session cookie               │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Express Session Middleware   │
│ Loads session from store     │
│ req.session.user available   │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Middleware sets res.locals   │
│ res.locals.user = session.user
│ Available in templates       │
└──────────────────────────────┘
```

## 8. Error Handling Flow

```
Request processed

     │
     ▼
Exception/Error thrown

     │
     ▼
┌──────────────────────────┐
│ Try-catch in routes      │
└────────┬─────────────────┘
         │
    ┌────┴────┐
    │          │
(caught)  (uncaught)
    │          │
    │          └─► Express error
    │              middleware
    │
    ▼
┌────────────────────────────┐
│ Check request type         │
└────────┬───────────────────┘
         │
    ┌────┴─────────┐
    │              │
(API)          (HTML)
    │              │
    │              ▼
    │         ┌──────────┐
    │         │ Error    │
    │         │ HTML     │
    │         │ page     │
    │         └──────────┘
    │
    ▼
┌──────────────────────────┐
│ JSON Error Response      │
│ { error: message }       │
│ HTTP 500                 │
└──────────────────────────┘
```

---

**See Also**:
- [Architecture Overview](./ARCHITECTURE.md) for system design
- [Modules & Interactions](./MODULES.md) for detailed module documentation
