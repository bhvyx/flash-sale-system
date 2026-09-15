const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userRepository = require("../repositories/userRepository");

async function register(email, password) {
  const existingUser = await userRepository.getUserByEmail(email);

  if (existingUser) {
    throw new Error("Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  return await userRepository.createUser(email, passwordHash);
}

async function login(email, password) {
  const user = await userRepository.getUserByEmail(email);

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);

  if (!passwordValid) {
    throw new Error("Invalid email or password");
  }

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
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
    },
  };
}

module.exports = {
  register,
  login,
};
