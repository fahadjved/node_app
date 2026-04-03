const jwt = require("jsonwebtoken");
const secretKey = "PTM@1JsonWebTokenSecretKey";
function setToken(user) {
  const payload = {
    id: user._id,
    name:user.name,
    email: user.email,
    role: user.role,
  };
  const token = jwt.sign(payload, secretKey, { expiresIn: "1h" });
  return token;
}

function verifyToken(token) {
  if (!token) {
    throw new Error("No token provided");
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    return decoded;
  } catch (error) {
    throw new Error("Invalid token");
  }
}

module.exports = { setToken, verifyToken };
