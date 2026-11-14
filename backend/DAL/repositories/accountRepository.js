'use strict';
const { transaction } = require('../database/connection');

function repoError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function selectUserById(conn, id) {
  const [rows] = await conn.execute(`SELECT id, full_name, username, email, phone, password_hash, role, is_active,
      preferred_language, auth_version, created_at, updated_at FROM users WHERE id=?`, [id]);
  return rows[0] || null;
}

async function insertUser(conn, data) {
  const [result] = await conn.execute(`INSERT INTO users
    (full_name,username,email,phone,password_hash,role,is_active,preferred_language)
    VALUES (?,?,?,?,?,?,?,?)`, [
      data.full_name,
      data.username,
      data.email || null,
      data.phone || null,
      data.password_hash,
      data.role,
      data.is_active ?? 1,
      data.preferred_language || 'en',
    ]);
  return result.insertId;
}

/**
 * Creates the authentication row and any required role/profile link in one DB transaction.
 * This prevents orphan users if profile creation/linking fails.
 */
async function createUserWithRoleProfile(data, { ownerId = null, subscriberProfileId = null } = {}) {
  return transaction(async conn => {
    const userId = await insertUser(conn, data);

    if (data.role === 'owner') {
      await conn.execute(
        'INSERT INTO generator_owners(user_id,business_name,company_address) VALUES (?,?,?)',
        [userId, data.business_name || null, data.company_address || null]
      );
    }

    if (data.role === 'collector') {
      if (!ownerId) throw repoError('Owner is required for collector', 'OWNER_REQUIRED');
      const [owners] = await conn.execute('SELECT id FROM generator_owners WHERE id=? FOR UPDATE', [ownerId]);
      if (!owners.length) throw repoError('Generator owner not found', 'OWNER_NOT_FOUND');
      await conn.execute('INSERT INTO bill_collectors(owner_id,user_id) VALUES (?,?)', [ownerId, userId]);
    }

    if (data.role === 'subscriber') {
      if (!subscriberProfileId) throw repoError('Subscriber profile is required', 'SUBSCRIBER_PROFILE_REQUIRED');
      const [profiles] = await conn.execute(
        'SELECT id,user_id,created_by_owner FROM subscriber_profiles WHERE id=? FOR UPDATE',
        [subscriberProfileId]
      );
      const profile = profiles[0];
      if (!profile) throw repoError('Subscriber profile not found', 'SUBSCRIBER_PROFILE_NOT_FOUND');
      if (ownerId && Number(profile.created_by_owner) !== Number(ownerId)) {
        throw repoError('Subscriber profile does not belong to this owner', 'SUBSCRIBER_OWNER_MISMATCH');
      }
      if (profile.user_id) throw repoError('Subscriber already has an account', 'ACCOUNT_EXISTS');
      const [link] = await conn.execute(
        'UPDATE subscriber_profiles SET user_id=? WHERE id=? AND user_id IS NULL',
        [userId, subscriberProfileId]
      );
      if (link.affectedRows !== 1) throw repoError('Subscriber account link changed concurrently', 'ACCOUNT_LINK_CONFLICT');
    }

    return selectUserById(conn, userId);
  });
}

/**
 * Updates the authentication profile in one transaction and keeps the linked
 * subscriber master record consistent for subscriber-owned name/phone fields.
 */
async function updateUserProfileAtomically(userId, fields = {}) {
  return transaction(async conn => {
    const [users] = await conn.execute('SELECT id,role FROM users WHERE id=? FOR UPDATE', [userId]);
    const user = users[0];
    if (!user) throw repoError('User not found', 'USER_NOT_FOUND');

    const allowed = ['full_name','username','email','phone','preferred_language'];
    const keys = Object.keys(fields).filter(key => allowed.includes(key));
    if (keys.length) {
      await conn.execute(
        `UPDATE users SET ${keys.map(key => `${key}=?`).join(', ')} WHERE id=?`,
        [...keys.map(key => fields[key]), userId]
      );
    }

    if (user.role === 'subscriber') {
      const subscriberFields = {};
      if (fields.full_name !== undefined) subscriberFields.full_name = fields.full_name;
      if (fields.phone !== undefined) subscriberFields.phone = fields.phone;
      const subscriberKeys = Object.keys(subscriberFields);
      if (subscriberKeys.length) {
        await conn.execute(
          `UPDATE subscriber_profiles SET ${subscriberKeys.map(key => `${key}=?`).join(', ')} WHERE user_id=?`,
          [...subscriberKeys.map(key => subscriberFields[key]), userId]
        );
      }
    }

    return selectUserById(conn, userId);
  });
}

module.exports = { createUserWithRoleProfile, updateUserProfileAtomically };
