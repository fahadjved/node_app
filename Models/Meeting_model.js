const mongoose = require("mongoose");
const { Student } = require("./Students_models");

const meetingSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    grade: {
      type: String,
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    startTime: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["scheduled", "Live", "ended"],
      default: "scheduled",
    },
  },
  { timestamps: true },
);
const Meeting = mongoose.model("Meeting", meetingSchema);
module.exports = { Meeting };