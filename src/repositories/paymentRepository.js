const pool = require("../db");
const AppError = require("../utils/AppError");

async function processPayment(orderId, paymentOutcome, idempotencyKey, userId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingPaymentResult = await client.query(
      `SELECT *
             FROM payments
             WHERE idempotency_key = $1
             FOR UPDATE`,
      [idempotencyKey],
    );

    const existingPayment = existingPaymentResult.rows[0];

    if (existingPayment) {
      if (existingPayment.order_id !== orderId) {
        throw new AppError(
          "Idempotency key already used for another order",
          409,
        );
      }

      await client.query("COMMIT");

      return existingPayment;
    }

    const orderResult = await client.query(
      `SELECT *
             FROM orders
             WHERE id = $1
             AND user_id = $2
             FOR UPDATE`,
      [orderId, userId],
    );

    const order = orderResult.rows[0];

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.status !== "PENDING") {
      throw new Error("Order is no longer pending");
    }

    const reservationResult = await client.query(
      `SELECT *
             FROM reservations
             WHERE id = $1
             FOR UPDATE`,
      [order.reservation_id],
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

    if (paymentOutcome === "FAILED") {
      const paymentResult = await client.query(
        `INSERT INTO payments
                 (order_id, amount, status, idempotency_key)
                 VALUES ($1, $2, 'FAILED', $3)
                 RETURNING *`,
        [order.id, order.amount, idempotencyKey],
      );

      await client.query("COMMIT");

      return paymentResult.rows[0];
    }

    const productResult = await client.query(
      `SELECT *
             FROM products
             WHERE id = $1
             FOR UPDATE`,
      [order.product_id],
    );

    const product = productResult.rows[0];

    if (!product) {
      throw new Error("Product not found");
    }

    if (product.total_stock < order.quantity) {
      throw new Error("Insufficient inventory");
    }

    const paymentId = `PAY-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;

    const paymentResult = await client.query(
      `INSERT INTO payments
             (order_id, amount, status, payment_id, idempotency_key)
             VALUES ($1, $2, 'SUCCESS', $3, $4)
             RETURNING *`,
      [order.id, order.amount, paymentId, idempotencyKey],
    );

    await client.query(
      `UPDATE products
             SET total_stock = total_stock - $1,
                 updated_at = NOW()
             WHERE id = $2`,
      [order.quantity, order.product_id],
    );

    await client.query(
      `UPDATE reservations
             SET status = 'PURCHASED',
                 updated_at = NOW()
             WHERE id = $1`,
      [reservation.id],
    );

    await client.query(
      `UPDATE orders
             SET status = 'CONFIRMED',
                 updated_at = NOW()
             WHERE id = $1`,
      [order.id],
    );

    await client.query("COMMIT");

    return paymentResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  processPayment,
};
