import {
  FastifyLoggerInstance,
  FastifyPluginAsync,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerBase,
  RawServerDefault,
} from "fastify";
import { envProperties } from "./";

export type AuthQuerystring = {
  code: string;
};

type AuthSuccessResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

type AuthFailedResponse = {
  error: string;
  error_description: string;
};

// https://stackoverflow.com/a/70667474/9302758
declare module "fastify" {
  export interface FastifyInstance<
    RawServer extends RawServerBase = RawServerDefault,
    RawRequest extends RawRequestDefaultExpression<RawServer> = RawRequestDefaultExpression<RawServer>,
    RawReply extends RawReplyDefaultExpression<RawServer> = RawReplyDefaultExpression<RawServer>,
    Logger = FastifyLoggerInstance
  > {
    config: Record<keyof envProperties, string>;
  }
}

type ProfilelResponse = {
  id: string;
  nickname?: string;
  name?: string;
  email?: string;
  gender?: "F" | "M" | "U";
  age?: string;
  birthday?: string;
  profile_image?: string;
  birthyear?: string;
  mobile?: string;
};

export type NaverProfileResponse = {
  resultcode: string;
  message: string;
  response: ProfilelResponse;
};

export type AuthResponse = AuthSuccessResponse | AuthFailedResponse;
