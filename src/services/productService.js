const productRepository = require("../repositories/productRepository");

async function createProduct(name, price, totalStock) {
  if (!name || price === undefined || totalStock === undefined) {
    throw new Error("Missing required fields");
  }

  if (price < 0) {
    throw new Error("Price cannot be negative");
  }

  if (!Number.isInteger(totalStock) || totalStock < 0) {
    throw new Error("Stock must be a non-negative integer");
  }

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
