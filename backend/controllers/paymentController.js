const mongoose = require('mongoose');
// controllers/paymentController.js
const { calculateEMI, generatePaymentSchedule } = require('../utils/calculatePayments');
const UserPayment = require('../models/UserPayment');
const { createNotification } = require('./notificationController');
const twilio = require('twilio');
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.createPaymentSchedule = async (req, res) => {
  try {
    const { userId } = req.params;
    const userPayment = await UserPayment.findById(userId);
    
    if (!userPayment) {
      return res.status(404).json({ message: "User payment details not found" });
    }

    const startDate = new Date();
    const schedule = generatePaymentSchedule(
      userPayment.amountBorrowed,
      userPayment.tenure,
      userPayment.interest,
      startDate
    );

    // Save payment schedule to the database
    userPayment.paymentSchedule = schedule;
    userPayment.monthlyEMI = schedule[0].emiAmount;
    await userPayment.save();

    res.status(200).json({
      message: "Payment schedule created successfully",
      schedule,
      monthlyEMI: schedule[0].emiAmount
    });
  } catch (error) {
    console.error("Error creating payment schedule:", error);
    res.status(500).json({ message: "Error creating payment schedule" });
  }
};
exports.updatePaymentDetails = async (req, res) => {
  try {
    const { userId, serialNo } = req.params;
    const { emiAmount, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const userPayment = await UserPayment.findById(userId);
    if (!userPayment) {
      return res.status(404).json({ message: "User payment details not found" });
    }

    // Calculate original total amount with interest
    const totalAmountWithInterest = Number(
      (userPayment.amountBorrowed * (1 + (userPayment.interest * userPayment.tenure / 1200))).toFixed(2)
    );

    const currentIndex = userPayment.paymentSchedule.findIndex(
      p => p.serialNo === Number(serialNo)
    );

    if (currentIndex === -1) {
      return res.status(404).json({ message: "Payment schedule entry not found" });
    }

    const payment = userPayment.paymentSchedule[currentIndex];

    // Handle EMI amount update
    if (emiAmount !== undefined) {
      const newEmiAmount = Number(parseFloat(emiAmount).toFixed(2));
      
      // Validate EMI amount
      if (isNaN(newEmiAmount) || newEmiAmount < 0) {
        return res.status(400).json({ message: "Invalid EMI amount" });
      }

      // Calculate total paid amount up to current payment
      const paidAmount = userPayment.paymentSchedule
        .slice(0, currentIndex)
        .reduce((acc, p) => acc + (p.status === 'PAID' ? Number(p.emiAmount) : 0), 0);
      
      // Calculate remaining amount with interest
      const remainingAmountWithInterest = Number((totalAmountWithInterest - paidAmount).toFixed(2));

      // Validate if new amount exceeds remaining amount with interest
      if (newEmiAmount > remainingAmountWithInterest) {
        return res.status(400).json({ 
          message: `Amount cannot exceed remaining balance of ${formatCurrency(remainingAmountWithInterest)}` 
        });
      }

      // Update current payment
      payment.emiAmount = newEmiAmount;

      // Recalculate remaining payments
      if (currentIndex < userPayment.paymentSchedule.length - 1) {
        const remainingPayments = userPayment.paymentSchedule.length - currentIndex - 1;
        const amountToDistribute = remainingAmountWithInterest - newEmiAmount;
        
        if (remainingPayments > 0) {
          const equalShare = Number((amountToDistribute / remainingPayments).toFixed(2));
          let distributedAmount = 0;

          for (let i = currentIndex + 1; i < userPayment.paymentSchedule.length; i++) {
            if (i === userPayment.paymentSchedule.length - 1) {
              userPayment.paymentSchedule[i].emiAmount = Number(
                (amountToDistribute - distributedAmount).toFixed(2)
              );
            } else {
              userPayment.paymentSchedule[i].emiAmount = equalShare;
              distributedAmount += equalShare;
            }
          }
        }
      }

      // Recalculate balances and handle auto-payment logic
      let runningBalance = totalAmountWithInterest;
      let previousPaidWithBalance = false;

      // First pass: Reset all auto-paid entries after current payment
      for (let i = currentIndex + 1; i < userPayment.paymentSchedule.length; i++) {
        const payment = userPayment.paymentSchedule[i];
        if (payment.locked && payment.emiAmount === 0) {
          payment.status = 'PENDING';
          payment.locked = false;
          payment.paidDate = null;
        }
      }

      // Second pass: Recalculate balances and auto-payments
      for (const p of userPayment.paymentSchedule) {
        // Calculate new balance after current payment
        runningBalance = Number((runningBalance - p.emiAmount).toFixed(2));
        p.balance = Math.max(0, runningBalance);

        // Check if previous payment was properly paid
        if (previousPaidWithBalance) {
          if (p.balance === 0 && !p.locked) {
            // Only auto-mark as paid if not manually paid before
            p.emiAmount = 0;
            p.status = 'PAID';
            p.paidDate = new Date();
            p.locked = true;
          } else {
            // Break the chain if balance is not zero
            previousPaidWithBalance = false;
          }
        }

        // Update flag for next iteration - only set true if current payment meets all conditions
        previousPaidWithBalance = (
          p.status === 'PAID' && 
          p.emiAmount > 0 && 
          p.balance === 0
        );
      }

      // Verify total amount consistency
      const newTotal = userPayment.paymentSchedule.reduce(
        (acc, p) => acc + Number(p.emiAmount), 
        0
      );

      if (Math.abs(newTotal - totalAmountWithInterest) > 0.01) {
        throw new Error('Payment schedule validation failed: Total amount mismatch');
      }
    }

    // Handle manual status update (with receipt generation)
    if (status && !payment.locked) {
      payment.status = status;
      
      if (status === 'PAID') {
        payment.paidDate = new Date();
        payment.locked = true;

        // Only generate receipt if amount is greater than 0
        if (payment.emiAmount > 0) {
          const receipt = {
            receiptNumber: `RCPT-${Date.now()}-${payment.serialNo}`,
            paymentDate: new Date(),
            amount: payment.emiAmount,
            serialNo: payment.serialNo
          };

          userPayment.receipts.push(receipt);

          await Promise.all([
            createNotification(
              userPayment._id,
              'Payment Receipt Generated',
              `Payment of ${formatCurrency(payment.emiAmount)} for EMI ${payment.serialNo} is completed.`,
              'PAYMENT',
              { receipt }
            ),
            sendPaymentEmail(userPayment, payment, receipt)
          ]);
        }

        // Automatically mark subsequent zero-amount payments as PAID
        for (let i = currentIndex + 1; i < userPayment.paymentSchedule.length; i++) {
          const nextPayment = userPayment.paymentSchedule[i];
          if (nextPayment.emiAmount === 0 && nextPayment.balance === 0 && nextPayment.status === 'PENDING') {
            nextPayment.status = 'PAID';
            nextPayment.paidDate = new Date();
            nextPayment.locked = true;
            // No receipt generation for zero-amount payments
          } else {
            break; // Stop if we encounter a non-zero payment
          }
        }
      }
    }

    await userPayment.save();

    res.json({
      message: "Payment details updated successfully",
      schedule: userPayment.paymentSchedule,
      amountBorrowed: userPayment.amountBorrowed,
      totalAmountWithInterest,
      remainingBalance: userPayment.paymentSchedule
        .filter(p => p.status !== 'PAID')
        .reduce((acc, p) => acc + p.emiAmount, 0)
    });

  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({
      message: 'Error updating payment',
      error: error.message
    });
  }
};

exports.getAllUsersWithPayments = async (req, res) => {
  try {
    const { organizerId } = req.params;
    const users = await UserPayment.find({ organizerId })
      .select('name email mobileNumber amountBorrowed tenure interest monthlyEMI paymentSchedule')
      .sort({ name: 1 });

    res.status(200).json({
      message: "Users fetched successfully",
      users
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
};

// Helper functions
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR' 
  }).format(amount);
};

const sendPaymentEmail = async (user, payment, receipt) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: `Payment Receipt - ${receipt.receiptNumber}`,
    html: `
      <h2>Payment Receipt</h2>
      <p>Hello ${user.name},</p>
      <p>Your payment details:</p>
      <ul>
        <li>Receipt Number: ${receipt.receiptNumber}</li>
        <li>Amount: ${formatCurrency(receipt.amount)}</li>
        <li>EMI Number: ${receipt.serialNo}</li>
        <li>Payment Date: ${receipt.paymentDate.toLocaleDateString()}</li>
      </ul>
      <p>Thank you for your payment!</p>
    `
  };
  await transporter.sendMail(mailOptions);
};

const sendPaymentSMS = async (user, payment, receipt) => {
  const message = `Payment of ${formatCurrency(receipt.amount)} received. Receipt No: ${receipt.receiptNumber}. EMI: ${receipt.serialNo}. Date: ${receipt.paymentDate.toLocaleDateString()}`;
  
  await twilioClient.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: user.mobileNumber
  });
};

exports.getAllUsersWithPayments = async (req, res) => {
  try {
    const { organizerId } = req.params;
    const users = await UserPayment.find({ organizerId })
      .select('name email mobileNumber amountBorrowed tenure interest monthlyEMI paymentSchedule')
      .sort({ name: 1 });

    res.status(200).json({
      message: "Users fetched successfully",
      users
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
};

exports.getDayAnalytics = async (req, res) => {
    try {
        const { date } = req.params;
        const organizerId = req.user._id; // Get organizer ID from authenticated user

        // Get start and end of the day
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        // Find all payments for this day
        const payments = await UserPayment.aggregate([
            {
                $match: {
                    organizerId: new mongoose.Types.ObjectId(organizerId)
                }
            },
            {
                $unwind: '$paymentSchedule'
            },
            {
                $match: {
                    'paymentSchedule.paymentDate': {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $project: {
                    name: 1,
                    'paymentSchedule.emiAmount': 1,
                    'paymentSchedule.status': 1,
                    'paymentSchedule.paymentDate': 1,
                    'paymentSchedule.paidDate': 1
                }
            }
        ]);

        // Calculate analytics
        const totalCollections = payments.reduce((sum, payment) => 
            payment.paymentSchedule.status === 'PAID' ? sum + payment.paymentSchedule.emiAmount : sum, 0);

        const totalPending = payments.reduce((sum, payment) => 
            payment.paymentSchedule.status === 'PENDING' ? sum + payment.paymentSchedule.emiAmount : sum, 0);

        const paidCount = payments.filter(p => p.paymentSchedule.status === 'PAID').length;
        const pendingCount = payments.filter(p => p.paymentSchedule.status === 'PENDING').length;

        res.json({
            totalCollections,
            totalPending,
            netProfit: totalCollections,
            totalPayments: payments.length,
            paidCount,
            pendingCount,
            payments: payments.map(p => ({
                userName: p.name,
                amount: p.paymentSchedule.emiAmount,
                status: p.paymentSchedule.status,
                time: p.paymentSchedule.paidDate || p.paymentSchedule.paymentDate
            }))
        });

    } catch (error) {
        console.error('Error fetching day analytics:', error);
        res.status(500).json({ message: 'Error fetching day analytics', error: error.message });
    }
};

exports.getMonthAnalytics = async (req, res) => {
    try {
        const { month } = req.params; // Format: YYYY-MM
        const organizerId = req.user._id; // Get organizer ID from authenticated user

        // Get start and end of the month
        const startDate = new Date(`${month}-01`);
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);

        // Find all payments for this month
        const payments = await UserPayment.aggregate([
            {
                $match: {
                    organizerId: new mongoose.Types.ObjectId(organizerId)
                }
            },
            {
                $unwind: '$paymentSchedule'
            },
            {
                $match: {
                    'paymentSchedule.paymentDate': {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$paymentSchedule.paymentDate" }
                    },
                    totalCollections: {
                        $sum: {
                            $cond: [
                                { $eq: ["$paymentSchedule.status", "PAID"] },
                                "$paymentSchedule.emiAmount",
                                0
                            ]
                        }
                    },
                    totalPending: {
                        $sum: {
                            $cond: [
                                { $eq: ["$paymentSchedule.status", "PENDING"] },
                                "$paymentSchedule.emiAmount",
                                0
                            ]
                        }
                    },
                    paidCount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$paymentSchedule.status", "PAID"] },
                                1,
                                0
                            ]
                        }
                    },
                    pendingCount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$paymentSchedule.status", "PENDING"] },
                                1,
                                0
                            ]
                        }
                    },
                    totalPayments: { $sum: 1 }
                }
            }
        ]);

        // Convert array to object with dates as keys
        const monthData = payments.reduce((acc, day) => {
            acc[day._id] = {
                totalCollections: day.totalCollections,
                totalPending: day.totalPending,
                paidCount: day.paidCount,
                pendingCount: day.pendingCount,
                totalPayments: day.totalPayments
            };
            return acc;
        }, {});

        res.json(monthData);

    } catch (error) {
        console.error('Error fetching month analytics:', error);
        res.status(500).json({ message: 'Error fetching month analytics', error: error.message });
    }
};

// Add this new endpoint
exports.bulkUpdatePayments = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startIndex, markAsPaid } = req.body;

    const userPayment = await UserPayment.findById(userId);
    if (!userPayment) {
      return res.status(404).json({ message: "User payment details not found" });
    }

    // Update all remaining payments that have zero amount
    for (let i = startIndex; i < userPayment.paymentSchedule.length; i++) {
      const payment = userPayment.paymentSchedule[i];
      if (payment.emiAmount === 0 && payment.balance === 0 && payment.status === 'PENDING') {
        payment.status = 'PAID';
        payment.paidDate = new Date();
        payment.locked = true;
        // No receipt generation for these automatic updates
      }
    }

    await userPayment.save();

    res.json({
      message: "Payments updated successfully",
      schedule: userPayment.paymentSchedule
    });

  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      message: 'Error updating payments',
      error: error.message
    });
  }
};


