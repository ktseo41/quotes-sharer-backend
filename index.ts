import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import fastifyEnv from "@fastify/env";
import { AuthQuerystring } from "./types";
import { generateAccessToken } from "./lib/token";
import { getAuth, getProfile } from "./lib/naver";
import { createUser, getUserById } from "./lib/db";

const server = Fastify();

export const envProperties = {
  MONGODB_NAME: {
    type: "string",
  },
  MONGODB_PASSWORD: {
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

server.register(fastifyEnv, envOptions);
server.register(cookie, {
  secret: process.env.COOKIE_SIGNATURE,
  hook: "onRequest",
});
server.register(cors, {
  origin: ["http://localhost:5173"],
  credentials: true,
});

server.get<{ Querystring: AuthQuerystring }>(
  "/auth",
  async (request, reply) => {
    try {
      const { code } = request.query;

      if (!code) {
        throw new Error("code is required in querystring");
      }

      const { data: authResult } = await getAuth(code);

      if ("error" in authResult) {
        throw new Error(authResult.error_description);
      }

      const { access_token } = authResult;

      const { data: profileData } = await getProfile({
        accessToken: access_token,
      });

      const { message } = profileData;

      if (message !== "success") {
        throw new Error(message);
      }

      const { id: naverAuthId } = profileData.response;

      const user = await getUserById(naverAuthId);

      if (!user) {
        await createUser(naverAuthId);
      }

      const accessToken = generateAccessToken({ userId: naverAuthId });

      reply.setCookie("accessToken", accessToken, {
        path: "/",
        httpOnly: true,
        maxAge: 60 * 60 * 1000,
        domain: "localhost",
        // TODO: proudction에서는 secure: true로 변경
      });

      return { message: "success" };
    } catch (error) {
      console.error(error);
      return error;
    }
  }
);

server.listen({ port: 8080, host: "0.0.0.0" }, (err, address) => {
  const isDev = process.env.NODE_ENV === "development";

  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`${isDev ? "[dev] " : ""}Server listening at ${address}`);
});
