import "dotenv/config";

import { defineConfig } from "prisma/config";

const databaseUrl = process.env["DATABASE_URL"];

export default defineConfig({
  schema: "schema.prisma",
  datasource: {
    url: databaseUrl
  },
  migrations: {
    path: "migrations"
  }
});
