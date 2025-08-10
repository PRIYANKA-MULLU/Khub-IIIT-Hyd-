const mongoose = require('mongoose');

const paymentScheduleSchema = new mongoose.Schema({
  serialNo: Number,
  paymentDate: Date,
  paidDate: {
    type: Date,
    default: null
  },
  emiAmount: Number,
  principal: Number,
  interest: Number,
  balance: Number,
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'OVERDUE', 'PAYMENT', 'NO DUE'],
    default: 'PENDING'
  },
  locked: {
    type: Boolean,
    default: false
  }
});

const receiptSchema = new mongoose.Schema({
  receiptNumber: String,
  paymentDate: Date,
  amount: Number,
  serialNo: Number,
  paymentMethod: {
    type: String,
    default: 'Cash'
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
});

const userPaymentSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  name: String,
  email: String,
  mobileNumber: String,
  password: String,
  amountBorrowed: Number,
  tenure: Number,
  interest: Number,
  surityGiven: String, // New field for Surity Given
  organizerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  monthlyEMI: Number,
  paymentSchedule: [paymentScheduleSchema],
  loginCredentials: {
    username: String,
    password: String
  },
  receipts: [receiptSchema]

}, { timestamps: true });

userPaymentSchema.pre('save', async function (next) {
  if (this.isModified('paymentSchedule')) {
    console.log('Payment schedule updated for user:', this.name);
  }
  next();
});

module.exports = mongoose.model('UserPayment', userPaymentSchema);