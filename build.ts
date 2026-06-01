import { rm, mkdir, rename } from "node:fs/promises";

// 1. Clear and recreate the docs directories
await rm("./docs", { recursive: true, force: true });
await mkdir("./docs/app", { recursive: true });

// 2. Build the main index.html from the src folder
const buildIndex = await Bun.build({
  entrypoints: ["./src/index.html"],
  outdir: "./docs",
});

if (!buildIndex.success) {
  console.error("Failed to build index.html:");
  console.error(buildIndex.logs);
  process.exit(1);
}

// 3. Build the app.html from the src folder
const buildApp = await Bun.build({
  entrypoints: ["./src/app.html"],
  outdir: "./docs/app",
});

if (!buildApp.success) {
  console.error("Failed to build app.html:");
  console.error(buildApp.logs);
  process.exit(1);
}

// 4. Rename the output file inside the docs/app folder
await rename("./docs/app/app.html", "./docs/app/index.html");

console.log("Build completed successfully from the src directory!");