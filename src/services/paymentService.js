const paymentRepository = require("../repositories/paymentRepository");

async function processPayment(orderId, paymentOutcome, idempotencyKey, userId) {
  if (!orderId) {
    throw new Error("Order ID is required");
  }

  if (!idempotencyKey) {
    throw new Error("Idempotency key is required");
  }

  if (!["SUCCESS", "FAILED"].includes(paymentOutcome)) {
    throw new Error("Invalid payment outcome");
  }

  return await paymentRepository.processPayment(
    orderId,
    paymentOutcome,
    idempotencyKey,
    userId,
  );
}

module.exports = {
  processPayment,
};
