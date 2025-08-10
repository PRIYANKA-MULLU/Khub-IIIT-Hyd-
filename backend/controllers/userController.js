// controllers/userController.js

const User = require('../models/User'); // Import the User model

const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error fetching user data' });
  }
};

module.exports = { getUserById };
