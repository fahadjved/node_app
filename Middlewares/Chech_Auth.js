const { verifyToken } = require("../Auth/Auth");

function CheckAuth() {
  return (req, res, next) => {
    try {
      const chechheader = req.headers.authorization;
      if (!chechheader || !chechheader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
      }
      const token = chechheader.split(" ")[1];
      try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
      } catch (error) {
        throw error;
      }
    } catch (error) {
      res.status(401).json({ message: "Unauthorized", error: error.message });
    }
  };
}

module.exports = { CheckAuth };
