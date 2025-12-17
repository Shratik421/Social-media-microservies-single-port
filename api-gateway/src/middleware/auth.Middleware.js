import { logger } from "../utils/logger.js";
import jwt from "jsonwebtoken";
export const validateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  console.log("token : ",token);

  if (!token) {
    logger.warn(`Access attempt without valid token`);
    return res.status(401).json({
      message: "Authentication required",
      success: false,
    });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      logger.warn("Invalid Token");
      return res.status(429).json({
        message: "Invalid Token",
        success: false,
      });
    }
    req.user = user;
    return next();
  });
};
