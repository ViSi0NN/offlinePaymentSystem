import dotenv from "dotenv";
import connectDB from "./db/connectDB.js";
import app from "./app.js";

dotenv.config({
  path: `../.env`,
});

connectDB()
  .then(() => {
    app.on("error", (error) => {
      console.log("ERROR: ", error);
      throw error;
    });
    app.listen(process.env.PORT || 8000, () =>
      console.log(`SERVER STARTED AT ${process.env.PORT || 8000}`)
    );
  })
  .catch((err) => console.log("MONGODB CONNECTION FAILED :", err));