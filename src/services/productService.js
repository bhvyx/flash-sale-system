const productRepository = require("../repositories/productRepository");
const AppError = require("../utils/AppError");

async function createProduct(name, price, totalStock) {
  return await productRepository.createProduct(name, price, totalStock);
}

async function getAllProducts() {
  return await productRepository.getAllProducts();
}

async function getProductById(id) {
  const product = await productRepository.getProductById(id);

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  return product;
}

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
};
