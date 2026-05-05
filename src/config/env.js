const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parseAuthenticationType(connectionString = '') {
  const authMatch = String(connectionString).match(/Authentication\s*=\s*"?([^;\"]+)"?/i);
  if (!authMatch) {
    return undefined;
  }

  const authValue = authMatch[1].trim().toLowerCase();

  if (authValue === 'active directory default') {
    return 'azure-active-directory-default';
  }

  return undefined;
}

function parseConnectionStringValue(connectionString = '', keyPattern) {
  const pattern = new RegExp(`${keyPattern}\\s*=\\s*"?([^;\"]+)"?`, 'i');
  const match = String(connectionString).match(pattern);
  return match ? match[1].trim() : '';
}

function normalizeServer(serverValue = '') {
  return String(serverValue)
    .replace(/^tcp:/i, '')
    .split(',')[0]
    .trim();
}

const connectionString = process.env.SQL_CONNECTION_STRING || '';
const parsedAuthenticationType = parseAuthenticationType(connectionString);
const parsedServer = normalizeServer(parseConnectionStringValue(connectionString, 'Server|Data Source'));
const parsedDatabase = parseConnectionStringValue(connectionString, 'Initial Catalog|Database');
const explicitAuthenticationType = (process.env.SQL_AUTHENTICATION || '').trim().toLowerCase();
const authenticationType =
  explicitAuthenticationType || parsedAuthenticationType || '';

module.exports = {
  port: Number(process.env.PORT || 3000),
  sessionSecret: process.env.SESSION_SECRET || 'dev_secret',
  sql: {
    connectionString,
    server: process.env.SQL_SERVER || parsedServer,
    database: process.env.SQL_DATABASE || parsedDatabase,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    authenticationType,
    options: {
      encrypt: String(process.env.SQL_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(process.env.SQL_TRUST_CERT || 'true').toLowerCase() === 'true'
    }
  }
};
