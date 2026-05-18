import { bootstrapCatnipAgent } from "./bootstrap.js";

async function main(): Promise<void> {
  const app = bootstrapCatnipAgent();

  app.executor.start();
  app.worker.start();

  await app.gateway.startCli();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
