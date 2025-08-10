// routes/userRoutes.js
const express = require('express');
const { getUserById } = require('../controllers/userController'); // Import the user controller
const router = express.Router();
const authController = require('../controllers/authController');  // Import the auth controller
// Make sure the route is correct
router.get('/user/:userId', getUserById);
const UserPayment = require('../models/UserPayment');  // Import your UserPayment model
const mongoose = require('mongoose');
// Route to update payment details
router.patch('/api/payment/:userId/:serialNo', async (req, res) => {
  try {
    const { emiAmount, status } = req.body;  // Extract emiAmount and status from the request body
    const { userId, serialNo } = req.params;  // Extract userId and serialNo from the URL params

    // Find the specific user and payment record to update
    const userPayment = await UserPayment.findOneAndUpdate(
      { userId, "schedule.serialNo": serialNo },  // Search for user and the specific payment schedule
      { 
        $set: { 
          "schedule.$.emiAmount": emiAmount,    // Update the EMI amount
          "schedule.$.status": status           // Update the payment status
        }
      },
      { new: true }  // Return the updated document
    );

    if (!userPayment) {
      return res.status(404).json({ message: "Payment schedule not found." });  // If no record is found
    }

    // Send the updated payment schedule back in the response
    res.json({ message: "Payment details updated successfully", schedule: userPayment.schedule });
  } catch (error) {
    console.error("Error updating payment:", error);
    res.status(500).json({ message: "Failed to update payment" });  // Error response
  }
});

// Add this to userRoutes.js
router.get('/receipts', authController.protect, async (req, res) => {
  try {
    const userPayment = await UserPayment.findById(req.user.id);
    if (!userPayment) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ receipts: userPayment.receipts });
  } catch (error) {
    res.status(500).json({ message: "Error fetching receipts" });
  }
});
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

router.put('/change-password', async (req, res) => {
  const { userId } = req.params;
  const { currentPassword, newPassword } = req.body;

  if (!isValidObjectId(userId)) {
    return res.status(400).json({ msg: 'Invalid user ID' });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ msg: 'Current and new passwords are required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Current password is incorrect' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ msg: 'New password cannot be the same as the current password' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ msg: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});


module.exports = router;
