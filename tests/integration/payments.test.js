const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");
const userRepository = require("../../src/repositories/userRepository");
const productRepository = require("../../src/repositories/productRepository");
const reservationRepository = require("../../src/repositories/reservationRepository");
const orderRepository = require("../../src/repositories/orderRepository");
const paymentRepository = require("../../src/repositories/paymentRepository");
const pool = require("../../src/db");
const redisClient = require("../../src/redis/client");

describe("payments API", () => {
  let user;
  let anotherUser;
  let userToken;
  let anotherUserToken;
  let product;

  beforeAll(async () => {
    await redisClient.connect();

    user = await userRepository.createUser(
      `payment-api-${Date.now()}@example.com`,
      "hashed-password",
    );

    anotherUser = await userRepository.createUser(
      `payment-api-other-${Date.now()}@example.com`,
      "hashed-password",
    );

    product = await productRepository.createProduct(
      "Payment API Product",
      100,
      10,
    );

    userToken = jwt.sign(
      { userId: user.id, email: user.email, isAdmin: false },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    anotherUserToken = jwt.sign(
      { userId: anotherUser.id, email: anotherUser.email, isAdmin: false },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
  });

  async function createReservationAndOrder(quantity = 1) {
    const reservation =
      await reservationRepository.createReservationTransaction(
        user.id,
        product.id,
        quantity,
        new Date(Date.now() + 10 * 60 * 1000),
      );

    const order = await orderRepository.createOrderTransaction(
      reservation.id,
      user.id,
    );

    return { reservation, order };
  }

  test("rejects unauthenticated payment", async () => {
    const response = await request(app).post("/api/payments").send({
      orderId: crypto.randomUUID(),
      outcome: "SUCCESS",
    });

    expect(response.status).toBe(401);
  });

  test("rejects payment without idempotency key", async () => {
    const { order } = await createReservationAndOrder();

    const response = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        orderId: order.id,
        outcome: "SUCCESS",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Idempotency-Key header is required");
  });

  test("rejects invalid payment data", async () => {
    const response = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", `invalid-${Date.now()}`)
      .send({
        orderId: "invalid-id",
        outcome: "INVALID",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
  });

  test("processes a successful payment", async () => {
    const { reservation, order } = await createReservationAndOrder(2);

    const response = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", `success-${Date.now()}`)
      .send({
        orderId: order.id,
        outcome: "SUCCESS",
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        order_id: order.id,
        status: "SUCCESS",
        amount: "200.00",
      }),
    );

    const updatedOrder = await orderRepository.getOrderById(order.id, user.id);

    expect(updatedOrder.status).toBe("CONFIRMED");

    const updatedReservation = await reservationRepository.getReservationById(
      reservation.id,
      user.id,
    );

    expect(updatedReservation.status).toBe("PURCHASED");

    const updatedProduct = await productRepository.getProductById(product.id);

    expect(updatedProduct.total_stock).toBe(8);
  });

  test("processes a failed payment", async () => {
    const { reservation, order } = await createReservationAndOrder();

    const response = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", `failed-${Date.now()}`)
      .send({
        orderId: order.id,
        outcome: "FAILED",
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("FAILED");

    const updatedOrder = await orderRepository.getOrderById(order.id, user.id);

    expect(updatedOrder.status).toBe("PENDING");

    const updatedReservation = await reservationRepository.getReservationById(
      reservation.id,
      user.id,
    );

    expect(updatedReservation.status).toBe("ACTIVE");
  });

  test("does not allow another user to pay for an order", async () => {
    const { order } = await createReservationAndOrder();

    const response = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${anotherUserToken}`)
      .set("Idempotency-Key", `ownership-${Date.now()}`)
      .send({
        orderId: order.id,
        outcome: "SUCCESS",
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Order not found");
  });

  test("returns the existing payment for the same idempotency key", async () => {
    const { order } = await createReservationAndOrder();

    const idempotencyKey = `duplicate-${Date.now()}`;

    const firstResponse = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        orderId: order.id,
        outcome: "SUCCESS",
      });

    const secondResponse = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        orderId: order.id,
        outcome: "SUCCESS",
      });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(secondResponse.body.id).toBe(firstResponse.body.id);
  });

  test("rejects using an idempotency key for another order", async () => {
    const first = await createReservationAndOrder();
    const second = await createReservationAndOrder();

    const idempotencyKey = `cross-order-${Date.now()}`;

    const firstResponse = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        orderId: first.order.id,
        outcome: "SUCCESS",
      });

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        orderId: second.order.id,
        outcome: "SUCCESS",
      });

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.error).toBe(
      "Idempotency key already used for another order",
    );
  });

  afterAll(async () => {
    await redisClient.quit();
    await pool.end();
  });
});
