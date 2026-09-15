const { z } = require("zod");

const createPaymentSchema = z.object({
  orderId: z.uuid(),
  paymentOutcome: z.enum(["SUCCESS", "FAILED"]),
});

module.exports = {
  createPaymentSchema,
};
