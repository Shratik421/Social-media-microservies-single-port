import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import Redis from "ioredis";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { logger } from "./utils/logger.js";
import proxy from "express-http-proxy";
import { errorHandler } from "./middleware/errorHandler.js";
import { validateToken } from "./middleware/auth.Middleware.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
// app.use(express.json());

// const redisClient = new Redis(process.env.REDIS_URL);
let redisClient = null;
let useRedis = false;
let rateLimitMiddleware;

console.log("redisClient : ", redisClient);
console.log("useRedis : ", useRedis);
console.log("rateLimitMiddleware : ", rateLimitMiddleware);

try {
  redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    // Configure Redis to fail fast instead of retrying indefinitely
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableOfflineQueue: false,
    connectTimeout: 5000,
    lazyConnect: true, // Don't connect immediately
  });

  // Handle Redis connection events
  redisClient.on("connect", () => {
    logger.info("Redis connected successfully");
    useRedis = true;
  });

  redisClient.on("error", (err) => {
    console.log("error : ", err);
    logger.warn(
      "Redis connection failed, using memory store for rate limiting:",
      err.message
    );
    useRedis = false;
  });

  redisClient.on("close", () => {
    logger.warn("Redis connection closed, falling back to memory store");
    useRedis = false;
  });

  // Test the connection
  redisClient.connect().catch((err) => {
    console.log("error : ", err);
    logger.warn("Failed to connect to Redis on startup:", err.message);
    useRedis = false;
  });
} catch (error) {
  console.log("error : ", error);
  logger.warn(
    "Redis initialization failed, using memory store:",
    error.message
  );
  redisClient = null;
  useRedis = false;
}

app.use(helmet());
app.use(cors());

//rate limiting

// Step 2: Create rate limiter function
const createRateLimiter = () => {
  if (useRedis && redisClient?.status === "ready") {
    logger.info("Using Redis for rate limiting");
    return rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message:
        "Too many requests from this IP, please try again after 15 minutes",
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn(`Rate limit triggered for IP: ${req.ip}`);
        res.status(429).json({
          success: false,
          message: "Too many requests from this IP, please try again later",
        });
      },
      store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
      }),
    });
  } else {
    logger.warn("Using memory store for rate limiting");
    return rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message:
        "Too many requests from this IP, please try again after 15 minutes",
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn(`Rate limit triggered for IP: ${req.ip}`);
        res.status(429).json({
          success: false,
          message: "Too many requests from this IP, please try again later",
        });
      },
    });
  }
};

// Apply rate limiting
rateLimitMiddleware = createRateLimiter();
app.use(rateLimitMiddleware);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body: ${JSON.stringify(req.body)}`);
  if (req.is("multipart/form-data")) {
    return next();
  }
  express.json()(req, res, next);
});

const proxyOptions = {
  proxyReqPathResolver: (req) => {
    return req.originalUrl.replace(/^\/v1/, "/api");
  },
  proxyErrorHandler: (err, res, next) => {
    logger.error(`Proxy error : ${err.message}`);
    console.log("Error in proxy error handler : ", err);
    console.log("Error in proxy error handler : ", err.message);
    res.status(500).json({
      message: `Internal server error : ${err.message}`,
      error: err?.message,
    });
    next();
  },
};

//setting up oproxy for identity service
app.use(
  "/v1/auth",
  proxy(process.env.IDENTITY_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // proxyReqOpts.headers["x-forwarded-host"] = srcReq.headers.host;
      proxyReqOpts.headers["Content-Type"] = "application/json";
      console.log("Request sent to Identity Service : ", proxyReqOpts);
      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      const resBody = proxyResData.toString("utf-8");
      console.log("resBody : ", resBody);
      console.log("Response received from Identity Service : ", resBody);
      logger.info(
        `Response received from Identity Service : ${proxyResData.statusCode}`
      );
      logger.info(`Response received from Identity Service : ${resBody}`);
      console.log("Response received from Identity Service : ", proxyResData);
      try {
        return JSON.parse(resBody);
      } catch (error) {
        console.log("error : ", error);
        console.log("error : ", error.message);
        logger.warn("Failed to parse proxy response as JSON:", error.message);
        return resBody;
      }
    },
  })
);

//setting proxy for the our post service
app.use(
  "/v1/posts",
  validateToken,
  proxy(process.env.POST_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["Content-Type"] = "application/json";
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      console.log("Request sent to Identity Service : ", proxyReqOpts);
      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      const resBody = proxyResData.toString("utf-8");
      console.log("resBody : ", resBody);
      console.log("Response received from Post Service : ", resBody);
      logger.info(
        `Response received from Post Service : ${proxyResData.statusCode}`
      );
      logger.info(`Response received from Post Service : ${resBody}`);
      console.log("Response received from Post Service : ", proxyResData);
      try {
        return JSON.parse(resBody);
      } catch (error) {
        console.log("error : ", error);
        console.log("error : ", error.message);
        logger.warn("Failed to parse proxy response as JSON:", error.message);
        return resBody;
      }
    },
  })
);

//setting proxy for the our media service
app.use(
  "/v1/media",
  validateToken,
  proxy(process.env.Media_SERVICE_URL, {
    proxyReqPathResolver: (req) => {
      return req.originalUrl.replace(/^\/v1/, "/api");
    },

    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // DO NOT override content-type for multipart
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      return proxyReqOpts;
    },

    parseReqBody: false, // 🚨 REQUIRED for file uploads
  })
);

//setting proxy for the our search service
app.use(
  "/v1/search",
  validateToken,
  proxy(process.env.SEARCH_SERVICE_URL, {
    proxyReqPathResolver: (req) => {
      return req.originalUrl.replace(/^\/v1/, "/api");
    },

    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // DO NOT override content-type for multipart
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      return proxyReqOpts;
    },

    parseReqBody: false, // 🚨 REQUIRED for file uploads
  })
);

app.use(errorHandler);

app.listen(process.env.PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Api gateway service is running on PORT ${process.env.PORT}`);
  logger.info(
    `Identity service is running on PORT ${process.env.IDENTITY_SERVICE_URL}`
  );
  logger.info(
    `Post service is running on PORT ${process.env.POST_SERVICE_URL}`
  );
  logger.info(
    `Media service is running on PORT ${process.env.Media_SERVICE_URL}`
  );

  //   logger.info(`Redius URL ${process.env.REDIS_URL}`);
  console.log("Server is running on port", PORT);
});

//api routing services
//api-gateway -> /v1/auth/register ->3000
// identity api -> /api/auth/register -> 3001

//localhost:3000/v1/auth/register -> localhost:3001/api/auth/register
//explain this above step
