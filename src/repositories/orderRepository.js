const pool = require("../db");

async function createOrderTransaction(reservationId, userId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reservationResult = await client.query(
      `SELECT *
             FROM reservations
             WHERE id = $1
             AND user_id = $2
             FOR UPDATE`,
      [reservationId, userId],
    );

    const reservation = reservationResult.rows[0];

    if (!reservation) {
      throw new Error("Reservation not found");
    }

    if (reservation.status !== "ACTIVE") {
      throw new Error("Reservation is no longer active");
    }

    if (new Date(reservation.expires_at) <= new Date()) {
      throw new Error("Reservation has expired");
    }

    const productResult = await client.query(
      `SELECT *
             FROM products
             WHERE id = $1
             FOR UPDATE`,
      [reservation.product_id],
    );

    const product = productResult.rows[0];

    if (!product) {
      throw new Error("Product not found");
    }

    const amount = Number(product.price) * reservation.quantity;

    const orderResult = await client.query(
      `INSERT INTO orders
             (user_id, reservation_id, product_id, quantity, amount, status)
             VALUES ($1, $2, $3, $4, $5, 'PENDING')
             RETURNING *`,
      [
        reservation.user_id,
        reservation.id,
        reservation.product_id,
        reservation.quantity,
        amount,
      ],
    );

    await client.query("COMMIT");

    return orderResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getOrderById(id, userId) {
  const result = await pool.query(
    `SELECT *
         FROM orders
         WHERE id = $1
         AND user_id = $2`,
    [id, userId],
  );

  return result.rows[0];
}

async function getUserOrders(userId) {
  const result = await pool.query(
    `SELECT *
         FROM orders
         WHERE user_id = $1
         ORDER BY created_at DESC`,
    [userId],
  );

  return result.rows;
}

module.exports = {
  createOrderTransaction,
  getOrderById,
  getUserOrders,
};
