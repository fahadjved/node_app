const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema(
  {
    Name: {
      type: String,
      required: true,
    },
    Student_rollNu: {
      type: String,
      required: true,
      unique: true,
    },
    Class: {
      type: String,
      required: true,
    },
    Parent_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "parent",
    },
    Teacher_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Teacher",
    },
    Section: {
      type: String,
    },
  },
  { timestamps: true },
);

const Student = mongoose.model("Student", StudentSchema);
module.exports = { Student };
