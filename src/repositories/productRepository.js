const pool = require("../db");

async function createProduct(name, price, totalStock) {
  const result = await pool.query(
    `INSERT INTO products (name, price, total_stock, available_stock)
         VALUES ($1, $2, $3, $3)
         RETURNING *`,
    [name, price, totalStock],
  );

  return result.rows[0];
}

async function getAllProducts() {
  const result = await pool.query(
    `SELECT * FROM products
         ORDER BY created_at DESC`,
  );

  return result.rows;
}

async function getProductById(id) {
  const result = await pool.query(
    `SELECT * FROM products
         WHERE id = $1`,
    [id],
  );

  return result.rows[0];
}

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
};
