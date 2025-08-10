const express = require('express');
const router = express.Router();
const { submitContactForm } = require('../controllers/contactController');
const contactController = require('../controllers/contactController');
const authController = require('../controllers/authController');
// Define POST route for contact form submission
router.post('/contact', submitContactForm);
router.get('/responses', authController.protect, authController.restrictTo('admin'), contactController.getContactResponses);
module.exports = router;
