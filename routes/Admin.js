const express = require("express");
const { handleMeetingCreation,handelGetMeetingId } = require("../controllers/Meeting_handle");
const { handelStudentCreation } = require("../controllers/Student_handel");
const {
  handelTeacherCreation,
  handelGetAllTeachers,
} = require("../controllers/Teacher_handel");
const {
  handelAdminCreation,
  handelAdminLogin,
} = require("../controllers/user_handel");

const { CheckAuth } = require("../Middlewares/Chech_Auth");
const { CheckRole } = require("../Middlewares/RBAC");

const router = express.Router();
//router.use(CheckAuth(), CheckRole("Admin"));
router.post(
  "/create-student",
  CheckAuth(),
  CheckRole("Admin"),
  handelStudentCreation,
);
router.post(
  "/create-teacher",
  CheckAuth(),
  CheckRole("Admin"),
  handelTeacherCreation,
);
router.post(
  "/create-meeting",
  CheckAuth(),
  CheckRole("Admin"),
  handleMeetingCreation,
);

router.get("/teachers", CheckAuth(), CheckRole("Admin"), handelGetAllTeachers);
// router.get(
//   "/meetings/:id",
//   CheckAuth(),

//   handelGetMeetingId,
// );
router.post("/create-admin", handelAdminCreation);
router.post("/login-admin", handelAdminLogin);
module.exports = router;
