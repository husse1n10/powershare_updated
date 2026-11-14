'use strict';

const awsCaBundle = require('aws-ssl-profiles');

function databaseConfig() {
  if (process.env.JAWSDB_URL) {
    const url = new URL(process.env.JAWSDB_URL);
    const database = decodeURIComponent(url.pathname.slice(1));
    if (url.protocol !== 'mysql:' || !url.hostname || !url.username || !database) {
      throw new Error('JAWSDB_URL must be a MySQL URL with a host, user, and database');
    }
    const isAmazonRds = url.hostname.endsWith('.rds.amazonaws.com');
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database,
      charset: 'utf8mb4',
      ssl: {
        ...(isAmazonRds ? { ca: awsCaBundle.ca } : {}),
        rejectUnauthorized: true,
        verifyIdentity: true,
      },
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'powershare',
    charset: 'utf8mb4',
  };
}

module.exports = { databaseConfig };
