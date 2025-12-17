import express from "express";
import { createPost, deletePost, getAllPosts, getPost } from "../controller/post.controller.js";
import { authenticateRequest } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(authenticateRequest);

router.post("/createpost", createPost);
router.get("/posts", getAllPosts);
router.get("/post/:id", getPost);
router.delete("/delete-post/:id", deletePost);

export default router;
