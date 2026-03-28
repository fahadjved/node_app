const express = require("express");
const { CheckAuth } = require("../Middlewares/Chech_Auth");
const { CheckRole } = require("../Middlewares/RBAC");
const { handleTeacherLogin } = require("../controllers/Teacher_handel");

const router = express.Router();

// teacher routes

router.post("/login", handleTeacherLogin);

module.exports = router;
