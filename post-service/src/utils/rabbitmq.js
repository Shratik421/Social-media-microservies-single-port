import amqplib from "amqplib";
import logger from "../utils/logger.js";
import dotenv from "dotenv";
dotenv.config();

let connection = null;
let channel = null;

const EXCHANGE_NAME = "post-exchange";

export async function connectRabbitmq() {
  try {
    connection = await amqplib.connect({
      protocol: "amqp",
      hostname: process.env.Rabbitmq_host,
      port: 5672,
      username: process.env.Rabbitmq_username,
      password: process.env.Rabbitmq_password,
    });
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE_NAME, "topic", {
      durable: true,
    });
    logger.info("✅ Connected to RabbitMq");
  } catch (error) {
    logger.error("Error connecting to RabbitMQ", error.message);
  }
}

export async function publishEvent(routingKey, message) {
  if (!channel) {
    await connectRabbitmq();
  }

  channel.publish(
    EXCHANGE_NAME,
    routingKey,
    Buffer.from(JSON.stringify(message))
  );
  logger.info(`Evenet  publixhed  : ${routingKey}`);
}
