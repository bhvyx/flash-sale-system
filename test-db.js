require("dotenv").config();

const { Client } = require("pg");

console.log("DATABASE_URL:", process.env.DATABASE_URL);

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client
  .connect()
  .then(() => {
    console.log("CONNECTED TO POSTGRES");
    return client.query("SELECT current_database(), current_user");
  })
  .then((result) => {
    console.log(result.rows);
    return client.end();
  })
  .catch((error) => {
    console.error("DATABASE ERROR:", error);
  });
