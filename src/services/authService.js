const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userRepository = require("../repositories/userRepository");
const AppError = require("../utils/AppError");

async function register(email, password) {
  const existingUser = await userRepository.getUserByEmail(email);

  if (existingUser) {
    throw new AppError("Email already registered", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  return await userRepository.createUser(email, passwordHash);
}

async function login(email, password) {
  const user = await userRepository.getUserByEmail(email);

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);

  if (!passwordValid) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      isAdmin: user.is_admin,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    },
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      isAdmin: user.is_admin,
    },
  };
}

module.exports = {
  register,
  login,
};
