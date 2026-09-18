// Usage:  npx tsx scripts/hash-password.ts 'your password here'
//
// Prints a bcrypt hash suitable for ADMIN_PASSWORD_HASH in
// .env.production. Cost factor 12 = ~250ms per login attempt, standard
// current default (2025). Higher = slower but stronger; login latency
// with cost 12 is already imperceptible for a two-user admin.

import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error("Usage: npx tsx scripts/hash-password.ts '<password>'");
  console.error("");
  console.error("Quote it, especially if it contains $ or spaces.");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log(hash);
