<<<<<<< HEAD

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "src/prisma/schema.prisma",

  migrations: {
    path: "src/prisma/migrations",
  },

  datasource: {
    url: env("DATABASE_URL"),
=======
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
>>>>>>> 67dffed (Fix create service API route)
  },
});
