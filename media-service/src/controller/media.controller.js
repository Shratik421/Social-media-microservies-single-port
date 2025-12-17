import Media from "../models/media.js";
import {
  uploadMediaToCloudinary,
  deleteMediaFromCloudinary,
} from "../utils/cloudinary.js";
import logger from "../utils/logger.js";

export const uploadMedia = async (req, res) => {
  console.log("req : ", req);
  logger.info("Starting media upload");

  try {
    if (!req.file) {
      logger.error("No file found . please add a file and try again");
      return res.status(400).json({
        success: false,
        message: "No file found. please add a file and try again",
      });
    }

    const { originalname, mimetype, buffer } = req.file;

    const userId = req.user.userId;

    logger.info(`File details : name : ${originalname}, type=${mimetype}`);
    logger.info("uploading to cloudinary starting...");

    const cloudinaryResult = await uploadMediaToCloudinary(req.file);
    logger.info(
      `Cloudinary upload successfully. Public Id :- ${cloudinaryResult.public_id}`
    );

    const newlyCreateMedia = new Media({
      publicId: cloudinaryResult.public_id,
      originalName: originalname,
      mimetype,
      url: cloudinaryResult.secure_url,
      userId,
    });

    await newlyCreateMedia.save();

    res.status(201).json({
      success: true,
      mediaId: newlyCreateMedia._id,
      url: newlyCreateMedia.url,
      message: "Media upload is successfuly",
    });
  } catch (error) {
    console.log("error : ", error);
    logger.error("error media post", error);
    return res.status(500).json({
      success: false,
      message: "Error Media uploading error",
    });
  }
};

export const getAllmedia = async (req, res) => {
  try {
    const results  = await Media.find({});
    res.status(200).json({
      success: true,
      media: results,
    });
  } catch (error) {
    console.log("error : ", error);
    logger.error("error media post", error);
    return res.status(500).json({
      success: false,
      message: "Error Media uploading error",
    });
  }
};
