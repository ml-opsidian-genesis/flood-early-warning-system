/**
 * Create or update an admin account (no public signup — admins only).
 *
 *   npm run admin:create -- admin@example.com "StrongPassw0rd!" [role]
 *
 * role defaults to "admin" (use "superadmin" for elevated).
 */
const { PrismaClient } = require("@prisma/client");
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const [email, password, role = "admin"] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: npm run admin:create -- <email> <password> [role]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const normalized = email.toLowerCase();
  const passwordHash = hashPassword(password);

  const admin = await prisma.admin.upsert({
    where: { email: normalized },
    update: { passwordHash, role },
    create: { email: normalized, passwordHash, role },
  });

  console.log(`✅ Admin ready: ${admin.email} (role: ${admin.role})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
