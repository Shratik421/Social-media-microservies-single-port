import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import mediaRoutes from "./routes/media.routes.js";
dotenv.config();
import logger from "./utils/logger.js";
import errorHandler from "./middleware/errorHandler.js";
import { connectRabbitmq, consumeEvent } from "./utils/rabbitmq.js";
import { handlePostDeleted } from "./eventHandlers/media-event-handlers.js";

const app = express();
const PORT = process.env.PORT || 3003;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("connected to mongodb"))
  .catch((e) => logger.error("Mongodb connection error", e));

app.use(cors());
app.use(helmet());
app.use("/api/media", mediaRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body , ${req.body}`);
  next();
});

app.use(errorHandler);

async function startServer() {
  try {
    await connectRabbitmq();

    await consumeEvent("post.deleted", handlePostDeleted);
    app.listen(PORT, () => {
      logger.info(`Media Server is running on port ${process.env.PORT}`);
      console.log("Media  Server is running on port", process.env.PORT);
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
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
});
