# Architecture Overview

## System Architecture

The **Procesarhorasmesblackcrow** application follows a **layered MVC architecture** with separation of concerns between presentation, business logic, and data access layers.

```
┌─────────────────────────────────────────────────┐
│         Presentation Layer (EJS Views)          │
│  - Dashboard, Login, Attendance, Admin UI       │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│         Express.js Application Server            │
│  - Routing, Middleware, Session Management      │
└──────────────────┬──────────────────────────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
┌────▼──────┐ ┌───▼────────┐ ┌──▼──────────┐
│  Routes   │ │ Middleware │ │  Services   │
│           │ │            │ │             │
│ - Auth    │ │ - Auth     │ │ - Bootstrap │
│ - Admin   │ │ - Error    │ │ - Excel     │
│ - API     │ │            │ │ - Time      │
│ - Import  │ │            │ │             │
└────┬──────┘ └────────────┘ └──┬──────────┘
     │                          │
     └──────────────┬───────────┘
                    │
        ┌───────────▼────────────┐
        │   Database Layer       │
        │  (MSSQL / Azure SQL)   │
        │  - Connection Pool     │
        │  - Query Execution     │
        │  - Transactions        │
        └────────────────────────┘
```

## Architectural Layers

### 1. **Presentation Layer** (`/views`)
- EJS templates for server-side rendering
- Static assets (CSS, images) in `/public`
- Direct communication with Express.js routes
- Form-based data submission and rendering

### 2. **Application/Routing Layer** (`/src/routes`)
- Express route handlers
- Request validation
- Response formatting (HTML/JSON)
- Session-based request routing

### 3. **Middleware Layer** (`/src/middleware`)
- Authentication enforcement
- Error handling
- Request/response processing
- Session management

### 4. **Business Logic Layer** (`/src/services`)
- Core business logic
- Excel file processing
- Time calculations
- Bootstrap/initialization routines

### 5. **Data Access Layer** (`/src/db`)
- SQL query execution
- Connection pool management
- Transaction handling
- Database-specific logic

## Request Flow

```
1. User Request (HTTP)
     │
2. Express Middleware Chain
     ├─ Body Parser
     ├─ Session Middleware
     ├─ Authentication Middleware (if required)
     │
3. Route Handler
     ├─ Validate Input
     ├─ Call Service Layer
     │
4. Service Layer
     ├─ Business Logic
     ├─ Call Database Layer
     │
5. Database Layer
     ├─ Execute Query
     ├─ Return Results
     │
6. Response Handler
     ├─ Format Response (HTML/JSON)
     ├─ Set Session Data
     │
7. Response to Client
```

## Data Flow

### Attendance Data Flow (Import)

```
Excel File Upload
    │
    ▼
Multer (File Upload Handler)
    │
    ▼
excelParser Service
    ├─ Parse XLSX
    ├─ Extract attendance records
    ├─ Apply slot matching algorithm
    │
    ▼
Database Layer
    ├─ Insert/Update Attendance Records
    ├─ Store Import History
    └─ Audit Changes
```

### Read Request Flow

```
User Request (Dashboard/Attendance View)
    │
    ▼
attendanceRoutes Handler
    │
    ├─ Fetch Attendance Records
    ├─ Fetch Holiday Information
    ├─ Calculate Totals (via time service)
    │
    ▼
EJS Template Rendering
    │
    ├─ Populate Monthly Calendar
    ├─ Display Slots & Hours
    ├─ Show Totals
    │
    ▼
HTML Response
```

## Key Components

### Routes (Request Entry Points)
- **authRoutes.js**: Login, logout, session management
- **adminRoutes.js**: User management, admin dashboard
- **attendanceRoutes.js**: Attendance viewing and editing
- **importRoutes.js**: Excel file import
- **holidaysRoutes.js**: Holiday management
- **downloadRoutes.js**: File download functionality
- **apiRoutes.js**: JSON API endpoints (for integrations)

### Services (Business Logic)
- **bootstrap.js**: Initialize default admin user and system data
- **excelParser.js**: Parse XLSX files, apply slot matching algorithm
- **time.js**: Calculate time differences, monthly totals, balances

### Middleware
- **auth.js**: Enforce authentication, check session, role-based access control

### Database Layer
- **index.js**: Connection pool, query execution, transaction handling

## Authentication Flow

```
1. User submits login form
     │
2. POST /auth/login
     ├─ Validate credentials
     ├─ Query user from database
     ├─ Compare password with bcryptjs
     │
3. If valid:
     ├─ Create session
     ├─ Store user in session.user
     ├─ Redirect to dashboard
     │
4. Middleware checks req.session.user on protected routes
     ├─ If exists: proceed
     ├─ If missing: redirect to login
```

## Session Management

- **Engine**: Express Session (in-memory by default)
- **Storage**: Server-side session store
- **Cookie**: Secure session ID in cookies
- **Duration**: Session persists across requests until logout
- **User Object**: Stored in `req.session.user` with structure:
  ```javascript
  {
    id: number,
    username: string,
    role: 'admin' | 'employee',
    employeeId: number (if employee)
  }
  ```

## Error Handling

- **Route Level**: Try-catch with asyncHandler wrapper
- **Middleware Level**: Express error handler middleware
- **Response Types**:
  - HTML pages for server-rendered views
  - JSON error responses for API endpoints
- **Logging**: Console output with stack traces

## Separation of Concerns

| Concern | Location | Responsibility |
|---------|----------|-----------------|
| View Rendering | `/views/*.ejs` | Present data to users |
| Request Routing | `/src/routes/*.js` | Handle HTTP requests |
| Business Logic | `/src/services/*.js` | Calculate, process, validate |
| Database Access | `/src/db/index.js` | Query execution |
| Security | `/src/middleware/auth.js` | Authenticate, authorize |
| Configuration | `/src/config/env.js` | Environment settings |

## Design Patterns Used

### 1. **Middleware Pattern**
Used by Express.js for request processing chain.

### 2. **Service Layer Pattern**
Encapsulates business logic in dedicated service modules.

### 3. **Repository Pattern** (Implicit)
Database layer abstracts SQL queries and connection management.

### 4. **Factory Pattern**
Connection pool creation in database layer.

### 5. **Template Pattern**
EJS templates extend/include common layouts.

## Scalability Considerations

1. **Session Storage**: In-memory session (development). For production, consider external store (Redis)
2. **Database Connection**: Connection pooling via MSSQL library
3. **File Processing**: Excel parsing is synchronous; consider async for large files
4. **API Endpoints**: RESTful JSON endpoints enable alternative frontends (React, mobile)

## Security Architecture

1. **Authentication**: Username/password with bcryptjs hashing
2. **Authorization**: Role-based access control (admin/employee)
3. **Session**: Secure session cookies
4. **Input Validation**: Server-side validation of all inputs
5. **SQL Injection Prevention**: Parameterized queries via mssql library
6. **Password Requirements**: Enforced complexity during user creation

---

**See Also**:
- [Modules & Interactions](./MODULES.md) for detailed module documentation
- [Concerns & Implementation](./CONCERNS.md) for implementation details
