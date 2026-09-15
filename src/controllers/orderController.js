const orderService = require("../services/orderService");

async function createOrder(req, res) {
  try {
    const { reservationId } = req.body;

    const order = await orderService.createOrder(reservationId, req.user.id);

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
}

async function getOrderById(req, res) {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user.id);

    res.status(200).json(order);
  } catch (error) {
    res.status(404).json({
      error: error.message,
    });
  }
}

async function getUserOrders(req, res) {
  try {
    const orders = await orderService.getUserOrders(req.user.id);

    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
}

module.exports = {
  createOrder,
  getOrderById,
  getUserOrders,
};
