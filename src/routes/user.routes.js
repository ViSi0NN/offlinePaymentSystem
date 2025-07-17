import { Router } from "express";
import {registerUser, checkBalance, verifyAppOtp, appLogin} from "../controllers/user.controller.js"
const router = Router()

router.post("/register", registerUser)
router.get("/balance", checkBalance)
router.get("/login", appLogin)
router.get("/verifyotp", verifyAppOtp)


export default router
