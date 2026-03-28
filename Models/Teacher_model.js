const mongoose = require("mongoose");

const TeacherSchema = new mongoose.Schema(
  {
    tea_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    classAssigned: {
      type: String,
      required: true,
    },
    sectionAssigned: {
      type: String,
    },
    subjectAssigned: {
      type: String,
    },
  },
  { timestamps: true },
);
const Teacher = mongoose.model("Teacher", TeacherSchema);
module.exports = { Teacher };
