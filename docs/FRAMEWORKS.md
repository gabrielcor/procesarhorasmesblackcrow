# Frameworks & Technologies

Comprehensive reference of all frameworks, libraries, and technologies used in the Procesarhorasmesblackcrow application.

## Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Backend Runtime** | Node.js | 20+ | Server runtime environment |
| **Web Framework** | Express.js | 4.19.2 | HTTP server, routing, middleware |
| **View Engine** | EJS | 3.1.10 | Server-side HTML templating |
| **Database** | MSSQL/Azure SQL | 11.0.1 driver | Data persistence |
| **Session Management** | express-session | 1.18.0 | User session handling |
| **Authentication** | bcryptjs | 2.4.3 | Password hashing |
| **File Upload** | Multer | 1.4.5 | Multipart form handling |
| **Excel Processing** | XLSX | 0.18.5 | Excel file parsing |
| **Date/Time** | dayjs | 1.11.13 | Date manipulation |
| **Environment** | dotenv | 16.4.5 | Configuration management |

---

## 1. Express.js - Web Framework

### Purpose
Core web framework providing routing, middleware, HTTP handling, and request/response processing.

### Version
`^4.19.2`

### Key Features Used

#### Routing
- Route handlers for HTTP methods (GET, POST, etc.)
- Route parameters (`:id`, `:month`)
- Query string parsing
- Route-level middleware

```javascript
// Example routes in the app
app.get('/login', (req, res) => {...});
app.post('/auth/login', (req, res) => {...});
app.get('/attendance', requireAuth, (req, res) => {...});
```

#### Middleware
- Request processing pipeline
- Built-in middleware:
  - `express.urlencoded()` - Parse form data
  - `express.static()` - Serve static files
- Third-party middleware:
  - `express-session` - Session management

#### View Engine Integration
- Set view engine to EJS
- Render templates with data

```javascript
app.set('view engine', 'ejs');
res.render('attendance', { data: {...} });
```

#### Error Handling
- Error handler middleware for centralized error handling
- Distinction between API (JSON) and HTML error responses

#### Session Integration
```javascript
app.use(session({
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false
}));
```

### Files Using Express
- `src/app.js` - Main app setup
- All route files in `src/routes/`

---

## 2. EJS - Server-Side Template Engine

### Purpose
Render dynamic HTML templates server-side, embedding JavaScript logic in HTML.

### Version
`^3.1.10`

### Template Features

#### File Organization
- Templates in `/views` directory
- Partials in `/views/partials` for reusable components

#### Key Templates
- `login.ejs` - Login form
- `dashboard.ejs` - Main dashboard
- `attendance.ejs` - Attendance calendar
- `upload.ejs` - File upload form
- `users.ejs` - User management
- `holidays.ejs` - Holiday management
- `partials/header.ejs` - Page header
- `partials/footer.ejs` - Page footer

#### EJS Syntax

**Tags**:
- `<%= ... %>` - Output (escaped)
- `<%- ... %>` - Output (unescaped/raw HTML)
- `<% ... %>` - Execute code (no output)

**Includes**:
```ejs
<%- include('partials/header') %>
<%- include('partials/footer') %>
```

**Loops**:
```ejs
<% attendance.forEach(slot => { %>
  <div><%= slot.time %></div>
<% }); %>
```

**Conditionals**:
```ejs
<% if (user.role === 'admin') { %>
  <button>Admin Action</button>
<% } %>
```

#### Passed Data (res.locals)
Routes pass data via `res.render(template, data)`:

```javascript
res.render('attendance', {
  user: req.session.user,
  attendance: attendanceData,
  formatDate: dateFormatter,
  totals: calculatedTotals
});
```

#### Available in All Templates
Set by middleware in `app.js`:
```javascript
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.formatDate = (value) => {...};
  next();
});
```

### Files Using EJS
- All `.ejs` files in `/views`
- Configured in `src/app.js`

---

## 3. MSSQL / Azure SQL - Database

### Purpose
Persistent data storage for users, employees, attendance records, holidays, and audit logs.

### Driver Version
`^11.0.1` (mssql npm package)

### Database Features

#### Supported Database Engines
- SQL Server (local development)
- Azure SQL (production)

#### Authentication Methods
1. **SQL Authentication** (user/password)
   ```javascript
   {
     user: 'sa',
     password: '...',
     server: 'localhost'
   }
   ```

2. **Azure Active Directory** (Azure AD)
   ```javascript
   {
     authentication: {
       type: 'azure-active-directory-default'
     },
     server: 'myserver.database.windows.net'
   }
   ```

#### Connection Management
- Connection pooling for efficiency
- Single pool per application lifetime
- Reused across requests

#### Query Execution
- Parameterized queries prevent SQL injection
- Supports named parameters

```javascript
const result = await query('SELECT * FROM Users WHERE Id = @id', { id: 123 });
```

#### Data Operations
- CRUD operations (Create, Read, Update, Delete)
- Transactions for multi-step operations
- Audit logging of changes

### Configuration
- Configured in `src/config/env.js`
- Connection options:
  - `encrypt` - Enable connection encryption
  - `trustServerCertificate` - For self-signed certs

### Schema
- Defined in `sql/001_schema.sql`
- Tables: Users, Employees, Attendance, Holidays, AuditLogs, ImportHistory

---

## 4. express-session - Session Management

### Purpose
Manage user sessions across HTTP requests (stateless protocol made stateful).

### Version
`^1.18.0`

### Configuration

```javascript
app.use(session({
  secret: env.sessionSecret,    // Signing secret
  resave: false,                 // Only save if modified
  saveUninitialized: false       // Only create if necessary
}));
```

### Session Storage
- **Default**: Memory store (development)
- **Production**: Consider Redis, database, or other stores

### User Data Storage

```javascript
// After successful login
req.session.user = {
  id: userRecord.id,
  username: userRecord.username,
  role: 'admin' or 'employee',
  employeeId: userRecord.employeeId
};
```

### Session Lifecycle
1. User logs in → Session created
2. Session ID stored in secure cookie
3. Browser sends cookie with each request
4. Express-session retrieves session data
5. User logs out → Session destroyed

### Middleware Integration
```javascript
// Available in all routes and templates
req.session         // Access session data
req.session.user    // Current user
res.locals.user     // In templates (set by middleware)
```

### Files Using express-session
- `src/app.js` - Setup
- `src/routes/authRoutes.js` - Login/logout
- `src/middleware/auth.js` - Check session

---

## 5. bcryptjs - Password Hashing

### Purpose
Securely hash and verify passwords, preventing plaintext storage.

### Version
`^2.4.3`

### Features

#### Password Hashing
```javascript
const hashedPassword = await bcryptjs.hash(plainPassword, 10);
// 10 = cost factor (rounds of hashing)
```

#### Password Verification
```javascript
const isMatch = await bcryptjs.compare(plainPassword, hashedPassword);
```

### Usage in Application
- Passwords hashed before database storage
- Verification during login
- Default admin password hashed on bootstrap

### Security Benefits
- **Salting**: Unique salt per password
- **Cost Factor**: Computational intensity configurable
- **One-way**: Cannot reverse-engineer password from hash

### Files Using bcryptjs
- `src/routes/authRoutes.js` - Login verification
- `src/services/bootstrap.js` - Admin password setup
- `src/routes/adminRoutes.js` - User creation/update

---

## 6. Multer - File Upload Handling

### Purpose
Parse multipart form data and handle file uploads.

### Version
`^1.4.5-lts.1`

### Configuration in importRoutes.js

```javascript
const upload = multer({ dest: './uploads' });
app.post('/import', upload.single('file'), (req, res) => {
  // req.file contains uploaded file info
  // req.file.path = file location
  // req.file.mimetype = file MIME type
});
```

### File Properties
- `filename` - Original uploaded filename
- `path` - Local file path after upload
- `mimetype` - Content type
- `size` - File size in bytes

### Usage Flow
1. HTML form with `enctype="multipart/form-data"`
2. File selected and submitted
3. Multer processes multipart data
4. File saved to `/uploads` directory
5. Route handler receives file path
6. Excel parser processes the file

### Files Using Multer
- `src/routes/importRoutes.js` - File upload

---

## 7. XLSX - Excel Processing

### Purpose
Parse Excel (.xlsx) files and extract attendance data.

### Version
`^0.18.5`

### Features

#### Reading Workbooks
```javascript
const workbook = xlsx.readFile(filePath);
const sheet = workbook.Sheets['Registros de asistencia'];
```

#### Converting Sheet to JSON
```javascript
const data = xlsx.utils.sheet_to_json(sheet);
// Returns array of objects based on first row headers
```

#### Sheet Navigation
```javascript
const sheetNames = workbook.SheetNames;
const firstSheet = workbook.Sheets[sheetNames[0]];
```

### Application Usage
- Expected sheet name: "Registros de asistencia"
- Extracts employee data and time records
- Converts time values to standardized format

### Error Handling
- Validates file format
- Checks for required sheet
- Validates date/time format

### Files Using XLSX
- `src/services/excelParser.js` - Excel parsing

---

## 8. dayjs - Date/Time Manipulation

### Purpose
Parse, format, and manipulate dates with a lightweight library.

### Version
`^1.11.13`

### Features Used

#### Date Parsing
```javascript
const date = dayjs('2026-02-15');
```

#### Date Formatting
```javascript
dayjs(dateValue).format('DD-MM-YYYY')  // "15-02-2026"
dayjs(dateValue).format('YYYY-MM-DD')  // "2026-02-15"
```

#### Date Arithmetic
```javascript
dayjs().add(1, 'month')   // Add 1 month
dayjs().subtract(1, 'day') // Subtract 1 day
```

#### Validation
```javascript
const isValid = dayjs(value).isValid();
```

#### Time Extraction
```javascript
const day = dayjs(dateValue).format('DD');
const month = dayjs(dateValue).format('MM');
const dayOfWeek = dayjs(dateValue).format('dddd');
```

### Application Usage
- Date formatting in templates via `formatDate` function
- Time calculations in timeService
- Date validation during import

### Files Using dayjs
- `src/app.js` - Template helper function
- `src/services/time.js` - Time calculations
- `src/services/excelParser.js` - Date parsing

---

## 9. dotenv - Environment Configuration

### Purpose
Load environment variables from `.env` file into `process.env`.

### Version
`^16.4.5`

### Configuration

```javascript
// src/config/env.js
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
```

### Environment Variables

#### Database Configuration
- `SQL_SERVER` - Database server address
- `SQL_DATABASE` - Database name
- `SQL_USER` - Database username
- `SQL_PASSWORD` - Database password
- `SQL_ENCRYPT` - Enable encryption (true/false)
- `SQL_TRUST_CERT` - Trust self-signed certs (true/false)
- `SQL_CONNECTION_STRING` - Full connection string (alternative)
- `SQL_AUTHENTICATION` - Auth method override

#### Application Configuration
- `PORT` - Server port (default: 3000)
- `SESSION_SECRET` - Session cookie secret
- `ADMIN_DEFAULT_PASSWORD` - Initial admin password (optional)

### Best Practices
- Never commit `.env` file to version control
- Create `.env.example` template for documentation
- Use strong `SESSION_SECRET` in production
- Store sensitive data only in environment

### Files Using dotenv
- `src/config/env.js` - Configuration module

---

## 10. Built-in Node.js Modules

### fs (File System)
- Create directories
- Read/write files
- Check file existence

```javascript
const fs = require('fs');
fs.mkdirSync(uploadsDir, { recursive: true });
```

### path
- Resolve file paths
- Join path components
- Platform-independent paths

```javascript
const path = require('path');
path.resolve(process.cwd(), 'views')
```

### Used in
- `src/app.js` - Directory creation
- `src/routes/downloadRoutes.js` - File streaming
- All config files

---

## Summary of Technology Integration

```
┌─────────────────────────────────────────────────────┐
│         Express.js (HTTP Framework)                 │
│  - Routes, Middleware, Error handling               │
└──────────────────┬──────────────────────────────────┘
                   │
       ┌───────────┼───────────┐
       │           │           │
   ┌───▼──────┐ ┌──▼──────┐ ┌─▼─────────┐
   │  EJS     │ │ Multer  │ │ express-  │
   │Templates │ │(Upload) │ │ session   │
   │          │ │         │ │(Sessions) │
   └──────────┘ └────┬────┘ └───────────┘
                     │
                  ┌──▼──────────┐
                  │   XLSX      │
                  │(Excel parse)│
                  └─────┬───────┘
                        │
    ┌───────────┬───────┼────────┬──────────┐
    │           │       │        │          │
┌───▼──┐  ┌────▼──┐ ┌──▼──┐ ┌──▼──┐  ┌───▼───┐
│ bcry-│  │dotenv │ │dayjs│ │fs/  │  │MSSQL  │
│ptjs  │  │(Env)  │ │(Date│ │path │  │(DB)   │
│(Auth)│  │       │ │)    │ │     │  │       │
└──────┘  └───────┘ └─────┘ └─────┘  └───────┘
```

---

**See Also**:
- [Architecture Overview](./ARCHITECTURE.md) for system design
- [Modules & Interactions](./MODULES.md) for implementation details
- [Concerns & Implementation](./CONCERNS.md) for usage patterns
