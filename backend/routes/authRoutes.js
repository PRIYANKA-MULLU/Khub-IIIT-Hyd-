const express = require('express');
const {
  login,
  seedAdminUser,
  protect,
  restrictTo,
  addUser,
  getAllUsers,
  deleteUser,
  addUserAndSendEmail,
  getUserById,
  getUsersByOrganizer,
  getUserDetails,
  getOrganizerDetails,
  changePassword,
  getUserStats,
  getProfileDetails,
  getSignupStats,
  getLoginActivity,
  updateProfile // Add this line

} = require('../controllers/authController');

const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/login', login);
router.post('/add-user', protect, restrictTo('admin'), addUser);
router.get('/users', protect, restrictTo('admin'), getAllUsers);
router.delete('/users/:id', protect, restrictTo('admin'), deleteUser);
router.post("/add-user-payment", protect, restrictTo("organizer"), addUserAndSendEmail);
router.get("/user/me", protect, restrictTo("user"), getUserById);
router.get("/organizer/users", protect, restrictTo("organizer"), getUsersByOrganizer);
router.get("/user-details", protect, restrictTo("user"), getUserDetails);
router.get("/organizer/details", protect, restrictTo("organizer"), getOrganizerDetails);
router.post('/users/:userId/payment-schedule', paymentController.createPaymentSchedule);
router.get('/users/:organizerId/payments', paymentController.getAllUsersWithPayments);
router.put('/change-password', protect, changePassword);
router.get('/users/stats', protect, restrictTo('admin'), getUserStats);
router.get('/profile', protect, getProfileDetails);
router.put('/profile', protect, updateProfile); // Add this line
router.get('/signup-stats', getSignupStats);
router.get('/users/login-activity', protect, restrictTo('admin'), getLoginActivity);

module.exports = router;