//user registeratiion
const User = require("../models/User");
const generateTokens = require("../utils/generateToken");
const logger = require("../utils/logger");
const { validateRegistration } = require("../utils/validation");

const registerUser = async (req, res) => {
  logger.info("User registration request received....");

  try {
    //validate the schema
    const { error } = validateRegistration(req.body);

    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { username, email, password } = req.body;
    console.log("req.body", username, email, password);

    // let user = await User.findOne({ email });

    let user = await User.findOne({ $or: [{ email }, { username }] });

    if (user) {
      logger.warn("User already exists");
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    user = new User({
      username,
      email,
      password,
    });

    await user.save();

    logger.warn("User registered successfully", user._id);

    const { accessToken, refreshToken } = await generateTokens(user);
    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.log("error", error);
    logger.error("Internal server error", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//user login

//refresh token

//logout

module.exports = {
  registerUser,
};
