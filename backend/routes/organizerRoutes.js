const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const paymentController = require('../controllers/paymentController');

// Analytics routes
router.get('/month-analytics/:month', authController.protect, paymentController.getMonthAnalytics);
router.get('/day-analytics/:date', authController.protect, paymentController.getDayAnalytics);

// Other organizer routes
router.get('/users', authController.protect, authController.getUsersByOrganizer);
router.get('/details', authController.protect, authController.getOrganizerDetails);

module.exports = router; 