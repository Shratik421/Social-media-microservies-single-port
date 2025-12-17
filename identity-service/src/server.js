import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import winston from "winston";
import morgan from "morgan";
import errorHandler from "./middleware/errorHandler.js";
import logger from "./utils/logger.js";
import { RateLimiterRedis } from "rate-limiter-flexible";
import Redis from "ioredis";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import routes from "./routes/indentity-service.js";
dotenv.config();
// // Global variables for connection status
let redisClient = null;
let isRedisConnected = false;
let isMongoConnected = false;
console.log("process.env.REDIS_URL : ", process.env.REDIS_URL);
console.log("process.env.MONGODB_URI : ", process.env.MONGODB_URI);
console.log("redisClient : ", redisClient);
console.log("isRedisConnected : ", isRedisConnected);
console.log("isMongoConnected : ", isMongoConnected);

//connect to mongoodb
const connectToMongodb = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    isMongoConnected = true;
    logger.info("✅ Successfully connected to MongoDB");
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    isMongoConnected = false;
    logger.error("Mongodb Connection Error");
    console.log("Error : ", error.message);
    console.log("error :", error);
    process.exit(1);
    throw error;
  }

  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => logger.info("✅ Successfully connected to MongoDB"))
    .catch((e) => logger.error("Mongodb Connection Error"));
};
connectToMongodb();

// // Redis Connection with fallback and no auto-retry

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

// // Express app setup
const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

// // Create winston stream for morgan
const morganStream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

app.use(morgan("dev", { stream: morganStream }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body: ${JSON.stringify(req.body)}`);
  next();
});

// // DDOS Protection and Rate Limiting with fallback
const createRateLimiter = () => {
  if (isRedisConnected && redisClient) {
    return new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: "middleware",
      points: 10,
      duration: 1,
    });
  }
  return null;
};
console.log("createRateLimiter : ", createRateLimiter());

// Rate limiting middleware with fallback
app.use((req, res, next) => {
  const rateLimiter = createRateLimiter();
  console.log("rateLimiter : ", rateLimiter);
  if (!rateLimiter) {
    // If Redis is not available, allow the request to pass through
    logger.warn("Rate limiter not available - allowing request");
    return next();
  }

  rateLimiter
    .consume(req.ip)
    .then(() => {
      next();
    })
    .catch((err) => {
      logger.warn(`Rate Limit Exceeded for IP: ${req.ip}`);
      console.log("Rate Limit Exceeded for IP: ", req.ip);
      res.status(429).json({
        success: false,
        message: "Too many requests",
        retryAfter: Math.round(err.msBeforeNext / 1000) || 1,
      });
    });
});

// IP Based Rate Limiting for sensitive endpoints
const createSensitiveEndpointLimiter = () => {
  const limiterConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message:
        "Too many requests from this IP, please try again after 15 minutes",
    },
    standardHeaders: true,
    legacyHeaders: false,
  };

  // Only use Redis store if Redis is connected
  if (isRedisConnected && redisClient) {
    limiterConfig.store = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    });
  }

  return rateLimit(limiterConfig);
};

// Apply sensitive endpoint limiter to routes
app.use("/api/auth/register", (req, res, next) => {
  const sensitiveEndpointLimiter = createSensitiveEndpointLimiter();
  console.log("Sensitive Endpoint Limiter : ", sensitiveEndpointLimiter);
  console.log("/api/auth/register called");
  sensitiveEndpointLimiter(req, res, next);
});

// Routes
app.use("/api/auth", routes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    connections: {
      mongodb: isMongoConnected,
      redis: isRedisConnected,
    },
  });
});

app.use(errorHandler);

app.listen(process.env.PORT, () => {
  logger.info(`Server is running on port ${process.env.PORT}`);
  console.log("Server is running on port", process.env.PORT);
});

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
