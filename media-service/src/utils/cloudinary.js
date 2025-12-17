import { v2 as cloudinary } from "cloudinary";
import logger from "../utils/logger.js";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_CLOUD_API_KEY,
  api_secret: process.env.CLOUDINARY_CLOUD_API_SECRET,
});

export const uploadMediaToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "auto" },
      (error, result) => {
        if (error) {
          logger.error("Cloudinary upload error", error);
          return reject(error);
        }
        resolve(result);
      }
    );
 logger.info("Cloudinary uploaded successfully" );
    uploadStream.end(file.buffer);
  });
};

export const deleteMediaFromCloudinary = (publicId) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        logger.error("Cloudinary delete error", error);
        return reject(error);
      }
      logger.info("Cloudinary delete successfully" );
      resolve(result);
    });
  });
};
