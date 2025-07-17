import { Router } from "express";
import { createRazorOrder, verifyRazorPayment } from "../controllers/razorpay.controller.js";

const router = Router()

router.post("/create-order",createRazorOrder )
router.post("/verify-order",verifyRazorPayment )


export default router
