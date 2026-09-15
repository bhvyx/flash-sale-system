const orderService = require("../services/orderService");

async function createOrder(req, res, next) {
  try {
    const { reservationId } = req.body;

    const order = await orderService.createOrder(reservationId, req.user.id);

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
}

async function getOrderById(req, res, next) {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user.id);

    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
}

async function getUserOrders(req, res, next) {
  try {
    const orders = await orderService.getUserOrders(req.user.id);

    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrder,
  getOrderById,
  getUserOrders,
};
