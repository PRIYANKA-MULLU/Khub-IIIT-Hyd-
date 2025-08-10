const UserPayment = require('../models/UserPayment'); // Adjust path as necessary

const autoUpdateOverdueStatus = async () => {
  try {
    const users = await UserPayment.find();

    users.forEach(async (user) => {
      user.paymentSchedule.forEach(payment => {
        if (new Date(payment.paymentDate) < new Date() && payment.status === 'PENDING') {
          payment.status = 'OVERDUE';
        }
      });
      await user.save();
    });
    console.log("Overdue statuses updated successfully.");
  } catch (error) {
    console.error("Error updating overdue statuses:", error);
  }
};

// Schedule the job to run daily
setInterval(autoUpdateOverdueStatus, 24 * 60 * 60 * 1000); // Runs every 24 hours

module.exports = autoUpdateOverdueStatus;
