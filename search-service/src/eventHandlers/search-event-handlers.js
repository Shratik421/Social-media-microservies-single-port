import SearchPost from "../models/search.js";
import logger from "../utils/logger.js";

export async function handlePostCreated(event) {
  try {
    const newCreatedPost = await SearchPost({
      postId: event.postId,
      userId: event.userId,
      content: event.content,
      createdAt: event.createdAt,
    });
    await newCreatedPost.save();
    logger.info("Post created successfully ", newCreatedPost);
  } catch (error) {
    logger.error("Error deleting post", error);
  }
}


export async function handlerPostDeleted(event) {
  try {
    await SearchPost.deleteMany({ postId: event.postId });
    logger.info("Post deleted successfully");
  } catch (error) {
    logger.error("Error deleting post", error);
  }
}
