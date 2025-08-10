const mongoose = require('mongoose');

const savingsGoalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  goalName: {
    type: String,
    required: true,
    trim: true
  },
  targetAmount: {
    type: Number,
    required: true,
    min: 0
  },
  currentAmount: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  targetDate: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Emergency Fund', 'Retirement', 'Education', 'Travel', 'Home', 'Vehicle', 'Wedding', 'Other']
  },
  status: {
    type: String,
    enum: ['In Progress', 'Completed'],
    default: 'In Progress'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
savingsGoalSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('SavingsGoal', savingsGoalSchema);
