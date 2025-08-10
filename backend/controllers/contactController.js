const nodemailer = require('nodemailer');
const ContactForm = require('../models/contactFormModel');
const authController = require('./authController');

// Create a Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Controller for handling the contact form submission
exports.submitContactForm = async (req, res) => {
  const { firstName, lastName, email, mobileNumber, message } = req.body;

  // Save the form data to MongoDB
  const contactData = new ContactForm({
    firstName,
    lastName,
    email,
    mobileNumber, // Add this line
    message,
  });

  try {
    await contactData.save();

    // Set up the email options
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'pannubangaram123@gmail.com',  // Change to your email
      subject: 'New Contact Form Submission',
      text: `
        First Name: ${firstName}
        Last Name: ${lastName}
        Email: ${email}
        Mobile Number: ${mobileNumber} // Add this line
        Message: ${message}
      `,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Error processing the contact form:', error);
    res.status(500).json({ message: 'Failed to send message, please try again later.' });
  }
};

exports.getContactResponses = async (req, res) => {
  try {
    const responses = await ContactForm.find().sort({ createdAt: -1 }); // Sort by latest first
    res.status(200).json(responses);
  } catch (error) {
    console.error('Error fetching contact responses:', error);
    res.status(500).json({ message: 'Failed to fetch contact responses' });
  }
};
