const { User } = require("../Models/User_models");
const { Student } = require("../Models/Students_models");
const { Teacher } = require("../Models/Teacher_model");
async function handelStudentCreation(req, res) {
  try {
    const {
      studentname,
      email,
      password,
      PhoneNumber,
      Student_rollNu,
      Class,
      Parentname,
    } = req.body;
    console.log(req.body);
    const teacher = await Teacher.findOne({ classAssigned: Class });
    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, message: "No teacher found for this class" });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email already in use" });
    }
    const existingUserNu = await User.findOne({ PhoneNumber });
    if (existingUserNu) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number already in use" });
    }
    const user = await User.create({
      name: Parentname,
      email: email,
      password: password,
      PhoneNumber: PhoneNumber,
      role: "Parent",
    });
    const existingStudent = await Student.findOne({ Student_rollNu });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: "Student roll number already exists",
      });
    }
    const student = await Student.create({
      Name: studentname,
      Student_rollNu,
      Class,
      Parent_id: user._id,
      Teacher_id: teacher.tea_id,
    });
    res.status(201).json({
      success: true,
      message: "Student created successfully",
      student_id: student._id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating student",
      error: error.message,
    });
  }
}

async function handelGetAllStudents(req, res) {
  try {
    const students = await Student.find();
    res.status(200).json({
      success: true,
      students,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching students",
      error: error.message,
    });
  }
}

module.exports = {
  handelStudentCreation,
  handelGetAllStudents,
};
