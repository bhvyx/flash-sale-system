const express = require("express");
const orderController = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.post("/", orderController.createOrder);
router.get("/user/:userId", orderController.getUserOrders);
router.get("/:id", orderController.getOrderById);

module.exports = router;
