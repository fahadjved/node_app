const mongoose = require("mongoose");

const meetingRoomSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      unique: true,
      index: true,
    },
    teacherId: {
      type: String,
      default: null,
    },
    teacherEmail: {
      type: String,
      default: null,
    },
    currentParentId: {
      type: String,
      default: null,
    },
    currentParentEmail: {
      type: String,
      default: null,
    },
    // Queue of parents waiting
    queue: [
      {
        parentId: { type: String, required: true },
        parentEmail: { type: String, required: true },
        parentName: { type: String, default: "" },
        studentName: { type: String, default: "" },
        joinedQueueAt: { type: Date, default: Date.now },
      },
    ],
    meetingStartedAt: {
      type: Date,
      default: null,
    },
    meetingDurationMinutes: {
      type: Number,
      default: 3,
    },
    status: {
      type: String,
      enum: ["waiting_for_teacher", "Live", "in_meeting", "closed"],
      default: "waiting_for_teacher",
    },
    completedMeetings: [
      {
        parentId: String,
        parentEmail: String,
        parentName: String,
        startedAt: Date,
        endedAt: Date,
      },
    ],
  },
  { timestamps: true },
);

const MeetingRoom = mongoose.model("MeetingRoom", meetingRoomSchema);
module.exports = { MeetingRoom };
