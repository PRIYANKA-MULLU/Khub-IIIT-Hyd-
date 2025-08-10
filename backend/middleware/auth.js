const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Make sure to have `JWT_SECRET` in your `.env` file
    req.user = decoded; // Store user data in `req.user` for further use
    next(); // Proceed to the next middleware/controller
  } catch (error) {
    console.error('Invalid token:', error);
    res.status(401).json({ message: 'Invalid token.' });
  }
};

module.exports = auth;
