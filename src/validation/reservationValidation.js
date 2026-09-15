const { z } = require("zod");

const createReservationSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive(),
});

module.exports = {
  createReservationSchema,
};
