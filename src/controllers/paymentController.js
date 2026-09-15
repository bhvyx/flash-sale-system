const paymentService = require("../services/paymentService");

async function processPayment(req, res, next) {
  try {
    const { orderId, outcome } = req.body;
    const idempotencyKey = req.headers["idempotency-key"];

    const payment = await paymentService.processPayment(
      orderId,
      outcome,
      idempotencyKey,
      req.user.id,
    );

    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  processPayment,
};
