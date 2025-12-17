import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import Redis from "ioredis";
import cors from "cors";
import helmet from "helmet";
import searchRoutes from "../src/routes/search.routes.js";
import errorHandler from "../src/middleware/errorHandler.js";
import logger from "./utils/logger.js";
import {connectRabbitmq, consumeEvent} from "./utils/rabbitmq.js";
import { handlePostCreated } from "./eventHandlers/search-event-handlers.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3004;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("Connected to mongodb"))
  .catch((e) => logger.error("Mongodb connection error", e));

// const redisClient = new Redis(process.env.REDIS_URL);
let redisClient;
let isRedisConnected = false;

const connectRedis = async () => {
  try {
    if (process.env.REDIS_URL) {
      redisClient = new Redis(process.env.REDIS_URL, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 5000,
        // Disable automatic reconnection
        enableAutoPipelining: false,
        maxRetriesPerRequest: 1,
        retryDelayOnClusterDown: 300,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 0, // Disable retries
        enableReadyCheck: false,
        // Custom retry strategy - return null to stop retrying
        retryStrategy: (times) => {
          logger.warn(
            `Redis connection attempt ${times} failed. Stopping retries.`
          );
          return null; // Stop retrying
        },
      });
      redisClient.on("connect", () => {
        isRedisConnected = true;
        logger.info("✅ Successfully connected to Redis");
        console.log("✅ Connected to Redis");
      });
      redisClient.on("error", (err) => {
        console.error("Redis connection error:", err);
        isRedisConnected = false;
        logger.warn("⚠️ Redis connection error - falling back to memory store");
        // Don't log the full error object to avoid spam
        console.warn(
          "⚠️ Redis connection failed - Rate limiting will use memory store"
        );
      });
      redisClient.on("close", () => {
        isRedisConnected = false;
        logger.warn("⚠️ Redis connection closed");
      });
      // Try to connect
      await redisClient.connect();
    } else {
      logger.warn("⚠️ No REDIS_URL provided in environment variables");
      console.warn(
        "⚠️ Redis not configured - using memory-based rate limiting"
      );
    }
  } catch (error) {
    console.log("Redis connection error:", error);
    isRedisConnected = false;
    logger.warn("⚠️ Redis connection failed - falling back to memory store");
    console.warn("⚠️ Redis connection failed - falling back to memory store");

    // Disconnect the client to prevent further retry attempts
    if (redisClient) {
      try {
        await redisClient.disconnect();
      } catch (disconnectError) {
        // Ignore disconnect errors
      }
      redisClient = null;
    }
  }
};
connectRedis();

app.use(cors());
app.use(helmet());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body: ${JSON.stringify(req.body)}`);
  next();
});

//routes => pass redis client to routes
app.use(
  "/api/search", searchRoutes);

app.use(errorHandler);

async function startServer() {
  try {
    await connectRabbitmq();
    await consumeEvent("post.created", handlePostCreated);
    await consumeEvent("post.deleted", handlePostCreated);
    app.listen(process.env.PORT, () => {
      logger.info(`search service Server is running on port ${process.env.PORT}`);
      console.log("search service  Server is running on port", process.env.PORT);
    });
  } catch (error) {
    logger.error("Error connecting to RabbitMQ", error.message);
    process.exit(1);
  }
}

startServer();
// // Unhandled promise rejection
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled  Rejection at :", promise, "reason:", reason);
  console.error("Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.log("Uncaught Exception:", error);
  logger.error("Uncaught Exception:", error);
  console.error("Uncaught Exception:", error);
});
