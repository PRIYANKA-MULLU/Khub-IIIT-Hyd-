const Notification = require('../models/Notification');

// Create notification helper function
exports.createNotification = async (userId, title, message, type, additionalInfo) => {
  try {
    const notification = new Notification({
      user: userId,
      title,
      message,
      type,
      additionalInfo
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Get all notifications for a user
exports.getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: notifications.length,
      notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get unread notifications
exports.getUnreadNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      user: req.user.id,
      read: false
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: notifications.length,
      notifications
    });
  } catch (error) {
    console.error('Error fetching unread notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user.id
      },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};


// Backend route to fetch notifications for the logged-in user
exports.getAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id; // Get user ID from the token
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json({ notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Error fetching notifications", error: error.message });
  }
};