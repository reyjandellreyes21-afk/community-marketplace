import "./load-env.js";
import { app } from "./src/app.js";
import { config } from "./src/config/config.js";

const bootstrap = async () => {
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`community-marketplace API running on http://localhost:${config.port}`);
    // eslint-disable-next-line no-console
    console.log("Communities: GET /api/v1/communities | POST /api/v1/communities (auth + multipart)");
  });
};

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", error);
  process.exit(1);
});
