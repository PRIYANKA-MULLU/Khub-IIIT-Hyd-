// utils/calculatePayments.js

const calculateEMI = (principal, tenure, interestRate) => {
  const monthlyInterestRate = interestRate / (100 * 12);
  const emi = (principal * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, tenure)) / 
              (Math.pow(1 + monthlyInterestRate, tenure) - 1);
  return Math.round(emi * 100) / 100;
};

const generatePaymentSchedule = (amountBorrowed, tenure, interest, startDate, startSerialNo = 1) => {
  const paymentSchedule = [];
  const monthlyInterestRate = interest / 100 / 12;
  const monthlyEMI = calculateEMI(amountBorrowed, tenure, interest);
  let balance = amountBorrowed;

  // Set start date to next month
  const firstPaymentDate = new Date(startDate);
  firstPaymentDate.setMonth(startDate.getMonth() + 1);
  
  // Handle month-end dates
  const currentDay = startDate.getDate();
  const lastDayOfNextMonth = new Date(firstPaymentDate.getFullYear(), firstPaymentDate.getMonth() + 1, 0).getDate();
  if (currentDay > lastDayOfNextMonth) {
    firstPaymentDate.setDate(lastDayOfNextMonth);
  }

  for (let i = 0; i < tenure; i++) {
    const paymentDate = new Date(firstPaymentDate);
    paymentDate.setMonth(firstPaymentDate.getMonth() + i);

    // Handle month-end dates for subsequent months
    const lastDayOfMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 0).getDate();
    if (firstPaymentDate.getDate() > lastDayOfMonth) {
      paymentDate.setDate(lastDayOfMonth);
    }

    const monthlyInterest = balance * monthlyInterestRate;
    const principal = monthlyEMI - monthlyInterest;

    // Ensure balance doesn't go negative
    const newBalance = Math.max(0, balance - principal);

    paymentSchedule.push({
      serialNo: startSerialNo + i,
      paymentDate,
      emiAmount: Math.round(monthlyEMI),
      principal: i === tenure - 1 ? Math.round(balance) : Math.round(principal),
      interest: Math.round(monthlyInterest),
      balance: Math.round(newBalance),
      status: 'PENDING',
      locked: false,
    });

    balance = newBalance;
  }

  return paymentSchedule;
};

module.exports = { calculateEMI, generatePaymentSchedule };