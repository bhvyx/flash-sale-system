const pool = require("../db");

async function createOrderTransaction(reservationId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reservationResult = await client.query(
      `SELECT *
             FROM reservations
             WHERE id = $1
             FOR UPDATE`,
      [reservationId],
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

    if (product.total_stock < reservation.quantity) {
      throw new Error("Insufficient inventory");
    }

    const amount = Number(product.price) * reservation.quantity;

    await client.query(
      `UPDATE products
             SET total_stock = total_stock - $1,
                 updated_at = NOW()
             WHERE id = $2`,
      [reservation.quantity, reservation.product_id],
    );

    await client.query(
      `UPDATE reservations
             SET status = 'PURCHASED',
                 updated_at = NOW()
             WHERE id = $1`,
      [reservationId],
    );

    const orderResult = await client.query(
      `INSERT INTO orders
             (user_id, reservation_id, product_id, quantity, amount, status)
             VALUES ($1, $2, $3, $4, $5, 'CONFIRMED')
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

async function getOrderById(id) {
  const result = await pool.query(
    `SELECT *
         FROM orders
         WHERE id = $1`,
    [id],
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
