const authService = require("../services/authService");

async function register(req, res, next) {
  try {
    const user = await authService.register(req.body.email, req.body.password);

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body.email, req.body.password);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
};
