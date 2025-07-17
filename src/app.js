import express from "express";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// import
import razorRouter from "./routes/razor.routes.js"
import userRouter from "./routes/user.routes.js"
import smsRouter from "./routes/sms.routes.js"


// routes
app.use("/api/sms/",smsRouter)
app.use("/api/user", userRouter);
app.use("/api/razor", razorRouter);
export default app;
