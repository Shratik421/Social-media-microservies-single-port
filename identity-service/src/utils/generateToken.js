import jwt from "jsonwebtoken"
import crypto from "crypto";
import RefreshToken from "../models/RefreshToken.js";


const generateTokens = async (user) => {
  const accessToken =  jwt.sign(
    { userId: user._id, username: user.username },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "1d",
    }
  );

    const refreshToken = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date(Date.now() + 43200 * 1000); // 5 days
    expiresAt.setDate(expiresAt.getDate() + 5); // 5 days

  await RefreshToken.create({
      token: refreshToken,
      user: user._id,
      expiresAt
  })
  return { accessToken, refreshToken };
};


export default generateTokens;