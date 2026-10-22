const memberQuery = 'SELECT id, name, email, role, member_type AS "memberType", phone, bio, skills, created_at AS "createdAt" FROM users';

function createUserRepository(database) {
  return {
    async connect() { return createUserRepository(await database.connect()); },
    release() { database.release(); },
    findPublicById(params) { return database.query(`${memberQuery} WHERE id = $1`, params); },
    pruneVerification() { return database.query('DELETE FROM email_verification_tokens WHERE expires_at < NOW()'); },
    createVerification(params) { return database.query(`INSERT INTO email_verification_tokens (token_hash, user_id, expires_at)
    VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`, params); },
    replaceVerification(params) { return database.query('DELETE FROM email_verification_tokens WHERE user_id = $1 AND token_hash <> $2', params); },
    resetVerificationAttempts(params) { return database.query('UPDATE users SET email_verification_attempts = 0 WHERE id = $1', params); },
    removeVerification(params) { return database.query('DELETE FROM email_verification_tokens WHERE token_hash = $1', params); },
    begin() { return database.query('BEGIN'); },
    createUnverified(params) { return database.query(`INSERT INTO users (name, email, password_hash, role, member_type, email_verified)
       VALUES ($1, $2, $3, $4, $5, FALSE)
       RETURNING id, name, email, role, member_type AS "memberType", phone, bio, skills`, params); },
    createInitialApplication(params) { return database.query(`INSERT INTO volunteer_applications (user_id, interest, availability, ssu_collaboration)
         VALUES ($1, $2, 'To be confirmed', $3)`, params); },
    commit() { return database.query('COMMIT'); },
    rollback() { return database.query('ROLLBACK'); },
    findUnverifiedForUpdate(params) { return database.query('SELECT id, name, email FROM users WHERE email = $1 AND email_verified = FALSE FOR UPDATE', params); },
    lockVerificationAccount(params) { return database.query(`SELECT id, email_verification_attempts FROM users
      WHERE email = $1 AND email_verified = FALSE FOR UPDATE`, params); },
    findValidVerification(params) { return database.query(`SELECT user_id FROM email_verification_tokens
        WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()`, params); },
    incrementVerificationAttempts(params) { return database.query('UPDATE users SET email_verification_attempts = email_verification_attempts + 1 WHERE id = $1', params); },
    markVerified(params) { return database.query('UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1', params); },
    clearVerification(params) { return database.query('DELETE FROM email_verification_tokens WHERE user_id = $1', params); },
    findForLogin(params) { return database.query(`SELECT id, name, email, role, member_type AS "memberType", phone, bio, skills, password_hash, email_verified
     FROM users WHERE email = $1`, params); },
    findForRecovery(params) { return database.query('SELECT id, name, email FROM users WHERE email = $1', params); },
    pruneResets() { return database.query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()'); },
    createReset(params) { return database.query(`INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`, params); },
    removeReset(params) { return database.query('DELETE FROM password_reset_tokens WHERE token_hash = $1', params); },
    lockResetAccount(params) { return database.query(`SELECT u.id AS user_id FROM users u JOIN password_reset_tokens t ON t.user_id = u.id
       WHERE t.token_hash = $1 AND t.expires_at > NOW()
       FOR UPDATE OF u`, params); },
    consumeReset(params) { return database.query('DELETE FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW() RETURNING user_id', params); },
    updatePasswordHash(params) { return database.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', params); },
    clearResets(params) { return database.query('DELETE FROM password_reset_tokens WHERE user_id = $1', params); },
    revokeSessions(params) { return database.query(`DELETE FROM user_sessions WHERE sess->>'userId' = $1`, params); },
    removePresence(params) { return database.query('DELETE FROM user_presence WHERE session_id = $1', params); },
    heartbeat(params) { return database.query(`INSERT INTO user_presence (session_id, user_id, last_seen) VALUES ($1, $2, NOW())
     ON CONFLICT (session_id) DO UPDATE SET user_id = EXCLUDED.user_id, last_seen = NOW()`, params); },
    findProfile(params) { return database.query(`SELECT id, name, email, role, member_type AS "memberType", phone, bio, skills,
            avatar_mime AS "avatarMime",
            CASE WHEN avatar_data IS NULL THEN NULL
                 ELSE 'data:' || avatar_mime || ';base64,' || encode(avatar_data, 'base64') END AS avatar
     FROM users WHERE id = $1`, params); },
    updateProfile(params) { return database.query(`UPDATE users SET name = $1, phone = $2, bio = $3, skills = $4,
       avatar_mime = COALESCE($5, avatar_mime),
       avatar_data = COALESCE($6, avatar_data), updated_at = NOW()
     WHERE id = $7
     RETURNING id, name, email, role, member_type AS "memberType", phone, bio, skills`, params); },
  };
}
module.exports = { createUserRepository };
