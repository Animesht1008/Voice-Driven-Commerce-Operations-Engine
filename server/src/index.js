const { env } = require("./config/env");
const { connectDb } = require("./config/db");
const { app } = require("./app");
const { startScheduler } = require("./services/schedulerService");

const bootstrap = async () => {
  await connectDb();
  startScheduler();
  app.listen(env.port, () => {
    console.log(`Backend running on http://localhost:${env.port}`);
    console.log(`Storage mode: ${env.storageMode}`);
  });
};

bootstrap().catch((err) => {
  console.error("Server bootstrap failed:", err.message);
  process.exit(1);
});
