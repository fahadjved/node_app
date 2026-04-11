const { Meeting } = require("../Models/Meeting_model");

async function handleMeetingCreation(req, res) {
  try {
    const { teacher, grade, date, startTime, endTime } = req.body;
    const meeting = new Meeting({
      teacher,
      grade,
      date,
      startTime,
      endTime,
    });
    await meeting.save();
    return res.status(201).json({
      success: true,
      message: "Meeting created successfully",
      meeting_id: meeting._id,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function handelGetAllMeetings(req, res) {
  const { id } = req.params;
  console.log("Teacher ID:", id); // Debugging log
  try {
   const meetings = await Meeting.find({
  teacher: id,
  status: { $in: ["scheduled", "Live"] }
});
    res.status(200).json({ success: true, meetings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
async function handelGetMeetingId(req, res) {
  try {
    const { id } = req.params;
    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, error: "Meeting not found" });
    }
    res.status(200).json({ success: true, meeting });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
module.exports = {
  handleMeetingCreation,
  handelGetAllMeetings,
  handelGetMeetingId,
};
