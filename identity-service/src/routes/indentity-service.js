import express from "express"
import { loginUser, logoutUser, refreshToken, registerUser } from "../controllers/identity.controller.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh-token", refreshToken);
router.post("/logout", logoutUser);

export default router
