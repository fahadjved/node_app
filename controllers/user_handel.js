const { User } = require("../Models/User_models");

async function handelAdminCreation(req, res) {
  try {
    const { name, email, password, PhoneNumber } = req.body;
    console.log(req.body);
    const user = await User.create({
      name: name,
      email: email,
      password: password,
      PhoneNumber: PhoneNumber,
      role: "Admin",
    });
    return res.status(201).json({
      success: true,
      message: "Admin created successfully",
      user: user._id,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Error creating admin",
    });
  }
}

async function handelAdminLogin(req, res) {
  try {
    const { email, password } = req.body;
    const token = await User.comparePassword(email, password);
    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
    });
  } catch (error) {
    console.log(error);
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }
}

module.exports = { handelAdminCreation, handelAdminLogin };
