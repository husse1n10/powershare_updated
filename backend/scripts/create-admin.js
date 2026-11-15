'use strict';

require('dotenv').config();
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { pool, queryOne } = require('../DAL/database/connection');
const users = require('../DAL/repositories/userRepository');

async function main() {
  try {
    const existing = await queryOne("SELECT id FROM users WHERE role = 'admin' OR username = 'admin' LIMIT 1");
    if (existing) {
      throw new Error('An administrator or a user named admin already exists');
    }

    const password = 'Aa1!' + randomBytes(18).toString('base64url');
    await users.create({
      full_name: 'PowerShare Admin',
      username: 'admin',
      password_hash: await bcrypt.hash(password, 12),
      role: 'admin',
    });
    console.log('Admin username: admin');
    console.log(`Admin password: ${password}`);
    console.log('Save this password. You can change it from Account Security after signing in.');
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(`Admin creation failed: ${error.message}`);
  process.exitCode = 1;
});
