const express = require('express');
const router = express.Router();
const UserPayment = require('../models/UserPayment');
const mongoose = require('mongoose');
// Fetch and format payment details
router.get('/finance-payments', async (req, res) => {
  try {
    const payments = await UserPayment.find().populate('organizerId').populate('userId');
    const formattedPayments = payments.map(payment => {
      return payment.paymentSchedule.map(schedule => ({
        sno: schedule.serialNo,
        userName: payment.name,
        dueDate: schedule.paymentDate,
        emiAmount: schedule.emiAmount,
        paymentDate: schedule.paidDate,
        balance: schedule.balance,
        status: schedule.status
      }));
    }).flat();

    console.log('Formatted Payments:', formattedPayments);
    res.json(formattedPayments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/finance-payments/:organizerId/:userId', async (req, res) => {
  try {
    const { organizerId, userId } = req.params;
    
    console.log('Query Parameters:', { organizerId, userId });

    if (!mongoose.Types.ObjectId.isValid(organizerId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid organizerId or userId format' });
    }

    // Convert to ObjectId
    const orgId = new mongoose.Types.ObjectId(organizerId);
    const usrId = new mongoose.Types.ObjectId(userId);

    // Debugging: Print converted IDs
    console.log('Converted ObjectIds:', { orgId, usrId });

    // Find payments for the user under the organizer
    const payments = await UserPayment.find({ organizerId: orgId, _id: usrId })
      .populate('organizerId')
      .populate('userId');

    console.log('Raw Payments:', payments);

    if (!payments || payments.length === 0) {
      return res.status(404).json({ message: 'No payment records found for this user' });
    }

    const formattedPayments = payments.map(payment => {
      return payment.paymentSchedule.map(schedule => ({
        sno: schedule.serialNo,
        userName: payment.name,
        userId: payment.userId?._id,
        organizerId: payment.organizerId?._id,
        dueDate: schedule.paymentDate,
        emiAmount: schedule.emiAmount,
        paymentDate: schedule.paidDate,
        balance: schedule.balance,
        status: schedule.status
      }));
    }).flat();

    console.log('Formatted Payments:', formattedPayments);
    res.json(formattedPayments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;