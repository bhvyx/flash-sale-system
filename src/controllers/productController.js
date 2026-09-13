const productService = require("../services/productService");

async function createProduct(req, res) {
  try {
    const { name, price, totalStock } = req.body;

    const product = await productService.createProduct(name, price, totalStock);

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
}

async function getAllProducts(req, res) {
  try {
    const products = await productService.getAllProducts();

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
}

async function getProductById(req, res) {
  try {
    const product = await productService.getProductById(req.params.id);

    res.status(200).json(product);
  } catch (error) {
    res.status(404).json({
      error: error.message,
    });
  }
}

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
};
