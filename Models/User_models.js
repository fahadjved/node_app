const mongoose = require("mongoose");
const { randomBytes, createHmac } = require("crypto");
const { setToken } = require("../Auth/Auth");
const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    salt: {
      type: String,
    },
    password: {
      type: String,
      required: true,
    },
    PhoneNumber: {
      type: String,
      required: true,
      unique: true,
      match: [/^03\d{9}$/, "Phone number must be 11 digits starting with 03"],
    },
    role: {
      type: String,
      enum: ["Parent", "Admin", "Teacher"],
      required: true,
    },
  },
  { timestamps: true },
);
UserSchema.pre("save", async function () {
  const user = this;
  if (!user.isModified("password")) return;
  const salt = randomBytes(32).toString("hex");
  const hashedpassword = createHmac("sha256", salt)
    .update(user.password)
    .digest("hex");
  user.password = hashedpassword;
  user.salt = salt;
});

UserSchema.static("comparePassword", async function (email, password) {
  const user = await this.findOne({ email });
  if (!user) {
    throw new Error("User not found");
  }
  const hashedPassword = await createHmac("sha256", user.salt)
    .update(password)
    .digest("hex");
  if (hashedPassword !== user.password) {
    throw new Error("Invalid password");
  }
  const token = setToken(user);
  return token;
});
const User = mongoose.model("User", UserSchema);
module.exports = { User };
