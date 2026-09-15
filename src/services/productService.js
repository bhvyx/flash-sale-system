const productRepository = require("../repositories/productRepository");

async function createProduct(name, price, totalStock) {
  return await productRepository.createProduct(name, price, totalStock);
}

async function getAllProducts() {
  return await productRepository.getAllProducts();
}

async function getProductById(id) {
  const product = await productRepository.getProductById(id);

  if (!product) {
    throw new Error("Product not found");
  }

  return product;
}

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
};
