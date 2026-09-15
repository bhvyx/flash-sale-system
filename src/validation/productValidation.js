const { z } = require("zod");

const createProductSchema = z.object({
  name: z.string().trim().min(1),
  price: z.number().nonnegative(),
  totalStock: z.number().int().nonnegative(),
});

module.exports = {
  createProductSchema,
};
