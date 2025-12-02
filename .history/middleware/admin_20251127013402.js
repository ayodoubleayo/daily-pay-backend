

/**
 * Middleware to protect admin routes.
 * It strictly checks for a matching secret in the 'x-admin-secret' header 
 * against the ADMIN_SECRET environment variable.
 * * CRITICAL: You MUST set the ADMIN_SECRET environment variable on your server.
 */
module.exports = function (req, res, next) {

  const adminSecret = (process.env.ADMIN_SECRET || '').toString().trim(); 


  if (adminSecret.length === 0) {
    console.error("ADMIN_SECRET environment variable is not set. Admin routes are inaccessible.");
    return res.status(503).json({ error: 'Server configuration error: Admin secret missing.' });
  }


  const header = (req.headers['x-admin-secret'] || '').toString().trim();


  if (header === adminSecret) {

    return next();
  }


  return res.status(401).json({ error: 'Not authorized: Invalid Admin Secret' });
};
