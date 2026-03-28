const { Teacher } = require("../Models/Teacher_model");
const { User } = require("../Models/User_models");
const { verifyToken } = require("../Auth/Auth");

async function handelTeacherCreation(req, res) {
  try {
    const { name, email, password, PhoneNumber, classAssigned } = req.body;
    console.log(req.body);
    const user = await User.create({
      name: name,
      email: email,
      password: password,
      PhoneNumber: PhoneNumber,
      role: "Teacher",
    });
    const teacher = await Teacher.create({
      tea_id: user._id,
      classAssigned,
    });
    res.status(201).json({
      success: true,
      message: "Teacher created successfully",
      teacher_id: teacher._id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating teacher",
      error: error.message,
    });
  }
}
async function handleTeacherLogin(req, res) {
  const { email, password } = req.body;
  console.log(req.body);
  try {
    const token = await User.comparePassword(email, password);
    const decoded = verifyToken(token);
    if (decoded.role == "Teacher") {
      return res
        .status(200)
        .json({ success: true, message: "Login successful", token });
    } else if (decoded.role == "Admin") {
      return res
        .status(200)
        .json({ success: true, message: "Admin login successful", token });
    } else {
      return res
        .status(200)
        .json({ success: true, message: "Parent login successful", token });
    }
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid credentials",
      error: error.message,
    });
  }
}
async function handelGetAllTeachers(req, res) {
  try {
    const teachers = await Teacher.find().populate(
      "tea_id",
      "name email PhoneNumber",
    );
    res.status(200).json({ success: true, teachers });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching teachers",
      error: error.message,
    });
  }
}
module.exports = {
  handelTeacherCreation,
  handleTeacherLogin,
  handelGetAllTeachers,
};
