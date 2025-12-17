import dotenv from "dotenv";
import amqplib from "amqplib";
import logger from "../utils/logger.js";
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

export async function consumeEvent(routingKey, callback) {
  if (!channel) {
    await connectRabbitmq();
  }
  const q = await channel.assertQueue("", { exclusive: true });
  await channel.bindQueue(q.queue, EXCHANGE_NAME, routingKey);
  channel.consume(q.queue, (msg) => {
    if (msg != null) {
      const content = JSON.parse(msg.content.toString());
      callback(content);
      channel.ack(msg);
    }
  });
  logger.info(`Subscribed to event : ${routingKey}`);
}
