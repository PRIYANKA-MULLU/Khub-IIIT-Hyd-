// fixPasswordHash.js

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User"); // Adjust the path to where your User model is located
const UserPayment = require("../models/UserPayment"); // Adjust the path to where your UserPayment model is located

// MongoDB connection
mongoose.connect("mongodb://localhost:27017/your-database-name", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB", err));

// Function to fix password hashes for both collections
async function fixPasswordHashes() {
  try {
    // Query for users needing password fix
    const users = await User.find({}); // You can add specific conditions like { role: 'user' } if needed

    // Loop through all users to sync passwords
    for (let user of users) {
      console.log(`Processing user: ${user.name} (Mobile: ${user.mobileNumber})`);

      // Check if user has a matching record in the userpayments collection
      const userPayment = await UserPayment.findOne({ mobileNumber: user.mobileNumber });
      if (!userPayment) {
        console.log(`No userpayment record found for ${user.name}`);
        continue;
      }

      // Check if the password in both collections are different
      if (user.password !== userPayment.password || user.password !== userPayment.loginCredentials.password) {
        console.log(`Password mismatch found for ${user.name}. Updating...`);

        // Hash the password using bcrypt
        const hashedPassword = await bcrypt.hash(user.password, 12);

        // Update password in user collection
        user.password = hashedPassword;
        await user.save();
        console.log(`Updated password in User collection for ${user.name}`);

        // Update password in userpayments collection
        userPayment.password = hashedPassword;
        userPayment.loginCredentials.password = hashedPassword;
        await userPayment.save();
        console.log(`Updated password in UserPayment collection for ${user.name}`);
      } else {
        console.log(`Passwords match for ${user.name}. No update needed.`);
      }
    }

    console.log("Password hashes synchronization completed successfully!");
  } catch (error) {
    console.error("Error updating password hashes:", error);
  } finally {
    // Close the MongoDB connection
    mongoose.connection.close();
  }
}

// Execute the function
fixPasswordHashes();
