'use strict';
const { query, queryOne } = require('../database/connection');

async function findById(id) {
  return queryOne(`SELECT id, full_name, username, email, phone, password_hash, role, is_active, preferred_language, auth_version, created_at, updated_at
                   FROM users WHERE id=?`, [id]);
}
async function findByIdentifier(identifier) {
  return queryOne(`SELECT * FROM users WHERE username=? OR email=? OR phone=? LIMIT 1`, [identifier, identifier, identifier]);
}
async function findByUsername(username) { return queryOne('SELECT * FROM users WHERE username=? LIMIT 1', [username]); }
async function findByEmail(email) { return email ? queryOne('SELECT * FROM users WHERE email=? LIMIT 1', [email]) : null; }
async function create(data) {
  const result = await query(`INSERT INTO users (full_name,username,email,phone,password_hash,role,is_active,preferred_language)
                              VALUES (?,?,?,?,?,?,?,?)`, [data.full_name, data.username, data.email || null, data.phone || null, data.password_hash, data.role, data.is_active ?? 1, data.preferred_language || 'en']);
  return findById(result.insertId);
}
async function update(id, fields) {
  const allowed = ['full_name','username','email','phone','password_hash','is_active','preferred_language'];
  const keys = Object.keys(fields).filter(k => allowed.includes(k));
  if (!keys.length) return findById(id);
  const sql = `UPDATE users SET ${keys.map(k => `${k}=?`).join(', ')} WHERE id=?`;
  await query(sql, [...keys.map(k => fields[k]), id]);
  return findById(id);
}
async function list({ search='', role='', page=1, limit=20 }={}) {
  const where=[]; const params=[];
  if (search) { where.push('(u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)'); const q=`%${search}%`; params.push(q,q,q,q); }
  if (role) { where.push('u.role=?'); params.push(role); }
  const clause=where.length?`WHERE ${where.join(' AND ')}`:'';
  const offset=(Math.max(1,Number(page))-1)*Math.max(1,Number(limit));
  const rows=await query(`SELECT u.id,u.full_name,u.username,u.email,u.phone,u.role,u.is_active,u.preferred_language,u.created_at,
      go.business_name, bc.owner_id AS collector_owner_id, sp.id AS subscriber_profile_id
    FROM users u
    LEFT JOIN generator_owners go ON go.user_id=u.id
    LEFT JOIN bill_collectors bc ON bc.user_id=u.id
    LEFT JOIN subscriber_profiles sp ON sp.user_id=u.id
    ${clause} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, [...params, Number(limit), offset]);
  const countRow=await queryOne(`SELECT COUNT(*) total FROM users u ${clause}`, params);
  return { users: rows, total: Number(countRow?.total || 0) };
}
async function deactivate(id) { await query('UPDATE users SET is_active=0 WHERE id=? AND role<>\'admin\'', [id]); return findById(id); }
async function insertRefreshToken(userId, tokenHash, expiresAt) { return query('INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES (?,?,?)',[userId,tokenHash,expiresAt]); }
async function findRefreshToken(tokenHash) { return queryOne('SELECT * FROM refresh_tokens WHERE token_hash=? AND expires_at>NOW()', [tokenHash]); }
async function deleteRefreshToken(tokenHash) { return query('DELETE FROM refresh_tokens WHERE token_hash=?',[tokenHash]); }
async function deleteUserRefreshTokens(userId) { return query('DELETE FROM refresh_tokens WHERE user_id=?',[userId]); }
async function bumpAuthVersion(userId) { await query('UPDATE users SET auth_version=auth_version+1 WHERE id=?',[userId]); return findById(userId); }

module.exports = { findById, findByIdentifier, findByUsername, findByEmail, create, update, list, deactivate, insertRefreshToken, findRefreshToken, deleteRefreshToken, deleteUserRefreshTokens, bumpAuthVersion };
