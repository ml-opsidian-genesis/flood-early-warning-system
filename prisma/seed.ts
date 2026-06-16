const { PrismaClient } = require("@prisma/client");
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

type Loc = { name: string; district: string; latitude: number; longitude: number };

async function main() {
  const raw = readFileSync(join(process.cwd(), "data", "locations.json"), "utf-8");
  const locations: Loc[] = JSON.parse(raw);

  for (const loc of locations) {
    await prisma.location.upsert({
      where: { name_district: { name: loc.name, district: loc.district } },
      update: { latitude: loc.latitude, longitude: loc.longitude },
      create: loc,
    });
  }

  console.log(`Seeded ${locations.length} locations.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
