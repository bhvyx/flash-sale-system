const express = require("express");
const productController = require("../controllers/productController");
const validate = require("../middleware/validate");
const { createProductSchema } = require("../validation/productValidation");

const router = express.Router();

router.post(
  "/",
  validate(createProductSchema),
  productController.createProduct,
);
router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);

module.exports = router;
