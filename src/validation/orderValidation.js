const { z } = require("zod");

const createOrderSchema = z.object({
  reservationId: z.uuid(),
});

module.exports = {
  createOrderSchema,
};
