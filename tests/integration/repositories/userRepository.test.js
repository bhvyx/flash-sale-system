const userRepository = require("../../../src/repositories/userRepository");
const pool = require("../../../src/db");

describe("userRepository", () => {
  const email = "repository-test@example.com";
  const passwordHash = "hashed-password";

  test("creates and retrieves a user", async () => {
    const createdUser = await userRepository.createUser(email, passwordHash);

    expect(createdUser).toEqual(
      expect.objectContaining({
        email,
      }),
    );

    expect(createdUser.id).toEqual(expect.any(String));

    const userByEmail = await userRepository.getUserByEmail(email);

    expect(userByEmail).toEqual(
      expect.objectContaining({
        id: createdUser.id,
        email,
        password_hash: passwordHash,
      }),
    );

    const userById = await userRepository.getUserById(createdUser.id);

    expect(userById).toEqual(
      expect.objectContaining({
        id: createdUser.id,
        email,
      }),
    );
  });

  afterAll(async () => {
    await pool.end();
  });
});
