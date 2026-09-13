const reservationService = require("../services/reservationService");

async function createReservation(req, res) {
  try {
    const { userId, productId, quantity } = req.body;

    const reservation = await reservationService.createReservation(
      userId,
      productId,
      quantity,
    );

    res.status(201).json(reservation);
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
}

async function getReservationById(req, res) {
  try {
    const reservation = await reservationService.getReservationById(
      req.params.id,
    );

    res.status(200).json(reservation);
  } catch (error) {
    res.status(404).json({
      error: error.message,
    });
  }
}

async function getUserReservations(req, res) {
  try {
    const reservations = await reservationService.getUserReservations(
      req.params.userId,
    );

    res.status(200).json(reservations);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
}

module.exports = {
  createReservation,
  getReservationById,
  getUserReservations,
};
