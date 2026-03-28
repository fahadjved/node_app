const express = require("express");
const { handelGetParentsMeeting } = require("../controllers/Parent_handel");
const { handelGetAllStudents } = require("../controllers/Student_handel");
const router = express.Router();
router.get("/meetings/:grade", handelGetParentsMeeting);
router.get("/students", handelGetAllStudents);
module.exports = router;
