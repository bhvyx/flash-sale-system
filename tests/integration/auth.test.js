const request = require("supertest");
const app = require("../../src/app");
const pool = require("../../src/db");

describe("auth API", () => {
  const email = `auth-${Date.now()}@example.com`;
  const password = "password123";

  test("registers a new user", async () => {
    const response = await request(app).post("/api/auth/register").send({
      email,
      password,
    });

    expect(response.status).toBe(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        email,
      }),
    );

    expect(response.body.password_hash).toBeUndefined();
  });

  test("rejects duplicate email registration", async () => {
    const response = await request(app).post("/api/auth/register").send({
      email,
      password,
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Email already registered");
  });

  test("logs in with valid credentials", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email,
      password,
    });

    expect(response.status).toBe(200);

    expect(response.body.token).toEqual(expect.any(String));

    expect(response.body.user).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        email,
        isAdmin: false,
      }),
    );
  });

  test("rejects invalid credentials", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email,
      password: "wrongpassword",
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid email or password");
  });

  test("rejects invalid registration data", async () => {
    const response = await request(app).post("/api/auth/register").send({
      email: "invalid-email",
      password: "short",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "email",
        }),
        expect.objectContaining({
          field: "password",
        }),
      ]),
    );
  });

  afterAll(async () => {
    await pool.end();
  });
});
