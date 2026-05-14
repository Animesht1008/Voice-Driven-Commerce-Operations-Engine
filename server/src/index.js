const { env } = require("./config/env");
const { connectDb } = require("./config/db");
const { app } = require("./app");
const { startScheduler } = require("./services/schedulerService");

const bootstrap = async () => {
  await connectDb();
  startScheduler();
  app.listen(env.port, () => {
    console.log(`Backend running on http://localhost:${env.port}`);
    console.log(`Workflow Engine + API Layer active (storage=${env.storageMode})`);
  });
};

bootstrap().catch((error) => {
  console.error("Server bootstrap failed:", error.message);
  process.exit(1);
});
