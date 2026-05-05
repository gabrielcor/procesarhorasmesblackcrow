const sql = require('mssql');
const env = require('../config/env');

let pool;

function buildSqlConfig() {
  const hasSqlCredentials = Boolean(env.sql.user && env.sql.password);
  const config = {
    server: env.sql.server,
    database: env.sql.database,
    options: env.sql.options
  };

  if (env.sql.authenticationType === 'azure-active-directory-default' && !hasSqlCredentials) {
    config.authentication = {
      type: 'azure-active-directory-default'
    };

    return config;
  }

  if (env.sql.user) {
    config.user = env.sql.user;
  }

  if (env.sql.password) {
    config.password = env.sql.password;
  }

  return config;
}

async function getPool() {
  if (pool) {
    return pool;
  }

  pool = await sql.connect(buildSqlConfig());

  return pool;
}

async function query(text, params = {}) {
  const db = await getPool();
  const request = db.request();

  Object.entries(params).forEach(([key, value]) => {
    request.input(key, value);
  });

  const result = await request.query(text);
  return result.recordset;
}

module.exports = {
  getPool,
  query,
  sql
};
