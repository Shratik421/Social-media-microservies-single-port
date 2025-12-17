import express from "express";
import multer from "multer";

import { getAllmedia, uploadMedia } from "../controller/media.controller.js";
import { authenticateRequest } from "../middleware/authMiddleware.js";
import logger from "../utils/logger.js";

const router = express.Router();

//configuration multer for file upload;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.post(
  "/upload",
  authenticateRequest,
  // (req, res, next) => {
  //   upload(req, res, (err) => {
  //     console.log("req: ",req)
  //     if (err instanceof multer.MulterError) {
  //       logger.error("Multer error while uploading:", err);
  //       return res.status(400).json({
  //         success: false,
  //         message: err.message,
  //       });
  //     }

  //     console.log("req : ", req.file);

  //     if (err) {
  //       logger.error("Unknown error while uploading:", err);
  //       return res.status(500).json({
  //         success: false,
  //         message: "File upload failed",
  //       });
  //     }

  //     if (!req.file) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "No file uploaded",
  //       });
  //     }

  //     req.file = req.files[0];

  //     next();
  //   });
  // },
  upload.single("file"),
  uploadMedia
);

router.get("/get-all-media", authenticateRequest, getAllmedia);

export default router;
