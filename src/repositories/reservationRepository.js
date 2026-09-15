const pool = require("../db");
const AppError = require("../utils/AppError");

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
      throw new AppError("Product not found", 404);
    }

    if (product.available_stock < quantity) {
      throw new AppError("Not enough stock", 400);
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

async function getReservationById(id, userId) {
  const result = await pool.query(
    `SELECT *
         FROM reservations
         WHERE id = $1
         AND user_id = $2`,
    [id, userId],
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

async function expireReservation(id) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reservationResult = await client.query(
      `SELECT *
             FROM reservations
             WHERE id = $1
             FOR UPDATE`,
      [id],
    );

    const reservation = reservationResult.rows[0];

    if (!reservation) {
      throw new Error("Reservation not found");
    }

    if (reservation.status !== "ACTIVE") {
      await client.query("ROLLBACK");
      return reservation;
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

    await client.query(
      `UPDATE products
             SET available_stock = available_stock + $1,
                 updated_at = NOW()
             WHERE id = $2`,
      [reservation.quantity, reservation.product_id],
    );

    const updatedReservationResult = await client.query(
      `UPDATE reservations
             SET status = 'EXPIRED',
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
      [id],
    );

    await client.query("COMMIT");

    return updatedReservationResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cancelReservation(id, userId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reservationResult = await client.query(
      `SELECT *
             FROM reservations
             WHERE id = $1
             AND user_id = $2
             FOR UPDATE`,
      [id, userId],
    );

    const reservation = reservationResult.rows[0];

    if (!reservation) {
      throw new Error("Reservation not found");
    }

    if (reservation.status !== "ACTIVE") {
      throw new Error("Reservation is no longer active");
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

    await client.query(
      `UPDATE products
             SET available_stock = available_stock + $1,
                 updated_at = NOW()
             WHERE id = $2`,
      [reservation.quantity, reservation.product_id],
    );

    const updatedReservationResult = await client.query(
      `UPDATE reservations
             SET status = 'CANCELLED',
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
      [id],
    );

    await client.query("COMMIT");

    return updatedReservationResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createReservationTransaction,
  getReservationById,
  getUserReservations,
  expireReservation,
  cancelReservation,
};
