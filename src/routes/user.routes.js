import { Router } from "express";
import {registerUser, checkBalance, verifyAppOtp, appLogin, fetchTransactions, logoutUser} from "../controllers/user.controller.js"
const router = Router()

router.post("/register", registerUser)
router.get("/balance", checkBalance)
router.get("/login", appLogin)
router.get("/verifyotp", verifyAppOtp)
router.get("/transactions", fetchTransactions)
router.post("/logout", logoutUser)
export default router
