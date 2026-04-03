const express = require("express");
const { CheckAuth } = require("../Middlewares/Chech_Auth");
const { CheckRole } = require("../Middlewares/RBAC");
const { handleUserLogin } = require("../controllers/user_handel");

const router = express.Router();

// teacher routes

router.post("/login", handleUserLogin);

module.exports = router;
