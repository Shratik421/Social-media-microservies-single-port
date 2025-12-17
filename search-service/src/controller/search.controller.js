import SearchPost from "../models/search.js";
import logger from "../utils/logger.js";

export const searchPostController = async (req, res) => {
  logger.info("search controller hit!!");

  try {
    const { query } = req.query;
    const results = await SearchPost.find(
      {
        $text: {
          $search: query,
        },
      },
      {
        score: { $meta: "textScore" },
      }
    ).sort({ score: { $meta: "textScore" } }).limit(10);

    res.json(results);
  } catch (error) {
    logger.error("error in search controller", error);
  }
};
