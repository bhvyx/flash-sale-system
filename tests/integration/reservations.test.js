const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");
const userRepository = require("../../src/repositories/userRepository");
const productRepository = require("../../src/repositories/productRepository");
const reservationRepository = require("../../src/repositories/reservationRepository");
const pool = require("../../src/db");
const redisClient = require("../../src/redis/client");

describe("reservations API", () => {
  let user;
  let anotherUser;
  let userToken;
  let anotherUserToken;
  let product;

  beforeAll(async () => {
    await redisClient.connect();

    user = await userRepository.createUser(
      `reservation-api-${Date.now()}@example.com`,
      "hashed-password",
    );

    anotherUser = await userRepository.createUser(
      `reservation-api-other-${Date.now()}@example.com`,
      "hashed-password",
    );

    product = await productRepository.createProduct(
      "Reservation API Product",
      100,
      10,
    );

    userToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        isAdmin: false,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    anotherUserToken = jwt.sign(
      {
        userId: anotherUser.id,
        email: anotherUser.email,
        isAdmin: false,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
  });

  test("rejects unauthenticated reservation creation", async () => {
    const response = await request(app).post("/api/reservations").send({
      productId: product.id,
      quantity: 1,
    });

    expect(response.status).toBe(401);
  });

  test("rejects invalid reservation data", async () => {
    const response = await request(app)
      .post("/api/reservations")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        productId: "invalid-id",
        quantity: -1,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
  });

  test("creates a reservation", async () => {
    const response = await request(app)
      .post("/api/reservations")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        productId: product.id,
        quantity: 2,
      });

    expect(response.status).toBe(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        user_id: user.id,
        product_id: product.id,
        quantity: 2,
        status: "ACTIVE",
      }),
    );

    const updatedProduct = await productRepository.getProductById(product.id);

    expect(updatedProduct.available_stock).toBe(8);
  });

  test("rejects reservation when stock is insufficient", async () => {
    const response = await request(app)
      .post("/api/reservations")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        productId: product.id,
        quantity: 9,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Not enough stock");
  });

  test("retrieves a user's reservation", async () => {
    const reservation =
      await reservationRepository.createReservationTransaction(
        user.id,
        product.id,
        1,
        new Date(Date.now() + 10 * 60 * 1000),
      );

    const response = await request(app)
      .get(`/api/reservations/${reservation.id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: reservation.id,
        user_id: user.id,
      }),
    );
  });

  test("does not allow another user to retrieve a reservation", async () => {
    const reservation =
      await reservationRepository.createReservationTransaction(
        user.id,
        product.id,
        1,
        new Date(Date.now() + 10 * 60 * 1000),
      );

    const response = await request(app)
      .get(`/api/reservations/${reservation.id}`)
      .set("Authorization", `Bearer ${anotherUserToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Reservation not found");
  });

  test("lists only the authenticated user's reservations", async () => {
    const response = await request(app)
      .get(`/api/reservations/user/${anotherUser.id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    expect(
      response.body.every((reservation) => reservation.user_id === user.id),
    ).toBe(true);
  });

  test("cancels an active reservation and restores stock", async () => {
    const reservation =
      await reservationRepository.createReservationTransaction(
        user.id,
        product.id,
        1,
        new Date(Date.now() + 10 * 60 * 1000),
      );

    const beforeCancel = await productRepository.getProductById(product.id);

    const response = await request(app)
      .post(`/api/reservations/${reservation.id}/cancel`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("CANCELLED");

    const afterCancel = await productRepository.getProductById(product.id);

    expect(afterCancel.available_stock).toBe(beforeCancel.available_stock + 1);
  });

  afterAll(async () => {
    await redisClient.quit();
    await pool.end();
  });
});
