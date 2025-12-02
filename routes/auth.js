const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendMail } = require('../services/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'secret-dev';

const COOKIE_NAME = 'token';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3000';

// -------------------------------------------------------------
// MAKE ME ADMIN ROUTE
// -------------------------------------------------------------
router.get('/make-me-admin', async (req, res) => {
  const email = "ayotheceo@gmail.com";

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: 'User not found' });

  user.role = "admin";
  await user.save();

  res.json({ message: "Admin role set successfully!", user });
});

// -------------------------------------------------------------
// REGISTER  (UPDATED — includes role in token + httpOnly cookie)
// -------------------------------------------------------------
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ error: 'User exists' });

    const hash = await bcryptjs.hash(password, 10);
    const user = await User.create({ name, email: normalizedEmail, passwordHash: hash });

    // create token with role
    const token = jwt.sign(
      { id: user._id, role: user.role || 'user' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // set httpOnly cookie
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
    });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// -------------------------------------------------------------
// LOGIN  (UPDATED — includes role in token + httpOnly cookie)
// -------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = (email || '').toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    if (user.banned) return res.status(403).json({ error: 'Account banned permanently' });
    if (user.suspended) return res.status(403).json({ error: 'Account suspended by admin' });

    const ok = await bcryptjs.compare(password, user.passwordHash || '');
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, role: user.role || 'user' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // set httpOnly cookie
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
    });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// -------------------------------------------------------------
// LOGOUT — clear cookie
// -------------------------------------------------------------
router.post('/logout', async (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  res.json({ ok: true });
});

// -------------------------------------------------------------
// LIST USERS
// -------------------------------------------------------------
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// -------------------------------------------------------------
// FORGOT PASSWORD
// -------------------------------------------------------------
router.post('/forgot-password', async (req, res) => {
  try {
    console.log('1. Forgot password route hit');
    const { email } = req.body;
    console.log('2. Email:', email);

    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    console.log('User found?', !!user);

    if (!user) {
      return res.json({ ok: true, message: 'If that email exists, a reset link was sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const expires = Date.now() + 60 * 60 * 1000;

    user.resetPasswordToken = hashed;
    user.resetPasswordExpires = new Date(expires);
    await user.save();

    const resetLink = `${FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

    const html = `
      <p>Hello ${user.name || ''},</p>
      <p>You asked to reset your password. Click the link below to set a new password. This link will expire in 1 hour.</p>
      <p><a href="${resetLink}">Reset your password</a></p>
    `;

    await sendMail({
      from: process.env.MAIL_FROM,
      to: user.email,
      subject: 'Reset your password',
      html,
      text: `Reset your password: ${resetLink}`
    });

    return res.json({ ok: true, message: 'If that email exists, a reset link was sent.' });
  } catch (err) {
    console.error('forgot-password error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// -------------------------------------------------------------
// RESET PASSWORD
// -------------------------------------------------------------
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, email } = req.body;
    if (!token || !password || !email)
      return res.status(400).json({ error: 'Missing fields' });

    const hashed = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    const salt = await bcryptjs.genSalt(10);
    user.passwordHash = await bcryptjs.hash(password, salt);

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.lastActive = new Date();

    await user.save();

    return res.json({ ok: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('reset-password error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
