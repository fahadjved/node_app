const express = require("express");

const { handleUserLogin } = require("../controllers/user_handel");

const router = express.Router();

// teacher routes

router.post("/login", handleUserLogin);

module.exports = router;
