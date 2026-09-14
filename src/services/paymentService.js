const paymentRepository = require("../repositories/paymentRepository");

async function processPayment(orderId, paymentOutcome) {
  if (!orderId) {
    throw new Error("Order ID is required");
  }

  if (!["SUCCESS", "FAILED"].includes(paymentOutcome)) {
    throw new Error("Invalid payment outcome");
  }

  return await paymentRepository.processPayment(orderId, paymentOutcome);
}

module.exports = {
  processPayment,
};
