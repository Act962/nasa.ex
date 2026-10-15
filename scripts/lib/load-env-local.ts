// Scripts de QA: lê .env.local antes de .env (o app em dev lê nessa ordem).
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });
