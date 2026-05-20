import "dotenv/config";
import { runMigrations, pingDatabase } from "../src/db";

async function main() {
  await pingDatabase();
  await runMigrations();
  console.log("Database migrations applied.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
