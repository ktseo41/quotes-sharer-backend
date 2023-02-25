// Read the .env file.
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import * as dotenv from "dotenv";
dotenv.config();

// Require the framework
import Fastify from "fastify";

const devLoggerConfig = {
  transport: {
    target: "pino-pretty",
    options: {
      translateTime: "HH:MM:ss Z",
      ignore: "pid,hostname",
    },
  },
};

const isDev = process.env.NODE_ENV === "development";

// Instantiate Fastify with some config
const app = Fastify(
  isDev
    ? {
        logger: devLoggerConfig,
      }
    : {
        logger: true,
      }
).withTypeProvider<TypeBoxTypeProvider>();

// Register your application as a normal plugin.
app.register(import("../index"));

// @ts-ignore
export default async (req, res) => {
  await app.ready();
  app.server.emit("request", req, res);
};
