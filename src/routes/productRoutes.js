const express = require("express");
const productController = require("../controllers/productController");
const validate = require("../middleware/validate");
const { createProductSchema } = require("../validation/productValidation");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  validate(createProductSchema),
  productController.createProduct,
);
router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);

module.exports = router;
