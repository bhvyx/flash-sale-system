const express = require("express");
const paymentController = require("../controllers/paymentController");
const authMiddleware = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const { createPaymentSchema } = require("../validation/paymentValidation");

const router = express.Router();

router.use(authMiddleware);

router.post(
  "/",
  validate(createPaymentSchema),
  paymentController.processPayment,
);

module.exports = router;
