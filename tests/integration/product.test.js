const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");
const userRepository = require("../../src/repositories/userRepository");
const productRepository = require("../../src/repositories/productRepository");
const pool = require("../../src/db");

describe("products API", () => {
  let userToken;
  let adminToken;

  beforeAll(async () => {
    const user = await userRepository.createUser(
      `product-user-${Date.now()}@example.com`,
      "hashed-password",
    );

    const admin = await userRepository.createUser(
      `product-admin-${Date.now()}@example.com`,
      "hashed-password",
    );

    await pool.query("UPDATE users SET is_admin = TRUE WHERE id = $1", [
      admin.id,
    ]);

    userToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        isAdmin: false,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    adminToken = jwt.sign(
      {
        userId: admin.id,
        email: admin.email,
        isAdmin: true,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
  });

  test("allows public access to products", async () => {
    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test("rejects unauthenticated product creation", async () => {
    const response = await request(app).post("/api/products").send({
      name: "Unauthorized Product",
      price: 100,
      totalStock: 10,
    });

    expect(response.status).toBe(401);
  });

  test("rejects product creation by a normal user", async () => {
    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        name: "User Product",
        price: 100,
        totalStock: 10,
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Admin access required");
  });

  test("allows admin to create a product", async () => {
    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Admin Product",
        price: 999.99,
        totalStock: 25,
      });

    expect(response.status).toBe(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        name: "Admin Product",
        price: "999.99",
        total_stock: 25,
        available_stock: 25,
      }),
    );
  });

  test("rejects invalid product data", async () => {
    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "",
        price: -100,
        totalStock: -5,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
  });

  test("retrieves a product by id", async () => {
    const product = await productRepository.createProduct(
      "Product Lookup Test",
      250,
      15,
    );

    const response = await request(app).get(`/api/products/${product.id}`);

    expect(response.status).toBe(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: product.id,
        name: "Product Lookup Test",
        price: "250.00",
      }),
    );
  });

  afterAll(async () => {
    await pool.end();
  });
});
