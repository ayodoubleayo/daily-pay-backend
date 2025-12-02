
module.exports = function (req, res, next) {

  const adminSecret = (process.env.ADMIN_SECRET || 'ayo$oya').toString().trim();


  const header = (req.headers['x-admin-secret'] || '').toString().trim();
  const q = (req.query && req.query.adminSecret) ? String(req.query.adminSecret).trim() : '';
  const b = (req.body && req.body.adminSecret) ? String(req.body.adminSecret).trim() : '';

  if (header === adminSecret || q === adminSecret || b === adminSecret) {
    return next();
  }

  return res.status(401).json({ error: 'Not authorized' });
};
