const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/auth');
const UserPayment = require('../models/UserPayment'); // Add this import
const authController = require("../controllers/authController");

// Payment update route
router.patch('/payment/:userId/:serialNo', paymentController.updatePaymentDetails);

// Payment schedule route
router.get('/payment-schedule/:userId', paymentController.createPaymentSchedule);

// User details route
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const user = await UserPayment.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Error fetching user data' });
  }
});

router.patch('/:userId/:serialNo', paymentController.updatePaymentDetails);

// Route to get all users with payments
router.get('/users/:organizerId', paymentController.getAllUsersWithPayments);
router.get('/month-analytics/:month', authController.protect, paymentController.getMonthAnalytics);
router.get('/day-analytics/:date', authController.protect, paymentController.getDayAnalytics);

// Bulk update payments route
router.patch('/:userId/bulk-update', paymentController.bulkUpdatePayments);

module.exports = router;