const { z } = require("zod");

const createPaymentSchema = z.object({
  orderId: z.uuid(),
  outcome: z.enum(["SUCCESS", "FAILED"]),
});

module.exports = {
  createPaymentSchema,
};
