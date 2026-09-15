const productService = require("../services/productService");

async function createProduct(req, res, next) {
  try {
    const { name, price, totalStock } = req.body;

    const product = await productService.createProduct(name, price, totalStock);

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
}

async function getAllProducts(req, res, next) {
  try {
    const products = await productService.getAllProducts();

    res.status(200).json(products);
  } catch (error) {
    next(error);
  }
}

async function getProductById(req, res, next) {
  try {
    const product = await productService.getProductById(req.params.id);

    res.status(200).json(product);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
};
