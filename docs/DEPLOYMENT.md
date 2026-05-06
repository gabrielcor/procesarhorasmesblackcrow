# Deployment Guide

Complete instructions for deploying the Procesarhorasmesblackcrow application to different environments.

---

## 1. Local Development Setup

### Prerequisites
- Node.js 20+
- SQL Server 2019+ or Azure SQL
- Git
- VS Code (recommended)

### Step 1: Clone and Setup

```bash
# Clone repository
git clone <repository-url>
cd procesarhorasmesblackcrow

# Install dependencies
npm install
```

### Step 2: Database Setup

#### Option A: Local SQL Server

1. **Create Database**:
   ```sql
   CREATE DATABASE Asistencia;
   ```

2. **Run Schema Script**:
   ```bash
   # Execute sql/001_schema.sql on the database
   sqlcmd -S localhost -U sa -P <password> -d Asistencia -i sql/001_schema.sql
   ```
   Or use SQL Server Management Studio to execute the script.

#### Option B: Azure SQL

1. **Create Azure SQL Database**:
   - Use Azure Portal
   - Server: `<servername>.database.windows.net`
   - Database: `Asistencia`

2. **Connect and Run Schema**:
   ```bash
   sqlcmd -S <servername>.database.windows.net -U <admin@servername> -P <password> -d Asistencia -i sql/001_schema.sql
   ```

### Step 3: Environment Configuration

1. **Create .env file**:
   ```bash
   cp .env.example .env
   ```

2. **Edit .env for local SQL Server**:
   ```env
   PORT=3000
   SESSION_SECRET=your-secure-random-secret-key
   SQL_SERVER=localhost
   SQL_DATABASE=Asistencia
   SQL_USER=sa
   SQL_PASSWORD=your-sa-password
   SQL_ENCRYPT=false
   SQL_TRUST_CERT=true
   ADMIN_DEFAULT_PASSWORD=pass1234*
   ```

3. **Or for Azure SQL**:
   ```env
   PORT=3000
   SESSION_SECRET=your-secure-random-secret-key
   SQL_SERVER=servername.database.windows.net
   SQL_DATABASE=Asistencia
   SQL_USER=admin@servername
   SQL_PASSWORD=your-password
   SQL_ENCRYPT=true
   SQL_TRUST_CERT=false
   ADMIN_DEFAULT_PASSWORD=pass1234*
   ```

### Step 4: Run Application

```bash
npm start
```

Expected output:
```
Servidor iniciado en puerto 3000
```

Access the application:
- Open browser: http://localhost:3000
- Login: `admin` / `pass1234*`

### Troubleshooting Local Setup

| Issue | Solution |
|-------|----------|
| Connection refused | Verify SQL Server running, check host/port |
| Authentication failed | Verify SQL_USER/SQL_PASSWORD in .env |
| Database not found | Run schema script (sql/001_schema.sql) |
| Port already in use | Change PORT in .env or kill process on 3000 |
| Module not found | Run `npm install` again |

---

## 2. Azure App Service Deployment

### Prerequisites
- Azure subscription
- Azure SQL Database created (with schema applied)
- Application tested locally
- `.env` variables ready

### Step 1: Prepare Deployment Package

```bash
# Clean previous packages
if (Test-Path ../app-deploy.zip) { Remove-Item ../app-deploy.zip }

# Create deployment package with all dependencies
Compress-Archive -Path src, views, public, sql, package.json, package-lock.json, node_modules `
  -DestinationPath ../app-deploy.zip

# Verify package
Write-Host "Package ready: $((Get-Item ../app-deploy.zip).Length / 1MB) MB"
```

**Package Contents**:
- `src/` - Application code
- `views/` - EJS templates
- `public/` - Static assets
- `sql/` - Schema script
- `package.json` - Dependencies list
- `package-lock.json` - Locked versions
- `node_modules/` - Installed packages

### Step 2: Create Azure App Service

**Via Azure Portal**:
1. Create new "App Service"
2. Select runtime stack: "Node 20 LTS"
3. Operating system: Linux (recommended)
4. Region: Select your region
5. App Service Plan: Create or select
6. Click "Review + Create"

**Via Azure CLI**:
```bash
az appservice plan create \
  --name myAppServicePlan \
  --resource-group myResourceGroup \
  --sku B1 \
  --is-linux

az webapp create \
  --resource-group myResourceGroup \
  --plan myAppServicePlan \
  --name myAsistenciaApp \
  --runtime "NODE|20-lts"
```

### Step 3: Configure Application Settings

**Via Azure Portal**:
1. Navigate to App Service
2. Settings → Configuration
3. Application Settings → Add new setting

**Add Environment Variables**:
```
PORT = 3000
SESSION_SECRET = <generate-strong-random-value>
SQL_SERVER = <servername>.database.windows.net
SQL_DATABASE = Asistencia
SQL_USER = <admin@servername>
SQL_PASSWORD = <password>
SQL_ENCRYPT = true
SQL_TRUST_CERT = false
ADMIN_DEFAULT_PASSWORD = <secure-password>
```

**Via Azure CLI**:
```bash
az webapp config appsettings set \
  --resource-group myResourceGroup \
  --name myAsistenciaApp \
  --settings \
    PORT=3000 \
    SESSION_SECRET=<secret> \
    SQL_SERVER=<server>.database.windows.net \
    SQL_DATABASE=Asistencia \
    SQL_USER=<admin@server> \
    SQL_PASSWORD=<password> \
    SQL_ENCRYPT=true \
    SQL_TRUST_CERT=false
```

### Step 4: Deploy Application

**Method A: ZIP Deployment (Recommended)**

1. Azure Portal → App Service → Deployment Center
2. Choose "Manual Deployment" or "ZIP Upload"
3. Select deployment method: "ZIP File Upload"
4. Upload `app-deploy.zip`
5. Deployment automatically starts

**Method B: Azure CLI**:
```bash
az webapp deployment source config-zip \
  --resource-group myResourceGroup \
  --name myAsistenciaApp \
  --src app-deploy.zip
```

**Method C: Direct FTP**:
1. Get FTP credentials from App Service
2. Connect via FTP client
3. Upload files to `/site/wwwroot`

### Step 5: Verify Deployment

1. Navigate to App Service URL: `https://myasistenciaapp.azurewebsites.net`
2. Should redirect to login page
3. Login with admin / `ADMIN_DEFAULT_PASSWORD`
4. Test import functionality
5. Check logs in Azure Portal → Logs → Application Logs

### Production Checklist

- [ ] DATABASE schema applied successfully
- [ ] CONNECTION string verified working
- [ ] SESSION_SECRET is strong (32+ chars)
- [ ] ADMIN password changed from default
- [ ] HTTPS enforced in App Service
- [ ] Scale up App Service Plan if needed
- [ ] Configure continuous backup
- [ ] Set up monitoring/alerts
- [ ] Test complete workflows (login, import, view)

---

## 3. Azure SQL Database Setup

### Create Azure SQL Server

**Via Azure Portal**:
1. Create resource → SQL Database
2. Database name: `Asistencia`
3. Create new Server:
   - Server name: `<unique-name>`
   - Location: Select region
   - Authentication: SQL authentication or Azure AD
   - Admin login: `azureuser` (or custom)
   - Password: Strong 12+ chars
4. Compute + storage: Configure as needed
5. Click "Review + Create"

**Via Azure CLI**:
```bash
az sql server create \
  --name myserver \
  --resource-group myResourceGroup \
  --location westus \
  --admin-user azureuser \
  --admin-password <strong-password>

az sql db create \
  --server myserver \
  --name Asistencia \
  --resource-group myResourceGroup
```

### Configure Firewall

Allow App Service to connect:
```bash
az sql server firewall-rule create \
  --server myserver \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0 \
  --resource-group myResourceGroup
```

### Apply Schema

Connect to Azure SQL and execute `sql/001_schema.sql`:

**Via SSMS**:
1. Open SQL Server Management Studio
2. Server: `myserver.database.windows.net`
3. Auth: SQL Server Auth
4. Username/password: Your admin credentials
5. Open `sql/001_schema.sql`
6. Execute (F5)

**Via sqlcmd**:
```bash
sqlcmd -S myserver.database.windows.net -U azureuser -P <password> -d Asistencia -i sql/001_schema.sql
```

### Connection String

For use in `.env` or App Settings:
```
Server=myserver.database.windows.net;Database=Asistencia;User Id=azureuser;Password=<password>;Encrypt=true;TrustServerCertificate=false;
```

---

## 4. Docker Deployment (Advanced)

### Create Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY views ./views
COPY public ./public

ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/app.js"]
```

### Create Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - SESSION_SECRET=${SESSION_SECRET}
      - SQL_SERVER=${SQL_SERVER}
      - SQL_DATABASE=${SQL_DATABASE}
      - SQL_USER=${SQL_USER}
      - SQL_PASSWORD=${SQL_PASSWORD}
      - SQL_ENCRYPT=false
      - SQL_TRUST_CERT=true
    depends_on:
      - db
  
  db:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      - ACCEPT_EULA=Y
      - SA_PASSWORD=${SA_PASSWORD}
    ports:
      - "1433:1433"
    volumes:
      - sqlserver_data:/var/opt/mssql/data
      - ./sql/001_schema.sql:/docker-entrypoint-initdb.d/schema.sql

volumes:
  sqlserver_data:
```

### Build and Run

```bash
# Build image
docker build -t procesarhorasmesblackcrow .

# Run container
docker run -p 3000:3000 \
  -e SQL_SERVER=localhost \
  -e SQL_DATABASE=Asistencia \
  -e SQL_USER=sa \
  -e SQL_PASSWORD=YourPassword123 \
  procesarhorasmesblackcrow

# Or use Docker Compose
docker-compose up
```

---

## 5. Environment-Specific Configuration

### Development (.env)
```env
PORT=3000
SESSION_SECRET=dev-secret-change-in-production
SQL_SERVER=localhost
SQL_DATABASE=Asistencia
SQL_USER=sa
SQL_PASSWORD=dev-password
SQL_ENCRYPT=false
SQL_TRUST_CERT=true
ADMIN_DEFAULT_PASSWORD=pass1234*
```

### Staging (.env.staging)
```env
PORT=3000
SESSION_SECRET=<strong-random-secret>
SQL_SERVER=staging-server.database.windows.net
SQL_DATABASE=Asistencia_Staging
SQL_USER=admin@staging-server
SQL_PASSWORD=<strong-password>
SQL_ENCRYPT=true
SQL_TRUST_CERT=false
ADMIN_DEFAULT_PASSWORD=<temporary-password>
```

### Production (.env.production)
```env
PORT=3000
SESSION_SECRET=<very-strong-random-secret-32+chars>
SQL_SERVER=prod-server.database.windows.net
SQL_DATABASE=Asistencia
SQL_USER=admin@prod-server
SQL_PASSWORD=<very-strong-password>
SQL_ENCRYPT=true
SQL_TRUST_CERT=false
ADMIN_DEFAULT_PASSWORD=<strong-temporary-password>
```

### Security Best Practices

1. **Never commit .env files** - Add to `.gitignore`
2. **Rotate secrets regularly** - Change `SESSION_SECRET` periodically
3. **Use strong passwords** - Min 12 characters, mixed case, numbers, symbols
4. **Restrict database access** - Firewall rules, network policies
5. **Enable HTTPS** - Configure SSL/TLS in App Service
6. **Monitor logs** - Check Azure Application Insights
7. **Regular backups** - Configure Azure SQL backup retention

---

## 6. Monitoring & Troubleshooting

### Azure Portal Monitoring

1. **Application Insights**:
   - App Service → Application Insights
   - Enable Application Insights
   - Monitor performance, errors, requests

2. **Logs**:
   - App Service → Log Stream
   - Real-time application logs
   - Check for errors/warnings

3. **Metrics**:
   - App Service → Metrics
   - CPU, memory, HTTP requests
   - Set up alerts for thresholds

### Common Deployment Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Application crashes on startup | Missing environment variables | Verify all required vars in App Settings |
| Database connection failed | Wrong connection string | Check SQL_SERVER, SQL_USER, SQL_PASSWORD |
| Cannot access app | Firewall blocking | Configure firewall rules in Azure |
| Slow performance | Insufficient resources | Scale up App Service Plan |
| Files not found | Incomplete deployment | Redeploy with complete package |

### Check Application Logs

```bash
# Azure CLI
az webapp log tail --resource-group myResourceGroup --name myAsistenciaApp

# Or via Portal
# App Service → Log Stream → Select File System or Application Logs
```

### Test Connectivity

```bash
# SSH into App Service (if available)
az webapp create-remote-connection --resource-group myResourceGroup --name myAsistenciaApp

# Inside container, test database
# Node.js REPL
node
> const sql = require('mssql');
> const result = await sql.connect({...});
> console.log(result);
```

---

## 7. Backup & Recovery

### Azure SQL Backups

**Automatic Backups**:
- Retained for 7 days (default)
- Geo-redundant replication
- No manual action required

**Point-in-Time Restore**:
```bash
az sql db restore \
  --server myserver \
  --name Asistencia \
  --resource-group myResourceGroup \
  --restore-point-in-time 2026-02-15T14:00:00
```

### Application Data Backup

**Upload Directory**:
- Contains imported Excel files
- Should be backed up regularly
- Consider Azure Blob Storage

```bash
# Backup uploads to blob
az storage blob upload-batch \
  --account-name mystorageaccount \
  --destination-path uploads \
  --source uploads/
```

---

## 8. Performance Optimization

### Database Optimization
- Add indexes on frequently queried columns
- Update statistics regularly
- Archive old attendance records

### Application Optimization
- Enable compression for responses
- Cache static assets
- Use CDN for public assets

### Azure Optimization
- Scale App Service Plan based on load
- Use Application Gateway for load balancing
- Enable caching in Application Insights

---

## 9. Rollback Procedures

### Rollback to Previous Version

**If deployment fails**:
1. Azure Portal → App Service → Deployment slots
2. If using slots, swap staging ↔ production
3. Or redeploy previous working ZIP

**Command Line Rollback**:
```bash
az webapp deployment source config-zip \
  --resource-group myResourceGroup \
  --name myAsistenciaApp \
  --src previous-app-deploy.zip
```

---

## 10. Security Hardening

### Network Security
- Enable Azure Firewall
- Use private endpoints for database
- Restrict App Service access

### Application Security
- Keep dependencies updated: `npm audit`, `npm update`
- Use HTTPS only (enforce in App Service)
- Regular security scans

### Data Security
- Enable SQL database encryption at rest
- Use Azure Key Vault for secrets
- Enable audit logging

---

**See Also**:
- [README.md](../README.md) for quick start
- [Architecture Overview](./ARCHITECTURE.md) for system design
