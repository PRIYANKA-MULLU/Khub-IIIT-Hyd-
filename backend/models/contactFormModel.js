const mongoose = require('mongoose');

const contactFormSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: false },
  email: { type: String, required: true },
  mobileNumber: { type: String, required: true }, // Add this line
  message: { type: String, required: true },
}, { timestamps: true });

const ContactForm = mongoose.model('ContactForm', contactFormSchema);

module.exports = ContactForm;