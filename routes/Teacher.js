const express = require("express");
const { handelGetAllMeetings } = require("../controllers/Meeting_handle");
const router = express.Router();
router.get("/meetings/:id", handelGetAllMeetings);

module.exports = router;
