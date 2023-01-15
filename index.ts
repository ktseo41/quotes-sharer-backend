import Fastify from "fastify";
import axios from "axios";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "jsonwebtoken";
import fastifyEnv from "@fastify/env";
import { AuthQuerystring, AuthResponse, NaverProfileResponse } from "./types";
import { MongoClient } from "mongodb";

function getRandomName() {
  return Math.random().toString(36).substring(2, 15);
}

type IGenerateAccessToken = {
  userId: string;
};

function generateAccessToken({ userId }: IGenerateAccessToken) {
  const { JWT_SECRET } = process.env;

  if (JWT_SECRET === undefined) {
    throw new Error("JWT_SECRET is not defined");
  }

  return jwt.sign(
    {
      user_id: userId,
    },
    JWT_SECRET,
    {
      expiresIn: "1h",
      issuer: "QuotesSharer",
      subject: "accessToken",
    }
  );
}

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
  secret: "cookie-secret",
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

      const { data } = await axios.get<AuthResponse>(
        `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${server.config.NAVER_CLIENT_ID}&client_secret=${server.config.NAVER_CLIENT_SECRET}&code=${code}&state=${server.config.NAVER_AUTH_STATE}`
      );

      if ("error" in data) {
        return data;
      }

      const { access_token } = data;

      const { data: profileData } = await axios.get<NaverProfileResponse>(
        `https://openapi.naver.com/v1/nid/me`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );

      const { message } = profileData;

      if (message !== "success") {
        return profileData;
      }

      const { id } = profileData.response;

      const uri = `mongodb+srv://${server.config.MONGODB_NAME}:${server.config.MONGODB_PASSWORD}@cluster0.dtzskey.mongodb.net/?retryWrites=true&w=majority`;
      const client = new MongoClient(uri);
      await client.connect();
      const db = client.db("QuotesSharer");
      const collection = db.collection("User");
      const result = await collection.findOne({ naverAuthId: id });

      if (!result) {
        const currentTime = new Date().getTime();
        const insertResult = await collection.insertOne({
          naverAuthId: id,
          createdAt: currentTime,
          updatedAt: currentTime,
          nickname: getRandomName(),
        });
      }

      client.close();

      const accessToken = generateAccessToken({ userId: id });

      reply.setCookie("accessToken", accessToken, {
        path: "/",
        httpOnly: true,
        maxAge: 60 * 60 * 1000,
        domain: "localhost",
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
