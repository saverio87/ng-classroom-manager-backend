const mongoose = require("mongoose");

mongoose.Promise = global.Promise;
mongoose
  .connect(
    "mongodb+srv://sav87:c5h11cok@cluster0.hoywx.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
    { useNewUrlParser: true }
  )
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((e) => {
    console.log("Error while attempting to connect to database");
    console.log(e);
  });

module.exports = {
  mongoose,
};
