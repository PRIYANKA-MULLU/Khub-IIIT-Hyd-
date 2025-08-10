const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide your name'],
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
  },
  mobileNumber: {
    type: String,
    required: [true, 'Please provide your mobile number'],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
  },
  role: {
    type: String,
    enum: ['user', 'organizer', 'admin'],
    default: 'user',
  },
  gender: {
    type: String,
  },
  alternativeMobileNumber: {
    type: String,
  },
  dateOfBirth: {
    type: Date,
  },
  bio: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginHistory: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    deviceInfo: String
  }]
}, {
  timestamps: true // This adds createdAt and updatedAt fields
});

const User = mongoose.model('User', userSchema);

module.exports = User;