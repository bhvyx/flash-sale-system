const express = require("express");
const orderController = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const { createOrderSchema } = require("../validation/orderValidation");

const router = express.Router();

router.use(authMiddleware);

router.post("/", validate(createOrderSchema), orderController.createOrder);
router.get("/user/:userId", orderController.getUserOrders);
router.get("/:id", orderController.getOrderById);

module.exports = router;
