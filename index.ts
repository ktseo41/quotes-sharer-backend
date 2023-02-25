import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import fastifyEnv from "@fastify/env";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { AuthQuerystring } from "./types";
import {
  decodeAccessTokenAsync,
  generateTokens,
  setTokenCookies,
  verityTokenMiddleware,
} from "./lib/token";
import { getAuth, getProfile } from "./lib/naver";
import {
  createQuote,
  findOrCreateUserId,
  getQuotes,
  updateQuote,
} from "./lib/db";
import { Static, Type } from "@sinclair/typebox";

const isDev = process.env.NODE_ENV === "development";

const devLoggerConfig = {
  transport: {
    target: "pino-pretty",
    options: {
      translateTime: "HH:MM:ss Z",
      ignore: "pid,hostname",
    },
  },
};

const server = Fastify(
  isDev
    ? {
        logger: devLoggerConfig,
      }
    : {
        logger: true,
      }
).withTypeProvider<TypeBoxTypeProvider>();

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

server.register(fastifyEnv, envOptions);
server.register(cors, {
  origin: isDev ? ["http://localhost:5173"] : ["https://ktseo41.github.io"],
  credentials: true,
});
server.register(cookie, {
  secret: process.env.COOKIE_SIGNATURE,
  hook: "onRequest",
});

server.addHook("onRequest", verityTokenMiddleware);

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

      const userId = await findOrCreateUserId(naverAuthId);

      const { accessToken, refreshToken } = await generateTokens(userId);

      setTokenCookies(reply, { accessToken, refreshToken });

      return { message: "success" };
    } catch (error) {
      console.error(error);
      return error;
    }
  }
);

server.get("/ping", async () => {
  return "pong";
});

const Quote = Type.Object({
  content: Type.String(),
  title: Type.Optional(Type.String()),
  author: Type.Optional(Type.String()),
  backgroundColor: Type.String(),
  textColor: Type.String(),
  paragraphFontSize: Type.String(),
});

export type QuoteType = Static<typeof Quote>;

server.post<{ Body: QuoteType }>(
  "/save",
  // https://www.fastify.io/docs/latest/Reference/TypeScript/#using-generics
  {
    schema: {
      body: Quote,
      response: {
        200: Type.String(),
      },
    },
    preValidation: (request, reply, done) => {
      const { content } = request.body;

      if (!content) {
        done(new Error("content is required"));
      }

      done();
    },
  },
  async (request, reply) => {
    const { accessToken } = request.cookies;

    if (!accessToken) {
      throw new Error("accessToken is required");
    }

    const { user_id: userId } = await decodeAccessTokenAsync(accessToken);

    const result = await createQuote({ ...request.body, userId });

    reply.send(JSON.stringify(result));
  }
);

server.get("/load", async (request, reply) => {
  const { accessToken } = request.cookies;

  if (!accessToken) {
    throw new Error("accessToken is required");
  }

  const { user_id: userId } = await decodeAccessTokenAsync(accessToken);

  const result = await getQuotes(userId);

  reply.send(result);
});

type UpdateQuoteBody = {
  id: string;
} & QuoteType;

server.put<{ Body: UpdateQuoteBody }>(
  "/update",
  {
    schema: {
      body: Type.Object({
        id: Type.String(),
        ...Quote.properties,
      }),
      response: {
        200: Type.String(),
      },
    },
    preValidation: (request, reply, done) => {
      const { id, content } = request.body;

      if (!id) {
        done(new Error("id is required"));
      }

      if (!content) {
        done(new Error("content is required"));
      }

      done();
    },
  },
  async (request, reply) => {
    const { accessToken } = request.cookies;

    if (!accessToken) {
      throw new Error("accessToken is required");
    }

    const { user_id: userId } = await decodeAccessTokenAsync(accessToken);

    const result = await updateQuote({ ...request.body, userId });

    reply.send(JSON.stringify(result));
  }
);

if (isDev) {
  server.listen({ port: 8080, host: "0.0.0.0" }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`${isDev ? "[dev] " : ""}Server listening at ${address}`);
  });
}

export default server;
