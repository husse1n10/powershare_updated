'use strict';

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { databaseConfig } = require('../DAL/database/config');

async function main() {
  const confirmation = process.argv[2];
  if (process.argv.length > 3 || (confirmation && !confirmation.startsWith('--confirm='))) {
    throw new Error('Usage: npm run db:reset [-- --confirm=DATABASE_NAME]');
  }
  if (!process.env.JAWSDB_URL && !process.env.DB_NAME) {
    throw new Error('Set JAWSDB_URL or DB_NAME explicitly before using the reset command');
  }

  const config = databaseConfig();
  if (confirmation && confirmation !== `--confirm=${config.database}`) {
    throw new Error('The confirmation does not match the configured database name. No tables were changed.');
  }

  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  const connection = await mysql.createConnection({ ...config, multipleStatements: true });
  try {
    const [[{ selectedDatabase }]] = await connection.query('SELECT DATABASE() AS selectedDatabase');
    if (selectedDatabase !== config.database) {
      throw new Error('The selected MySQL database does not match the configured database');
    }

    const [objects] = await connection.execute(
      'SELECT TABLE_NAME AS name, TABLE_TYPE AS kind FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
      [selectedDatabase]
    );
    const tables = objects.filter(object => object.kind === 'BASE TABLE');
    const views = objects.filter(object => object.kind === 'VIEW');
    console.log(`Database: ${selectedDatabase} (host: ${config.host})`);
    console.log(`Tables: ${tables.map(table => table.name).join(', ') || 'none'}`);
    console.log(`Views: ${views.map(view => view.name).join(', ') || 'none'}`);
    if (!confirmation) {
      console.log('Preview only. After making a backup, rerun with --confirm=DATABASE_NAME to replace these objects.');
      return;
    }

    const qualifiedName = object => [selectedDatabase, object.name].map(name => mysql.escapeId(name, true)).join('.');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    if (views.length) await connection.query(`DROP VIEW IF EXISTS ${views.map(qualifiedName).join(', ')}`);
    if (tables.length) await connection.query(`DROP TABLE IF EXISTS ${tables.map(qualifiedName).join(', ')}`);
    await connection.query(schema);
    console.log('Reset complete. The new schema contains default settings and contains no user accounts.');
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(`Database reset failed: ${error.message}`);
  process.exitCode = 1;
});
