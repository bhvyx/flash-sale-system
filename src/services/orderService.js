const orderRepository = require("../repositories/orderRepository");
const AppError = require("../utils/AppError");

async function createOrder(reservationId, userId) {
  return await orderRepository.createOrderTransaction(reservationId, userId);
}

async function getOrderById(id, userId) {
  const order = await orderRepository.getOrderById(id, userId);

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  return order;
}

async function getUserOrders(userId) {
  return await orderRepository.getUserOrders(userId);
}

module.exports = {
  createOrder,
  getOrderById,
  getUserOrders,
};
