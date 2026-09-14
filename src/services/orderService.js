const orderRepository = require("../repositories/orderRepository");

async function createOrder(reservationId) {
  if (!reservationId) {
    throw new Error("Reservation ID is required");
  }

  return await orderRepository.createOrderTransaction(reservationId);
}

async function getOrderById(id) {
  const order = await orderRepository.getOrderById(id);

  if (!order) {
    throw new Error("Order not found");
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
