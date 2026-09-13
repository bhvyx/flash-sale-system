const pool = require("../db");

async function createReservationTransaction(
  userId,
  productId,
  quantity,
  expiresAt,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const productResult = await client.query(
      `SELECT *
             FROM products
             WHERE id = $1
             FOR UPDATE`,
      [productId],
    );

    const product = productResult.rows[0];

    if (!product) {
      throw new Error("Product not found");
    }

    if (product.available_stock < quantity) {
      throw new Error("Not enough stock");
    }

    await client.query(
      `UPDATE products
             SET available_stock = available_stock - $1,
                 updated_at = NOW()
             WHERE id = $2`,
      [quantity, productId],
    );

    const reservationResult = await client.query(
      `INSERT INTO reservations
             (user_id, product_id, quantity, expires_at)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
      [userId, productId, quantity, expiresAt],
    );

    await client.query("COMMIT");

    return reservationResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createReservation(userId, productId, quantity, expiresAt) {
  const result = await pool.query(
    `INSERT INTO reservations
         (user_id, product_id, quantity, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
    [userId, productId, quantity, expiresAt],
  );

  return result.rows[0];
}

async function getReservationById(id) {
  const result = await pool.query(
    `SELECT *
         FROM reservations
         WHERE id = $1`,
    [id],
  );

  return result.rows[0];
}

async function getUserReservations(userId) {
  const result = await pool.query(
    `SELECT *
         FROM reservations
         WHERE user_id = $1
         ORDER BY created_at DESC`,
    [userId],
  );

  return result.rows;
}

async function updateStock(id, availableStock) {
  const result = await pool.query(
    `UPDATE products
         SET available_stock = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
    [availableStock, id],
  );

  return result.rows[0];
}

module.exports = {
  createReservationTransaction,
  createReservation,
  getReservationById,
  getUserReservations,
  updateStock,
};
