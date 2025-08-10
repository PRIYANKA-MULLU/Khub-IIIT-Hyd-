const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/auth');

// Get all notifications for logged-in user
router.get('/all', authMiddleware, notificationController.getUserNotifications);

// Get unread notifications
router.get('/unread-count', authMiddleware, notificationController.getUnreadNotifications);

// Mark notification as read
router.patch('/:id/read', authMiddleware, notificationController.markAsRead);

module.exports = router;