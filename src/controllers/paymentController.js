const paymentService = require("../services/paymentService");

async function processPayment(req, res) {
  try {
    const { orderId, outcome } = req.body;
    const idempotencyKey = req.headers["idempotency-key"];

    const payment = await paymentService.processPayment(
      orderId,
      outcome,
      idempotencyKey,
    );

    res.status(201).json(payment);
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
}

module.exports = {
  processPayment,
};
