#!/usr/bin/env node

const bcrypt = require("bcryptjs");

async function main() {
  const password = process.argv[2];
  const rounds = Number(process.env.AUTH_BCRYPT_ROUNDS || 12);

  if (!password) {
    console.error("Usage: npm run auth:hash -- \"your-password\"");
    process.exitCode = 1;
    return;
  }

  if (!Number.isInteger(rounds) || rounds < 8 || rounds > 15) {
    console.error("AUTH_BCRYPT_ROUNDS must be an integer in range 8..15");
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(password, rounds);
  console.log(hash);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
