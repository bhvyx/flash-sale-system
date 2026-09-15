const paymentRepository = require("../repositories/paymentRepository");

async function processPayment(orderId, paymentOutcome, idempotencyKey, userId) {
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
