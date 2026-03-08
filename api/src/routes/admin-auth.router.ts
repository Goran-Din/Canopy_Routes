// api/src/routes/admin-auth.router.ts
// Super-admin authentication endpoint

import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'email and password required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM rpw_super_admins WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const admin = result.rows[0];

    // Check lockout
    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      return res.status(423).json({ success: false, error: 'Account locked. Try again later.' });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      const attempts = admin.failed_attempts + 1;
      if (attempts >= 5) {
        await pool.query(
          'UPDATE rpw_super_admins SET failed_attempts = 0, locked_until = $1 WHERE id = $2',
          [new Date(Date.now() + 30 * 60 * 1000), admin.id]
        );
      } else {
        await pool.query(
          'UPDATE rpw_super_admins SET failed_attempts = $1 WHERE id = $2',
          [attempts, admin.id]
        );
      }
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Reset failed attempts
    await pool.query(
      'UPDATE rpw_super_admins SET failed_attempts = 0, locked_until = NULL WHERE id = $1',
      [admin.id]
    );

    const privateKey = (process.env.JWT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!privateKey) return res.status(500).json({ success: false, error: 'JWT not configured' });

    const token = jwt.sign(
      { adminId: admin.id, email: admin.email, role: 'super_admin' },
      privateKey,
      { algorithm: 'RS256', expiresIn: '8h' }
    );

    res.json({ success: true, data: { accessToken: token, name: admin.name, email: admin.email } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export { router as adminAuthRouter };
