const { Meeting } = require("../Models/Meeting_model");

async function handelGetParentsMeeting(req, res) {
  const { grade } = req.params;
  console.log("Grade:", grade); // Debugging log
  try {
    
    const meetings = await Meeting.find({ grade: grade,status: "scheduled",});

    res.status(200).json({
      success: true,
      meetings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = { handelGetParentsMeeting };
