const orderRepository = require("../../../src/repositories/orderRepository");
const reservationRepository = require("../../../src/repositories/reservationRepository");
const productRepository = require("../../../src/repositories/productRepository");
const userRepository = require("../../../src/repositories/userRepository");
const pool = require("../../../src/db");

describe("orderRepository", () => {
  let userId;
  let productId;
  let reservationId;

  beforeAll(async () => {
    const user = await userRepository.createUser(
      `order-${Date.now()}@example.com`,
      "hashed-password",
    );

    const product = await productRepository.createProduct(
      "Order Test Product",
      500,
      10,
    );

    userId = user.id;
    productId = product.id;

    const reservation =
      await reservationRepository.createReservationTransaction(
        userId,
        productId,
        2,
        new Date(Date.now() + 10 * 60 * 1000),
      );

    reservationId = reservation.id;
  });

  test("creates a pending order from an active reservation", async () => {
    const order = await orderRepository.createOrderTransaction(
      reservationId,
      userId,
    );

    expect(order).toEqual(
      expect.objectContaining({
        user_id: userId,
        product_id: productId,
        reservation_id: reservationId,
        quantity: 2,
        amount: "1000.00",
        status: "PENDING",
      }),
    );
  });

  test("retrieves an order belonging to the user", async () => {
    const orders = await orderRepository.getUserOrders(userId);

    expect(orders.length).toBeGreaterThan(0);

    expect(orders[0]).toEqual(
      expect.objectContaining({
        user_id: userId,
        reservation_id: reservationId,
      }),
    );
  });

  test("retrieves an order by id with ownership", async () => {
    const orders = await orderRepository.getUserOrders(userId);
    const orderId = orders[0].id;

    const order = await orderRepository.getOrderById(orderId, userId);

    expect(order).toEqual(
      expect.objectContaining({
        id: orderId,
        user_id: userId,
      }),
    );
  });

  test("does not return another user's order", async () => {
    const anotherUser = await userRepository.createUser(
      `order-other-${Date.now()}@example.com`,
      "hashed-password",
    );

    const orders = await orderRepository.getUserOrders(userId);
    const orderId = orders[0].id;

    const order = await orderRepository.getOrderById(orderId, anotherUser.id);

    expect(order).toBeUndefined();
  });

  afterAll(async () => {
    await pool.end();
  });
});
