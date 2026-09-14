const pool = require("../db");
const reservationRepository = require("../repositories/reservationRepository");

async function expireReservations() {
  const result = await pool.query(
    `SELECT id
         FROM reservations
         WHERE status = 'ACTIVE'
         AND expires_at <= NOW()`,
  );

  for (const reservation of result.rows) {
    try {
      await reservationRepository.expireReservation(reservation.id);
    } catch (error) {
      console.error(
        `Failed to expire reservation ${reservation.id}:`,
        error.message,
      );
    }
  }
}

function startExpirationWorker() {
  expireReservations();

  setInterval(expireReservations, 5000);
}

module.exports = {
  expireReservations,
  startExpirationWorker,
};
