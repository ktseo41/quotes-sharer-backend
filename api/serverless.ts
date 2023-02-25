// Read the .env file.
import cors from "@fastify/cors";
import fastifyEnv from "@fastify/env";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import * as dotenv from "dotenv";
dotenv.config();

// Require the framework
import Fastify from "fastify";

export const envProperties = {
  MONGODB_ADDRESS: {
    type: "string",
  },
  MONGODB_NAME: {
    type: "string",
  },
  MONGODB_PASSWORD: {
    type: "string",
  },
  MONGODB_DBNAME: {
    type: "string",
  },
  NAVER_CLIENT_ID: {
    type: "string",
  },
  NAVER_CLIENT_SECRET: {
    type: "string",
  },
  NAVER_AUTH_STATE: {
    type: "string",
  },
  COOKIE_SIGNATURE: {
    type: "string",
  },
};

const envOptions = {
  confKey: "config",
  schema: {
    type: "object",
    required: ["MONGODB_NAME"],
    properties: envProperties,
  },
  dotenv: true,
};

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
app.register(fastifyEnv, envOptions);
app.register(cors, {
  origin: isDev ? ["http://localhost:5173"] : ["https://ktseo41.github.io"],
  credentials: true,
});
app.register(import("../index"));

// @ts-ignore
export default async (req, res) => {
  await app.ready();
  app.server.emit("request", req, res);
};
