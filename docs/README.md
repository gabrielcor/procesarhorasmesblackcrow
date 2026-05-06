# Procesarhorasmesblackcrow - Documentation

Welcome to the in-depth documentation for the **Procesarhorasmesblackcrow** attendance management system. This folder contains comprehensive guides covering the application's architecture, modules, frameworks, and implementation details.

## Documentation Index

### 📐 [Architecture Overview](./ARCHITECTURE.md)
High-level architectural design, layering, request flow, data flow, and system components. Start here to understand how the application is structured.

### 🔧 [Modules & Interactions](./MODULES.md)
Detailed documentation of each module in the system:
- Authentication & Authorization
- Database Layer
- Attendance Management
- Import & Excel Processing
- Holiday Management
- User Management
- Download & Export
- API Endpoints

### 📊 [Module Interaction Diagrams](./MODULES_DIAGRAM.md)
Visual representations of module interactions using diagrams showing how different components communicate and collaborate.

### 🛠️ [Frameworks & Technologies](./FRAMEWORKS.md)
Complete reference of all frameworks and libraries used in the project:
- Backend Framework (Express.js)
- View Engine (EJS)
- Database (MSSQL / Azure SQL)
- Session Management
- File Upload & Processing
- Utilities

### 🎯 [Concerns & Implementation](./CONCERNS.md)
Detailed breakdown of different application concerns:
- **Frontend (Views)**: EJS templates, rendering, forms
- **APIs**: RESTful endpoints, request/response handling
- **Database Layer**: Connection management, queries, transactions
- **Authentication**: Session-based auth, middleware enforcement
- **File Processing**: Excel import, parsing logic
- **Business Logic**: Attendance calculations, slot matching

### 🚀 [Deployment Guide](./DEPLOYMENT.md)
Instructions for deploying the application to:
- Local development environment
- Azure App Service with Azure SQL
- Docker deployment (production ready)

## Quick Start for Developers

1. **New to the project?** → Start with [Architecture Overview](./ARCHITECTURE.md)
2. **Looking for a specific module?** → Check [Modules & Interactions](./MODULES.md)
3. **Understanding how things work?** → See [Concerns & Implementation](./CONCERNS.md)
4. **Need to deploy?** → Follow [Deployment Guide](./DEPLOYMENT.md)
5. **Visual learner?** → Browse [Module Interaction Diagrams](./MODULES_DIAGRAM.md)

## Project Overview

**Procesarhorasmesblackcrow** is a comprehensive web application for:
- ✅ Importing monthly attendance sheets (Excel files)
- ✅ Managing employee attendance records
- ✅ Calculating monthly hour balances and overtime
- ✅ Auditing changes to attendance records
- ✅ Handling holidays and special dates

## Key Technologies

- **Backend**: Node.js + Express.js
- **Frontend**: EJS (Embedded JavaScript Templates)
- **Database**: SQL Server / Azure SQL
- **File Processing**: XLSX (Excel)
- **Authentication**: Express Session + bcryptjs
- **Deployment**: Azure App Service

## Contributing

When modifying the application:
1. Review the relevant documentation section
2. Ensure changes follow the established patterns
3. Update this documentation if adding new modules or concerns
4. Test thoroughly before deployment

---

**Last Updated**: May 2026
