const User = require('../models/User');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const UserPayment = require("../models/UserPayment");
const bcrypt = require("bcryptjs");
const { calculateEMI, generatePaymentSchedule } = require('../utils/calculatePayments');
const { createNotification } = require('./notificationController');

exports.login = async (req, res) => {
  try {
    const { mobileNumber, password } = req.body;
    console.log("\n=== Login Attempt ===");
    console.log("Mobile Number:", mobileNumber);

    // Find user with detailed logging
    const user = await User.findOne({ mobileNumber });
    if (user) {
      console.log("\nUser found:", {
        _id: user._id,
        name: user.name,
        role: user.role,
        isActive: user.isActive
      });

      // Check if user is active
      if (!user.isActive) {
        console.log("User account is inactive");
        return res.status(403).json({ message: "Account is not active" });
      }

      // Direct password comparison
      if (password === user.password) {
        // Update last login
        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
          {
            id: user._id,
            role: user.role,
            name: user.name,
            email: user.email,
          },
          process.env.JWT_SECRET,
          { expiresIn: "1h" }
        );

        // Update login tracking
        await User.findByIdAndUpdate(user._id, {
          $set: { lastLogin: new Date() },
          $push: {
            loginHistory: {
              timestamp: new Date(),
              deviceInfo: req.headers['user-agent']
            }
          }
        });

        return res.json({
          token,
          role: user.role,
          name: user.name,
          email: user.email,
          redirect: `/${user.role}`,
        });
      }
    }

    // If we get here, either user wasn't found or password didn't match
    console.log("Authentication failed");
    return res.status(401).json({ message: "Invalid credentials" });

  } catch (error) {
    console.error("\nError during login:", error);
    res.status(500).json({ message: "Server error" });
  }
};


exports.changePassword = async (req, res) => {
  const { mobileNumber, newPassword } = req.body;

  try {
    // Find the user by mobile number
    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(404).json({ success: false, msg: 'Mobile number not found' });
    }

    // Update password in the User model without hashing
    user.password = newPassword;
    await user.save();

    // Update password in the UserPayment model
    await UserPayment.updateMany(
      { mobileNumber },
      { $set: { 'loginCredentials.password': newPassword } }
    );

    res.status(200).json({ success: true, msg: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
};


// Seed initial admin user
exports.seedAdminUser = async () => {
  try {
    const existingAdmin = await User.findOne({
      email: 'admin@financehive.com'
    });

    if (!existingAdmin) {
      const adminUser = new User({
        name: 'Finance Hive Admin',
        email: 'admin@financehive.com',
        mobileNumber: '9999999999',
        password: 'admin@fh',
        role: 'admin'
      });

      await adminUser.save();
      console.log('Admin user seeded successfully');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error seeding admin user:', error);
  }
};

exports.protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = user;  // Attach user info to the request for further use
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

// Role-based authorization
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    next();
  };
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


const twilio = require('twilio');
const fs = require('fs');

const filePath = './image.png'; // Path to your logo
const base64String = fs.readFileSync(filePath, { encoding: 'base64' });

// Initialize Twilio client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

exports.addUser = async (req, res) => {
  try {
    const { name, email, mobileNumber, password, role } = req.body;

    console.log("\n=== Creating New User ===");
    console.log("Role:", role);
    console.log("Mobile Number:", mobileNumber);

    // Create new user without hashing the password
    const newUser = new User({
      name,
      email,
      mobileNumber,
      password,
      role,
      isActive: true
    });

    // Save the user
    await newUser.save();

    // Send email notification
    // const mailOptions = {
    //   from: process.env.EMAIL_USER,
    //   to: email,
    //   subject: 'Your Finance Hive Account Credentials',
    //   html: `
    //     <h2>Welcome to Finance Hive</h2>
    //     <p>Your account has been created with the following credentials:</p>
    //     <p>UserID (Mobile Number): ${mobileNumber}</p>
    //     <p>Password: ${password}</p>
    // <img src="data:image/png;base64,${base64String}" alt="Logo" style="width:100%; max-width:600px;">
    //     <p>Thank you for joining us!</p>
    //     <p>Please login and change your password.</p>
    //   `
    // };
    // console.log(mailOptions.html); // Print the HTML content to verify the image is included

    // await transporter.sendMail(mailOptions);
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Finance Hive Account Credentials',
      html: `
      <h2>Welcome to Finance Hive! 🚀</h2>
      <p>Dear Valued Member,</p>
      <p>We are thrilled to have you join our community at Finance Hive. Your account has been successfully created with the following credentials:</p>
      <p><strong>UserID (Mobile Number):</strong> ${mobileNumber}</p> <p><strong>Password:</strong> ${password}</p>
      <img src="cid:logo" alt="Finance Hive Logo" style="width:100%; max-width:600px;">
      <p>For your security, please log in and change your password at your earliest convenience. We recommend using a strong, unique password that includes a combination of letters, numbers, and special characters.</p>
      <p>If you encounter any issues or have any questions, our support team is here to assist you. You can reach us via email at support@financehive.com.</p>
      <p>We look forward to helping you manage your finances more efficiently and achieve your financial goals. Thank you for choosing Finance Hive! 💼💡</p>
      <p>Best Regards,</p> <p>The Finance Hive Team</p>
      `,
      attachments: [
        {
          filename: 'FH_logoFinal.png',
          path: filePath,
          cid: 'logo', // Same cid as in the html img src
        },
      ],
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(error);
      }
      console.log('Email sent: ' + info.response);
    });

    // Send SMS notification
    const smsMessage = `Welcome to Finance Hive! Your account has been created. UserID: ${mobileNumber}, Password: ${password}. Please login and change your password.`;

    // await twilioClient.messages.create({
    //   body: smsMessage,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: mobileNumber // Ensure mobileNumber includes the country code (e.g., +1234567890)
    // });

    // Create notification for the new user
    await createNotification(
      newUser._id,
      'Welcome to Finance Hive',
      'Your account has been created successfully. Please check your email for login credentials.',
      'CREDENTIALS',
      {
        username: mobileNumber,
        password: password
      }
    );

    res.status(201).json({
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} added successfully`,
      user: {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('\nUser creation error:', error);
    res.status(500).json({
      message: 'Error adding user',
      error: error.message
    });
  }
};

// Get all users (admin and organizer)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({
      role: { $in: ['admin', 'organizer'] }
    }).select('-password');

    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      message: 'Error retrieving users',
      error: error.message
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({
        status: 'fail',
        message: 'No user found with that ID'
      });
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// Get user details by ID (for User Dashboard)

// Update the getUserById controller to include payment schedule
exports.getUserById = async (req, res) => {
  try {
    const user = await UserPayment.findOne({ _id: req.user.id }).populate("organizerId", "name email");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // If payment schedule doesn't exist, generate it
    if (!user.paymentSchedule || user.paymentSchedule.length === 0) {
      const startDate = new Date();
      const schedule = generatePaymentSchedule(
        user.amountBorrowed,
        user.tenure,
        user.interest,
        startDate
      );
      user.paymentSchedule = schedule;
      user.monthlyEMI = schedule[0].emiAmount;
      await user.save();
    }

    res.status(200).json({
      data: {
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        amountBorrowed: user.amountBorrowed,
        tenure: user.tenure,
        interest: user.interest,
        monthlyEMI: user.monthlyEMI,
        paymentSchedule: user.paymentSchedule,
        organizer: user.organizerId
      },
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Error fetching user details." });
  }
};

exports.addUserAndSendEmail = async (req, res) => {
  try {
    const { name, email, mobileNumber, password, amountBorrowed, tenure, interest, surityGiven, role } = req.body;

    // Ensure role is provided and default to "user" if not
    const userRole = role === 'organizer' || role === 'admin' ? role : 'user';

    // Check if user already exists
    const existingUser = await User.findOne({ mobileNumber });

    if (existingUser) {
      // Check payment status
      const userPayment = await UserPayment.findOne({ _id: existingUser._id });

      if (userPayment) {
        const hasOverdueOrPending = userPayment.paymentSchedule.some(
          payment => payment.status === 'OVERDUE' || payment.status === 'PENDING'
        );

        if (hasOverdueOrPending) {
          // Return a response indicating the user has overdue or pending payments
          return res.status(400).json({
            message: `User already exists with overdue or pending payments. Number of EMIs: ${userPayment.paymentSchedule.length}`,
            actionRequired: true
          });
        } else {
          // Calculate the next serialNo
          const lastSerialNo = userPayment.paymentSchedule.length > 0
            ? Math.max(...userPayment.paymentSchedule.map(p => p.serialNo))
            : 0;

          // Generate new payment schedule with correct serialNo
          const startDate = new Date();
          const newPaymentSchedule = generatePaymentSchedule(
            amountBorrowed,
            tenure,
            interest,
            startDate,
            lastSerialNo + 1 // Start serialNo from the next number
          );

          // Recalculate the total amount borrowed, tenure, and monthly EMI
          const updatedAmountBorrowed = userPayment.amountBorrowed + Number(amountBorrowed);
          const updatedTenure = userPayment.tenure + Number(tenure);
          const updatedMonthlyEMI = calculateEMI(updatedAmountBorrowed, updatedTenure, interest);

          // Append the new payment schedule to the existing one
          userPayment.paymentSchedule.push(...newPaymentSchedule);
          userPayment.amountBorrowed = updatedAmountBorrowed;
          userPayment.tenure = updatedTenure;
          userPayment.interest = interest;
          userPayment.surityGiven = surityGiven;
          userPayment.monthlyEMI = updatedMonthlyEMI;

          await userPayment.save();

          return res.status(200).json({
            message: "User payment schedule updated successfully",
            user: userPayment
          });
        }
      }
    } else {
      // Create new user
      const user = new User({
        name,
        email,
        mobileNumber,
        password,
        role: userRole,
      });
      await user.save();

      // Generate payment schedule
      const startDate = new Date();
      const paymentSchedule = generatePaymentSchedule(
        amountBorrowed,
        tenure,
        interest,
        startDate,
        1 // Start serialNo from 1 for new users
      );

      // Calculate monthly EMI
      const monthlyEMI = calculateEMI(amountBorrowed, tenure, interest);

      // Create UserPayment record with payment schedule
      const userPayment = new UserPayment({
        _id: user._id,
        name,
        email,
        mobileNumber,
        password,
        amountBorrowed: Number(amountBorrowed),
        tenure: Number(tenure),
        interest: Number(interest),
        surityGiven,
        organizerId: req.user.id,
        monthlyEMI,
        paymentSchedule,
        loginCredentials: {
          username: mobileNumber,
          password,
        },
      });
      await userPayment.save();

      // Email configuration
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Welcome to ${userRole === 'organizer' ? 'Organizer' : 'User'} Portal`,
        text: `Hello ${name},\n\nWelcome to our platform! You have been successfully added as a ${userRole}.\n\nYour login credentials are:\n\nMobile Number: ${mobileNumber}\nPassword: ${password}\n\nMonthly EMI: ₹${monthlyEMI}\n\nThank you for joining us!`,
      };

      await transporter.sendMail(mailOptions);

      // Send SMS notification
      // const smsMessage = `Welcome to our platform! You have been added as a ${userRole}. Your login credentials are:\n\nMobile Number: ${mobileNumber}\nPassword: ${password}\n\nMonthly EMI: ₹${monthlyEMI}`;

      // await twilioClient.messages.create({
      //   body: smsMessage,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      //   to: mobileNumber // Ensure mobileNumber includes the country code (e.g., +1234567890)
      // });

      // Create profile notification
      await createNotification(
        user._id, // User ID
        `Welcome to User Portal`, // Title
        `You have been successfully added as a user. Your login credentials are:\n\nMobile Number: ${mobileNumber}\nPassword: ${password}\n\nMonthly EMI: ₹${monthlyEMI}`, // Message
        'CREDENTIALS', // Notification type
        {
          username: mobileNumber,
          password: password,
          monthlyEMI: monthlyEMI
        }
      );

      res.status(201).json({
        message: "User added successfully, email and SMS sent!",
        user: userPayment
      });
    }
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ message: "Error adding user.", error: error.message });
  }
};

exports.getUsersByOrganizer = async (req, res) => {
  try {
    const organizerId = req.user.id;  // Get the organizer's ID from the authenticated user
    const users = await UserPayment.find({ organizerId }).select("name email mobileNumber amountBorrowed tenure interest surityGiven");

    if (users.length === 0) {
      return res.status(404).json({ message: "No users found." });
    }

    res.status(200).json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users." });
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find user details and populate organizer information
    const userDetails = await UserPayment.findById(userId)
      .populate('organizerId', 'name email mobileNumber'); // Populate organizer details

    if (!userDetails) {
      return res.status(404).json({ message: "User details not found." });
    }

    res.status(200).json({
      data: {
        ...userDetails.toObject(),
        organizer: userDetails.organizerId // This will contain the populated organizer details
      }
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Error fetching user details." });
  }
};

exports.getOrganizerDetails = async (req, res) => {
  try {
    // Ensure the logged-in user is an organizer
    if (req.user.role !== "organizer") {
      return res.status(403).json({ message: "Access denied. Not an organizer" });
    }

    // Find the organizer details using the authenticated user ID
    const organizer = await User.findById(req.user.id);

    if (!organizer) {
      return res.status(404).json({ message: "Organizer not found" });
    }

    res.status(200).json({ success: true, data: organizer });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
exports.getUserStats = async (req, res) => {
  try {
    const admins = await User.countDocuments({ role: 'admin' });
    const organizers = await User.countDocuments({ role: 'organizer' });
    const users = await User.countDocuments({ role: 'user' }); // Count regular users

    res.status(200).json({ admins, organizers, users });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ message: 'Error fetching user stats' });
  }
};

exports.getProfileDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let financialDetails = {};
    if (user.role === 'user') {
      const userPayment = await UserPayment.findById(userId);
      financialDetails = {
        amountBorrowed: userPayment.amountBorrowed,
        amountPaid: userPayment.paymentSchedule.reduce((acc, payment) => acc + (payment.status === 'PAID' ? payment.emiAmount : 0), 0),
        balance: userPayment.amountBorrowed - userPayment.paymentSchedule.reduce((acc, payment) => acc + (payment.status === 'PAID' ? payment.emiAmount : 0), 0)
      };
    } else if (user.role === 'organizer') {
      const users = await UserPayment.find({ organizerId: userId });
      const amountGiven = users.reduce((acc, user) => acc + user.amountBorrowed, 0);
      const amountCollected = users.reduce((acc, user) => acc + user.paymentSchedule.reduce((acc, payment) => acc + (payment.status === 'PAID' ? payment.emiAmount : 0), 0), 0);
      financialDetails = {
        amountGiven,
        amountCollected,
        profit: amountCollected - amountGiven,
        balance: amountGiven - amountCollected
      };
    }

    res.status(200).json({ ...user.toObject(), ...financialDetails });
  } catch (error) {
    console.error('Error fetching profile details:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { gender, alternativeMobileNumber, dateOfBirth, bio } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { gender, alternativeMobileNumber, dateOfBirth, bio },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSignupStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching signup stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getLoginActivity = async (req, res) => {
  try {
    const { timeframe } = req.query;
    let startDate = new Date();

    // Set historical range based on timeframe
    switch (timeframe) {
      case 'daily':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'weekly':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case 'monthly':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const loginStats = await User.aggregate([
      {
        $unwind: "$loginHistory"
      },
      {
        $match: {
          "loginHistory.timestamp": {
            $gte: startDate,
            $lte: new Date()
          }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$loginHistory.timestamp"
              }
            },
            role: "$role"
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.date": 1 }
      }
    ]);

    const formattedResponse = {
      users: [],
      organizers: []
    };

    loginStats.forEach(stat => {
      const dataset = stat._id.role === 'organizer' ? 'organizers' : 'users';
      formattedResponse[dataset].push({
        date: stat._id.date,
        count: stat.count
      });
    });

    res.json(formattedResponse);
  } catch (error) {
    console.error('Login activity error:', error);
    res.status(500).json({ message: 'Error fetching login activity' });
  }
};