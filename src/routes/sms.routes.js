import { Router } from "express";
import { smsControllers } from "../controllers/sms.controllers.js";
import { smsCommandRouterMiddleware } from "../middlewares/smsCommand.middleware.js";


const router = Router()

router.post("/v1",smsCommandRouterMiddleware(smsControllers))

export default router