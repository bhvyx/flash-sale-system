const express = require("express");
const reservationController = require("../controllers/reservationController");

const router = express.Router();

router.post("/", reservationController.createReservation);
router.get("/user/:userId", reservationController.getUserReservations);
router.get("/:id", reservationController.getReservationById);

module.exports = router;
