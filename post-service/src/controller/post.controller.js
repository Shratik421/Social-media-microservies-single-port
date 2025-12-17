import logger from "../utils/logger.js";
import Post from "../models/post.js";
import { validateCreatePost } from "../utils/validation.js";
import { publishEvent } from "../utils/rabbitmq.js";

async function invalidatePostCache(req, input) {
  const keys = await req.redisClient.keys("posts:*");
  if (keys.length > 0) {
    await req.redisClient.del(keys);
  }
}

export const createPost = async (req, res) => {
  logger.info("Create post endpoint hit");
  try {
    const { error } = validateCreatePost(req.body);

    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { content, mediaIds } = req.body;
    const newCreatedPost = new Post({
      user: req.user.userId,
      content,
      mediaIds: mediaIds || [],
    });
    await newCreatedPost.save();
    await publishEvent("post.created",{
      postId: newCreatedPost._id.toString(),
      userId: req.user.userId.toString(),
      content:newCreatedPost.content,
      createdAt: newCreatedPost.createdAt
    })
    await invalidatePostCache(req, newCreatedPost._id.toString());
    logger.info("Post created successfully ", newCreatedPost);
    res.status(201).json({
      success: true,
      message: "Post Created successfully",
    });
  } catch (error) {
    logger.error("error creating post", error);
    return res.status(500).json({
      success: false,
      message: "Error creating posts",
    });
  }
};

export const getAllPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;

    const cacheKey = `posts:${page}:${limit}`;
    const cachedPosts = await req.redisClient.get(cacheKey);

    if (cachedPosts) {
      return res.json(JSON.parse(cachedPosts));
    }

    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    const totalNoOfPosts = await Post.countDocuments();

    const result = {
      posts,
      currentpage: page,
      totalPages: Math.ceil(totalNoOfPosts / limit),
      totalPosts: totalNoOfPosts,
    };
    //savepostin redis cachces

    await req.redisClient.setex(cacheKey, 300, JSON.stringify(result));

    res.json(result);
  } catch (error) {
    logger.error("error creating post", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching posts",
    });
  }
};

export const getPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const cacheKey = `post:${postId}`;
    const cachedPost = await req.redisClient.get(cacheKey);
    if (cachedPost) {
      return res.json(JSON.parse(cachedPost));
    }

    const singlePostDetailsbyId = await Post.findById(postId);
    if (!singlePostDetailsbyId) {
      return res.status(400).json({
        message: "Post not found",
        success: false,
      });
    }

    await req.redisClient.setex(
      cachedPost,
      360,
      JSON.stringify(singlePostDetailsbyId)
    );

    res.json(singlePostDetailsbyId);
  } catch (error) {
    logger.error("error creating post", error);
    return res.status(500).json({
      success: false,
      message: "Error get post",
    });
  }
};

export const deletePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const cacheKey = `post:${postId}`;
    const cachedPost = await req.redisClient.get(cacheKey);
    if (cachedPost) {
      await req.redisClient.del(cacheKey);
      return res.json(JSON.parse(cachedPost));
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(400).json({
        message: "Post not found",
        success: false,
      });
    }

    await Post.findByIdAndDelete({ _id: req.params.id, user: req.user.userId });

    await req.redisClient.del(cacheKey);

    //publish post delete method
    await publishEvent("post.deleted", {
      postId: post._id.toString(),
      userId: req.user.userId.toString(),
      mediaIds: post.mediaIds,
    });

    await invalidatePostCache(req, req.params.id);

    res.json({ message: "post deleted successfully" });
  } catch (error) {
    logger.error("error creating post", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting posts",
    });
  }
};
