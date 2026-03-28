const mongoose = require("mongoose");

function DBConnection(url) {
  return mongoose.connect(url);
}
module.exports = { DBConnection };
