import express from "express";
import { searchPostController } from "../controller/search.controller.js";

const router = express.Router();

router.get("/search", searchPostController);

export default router;
