import { FastifyReply, FastifyRequest } from "fastify";
import jwt, { verify, TokenExpiredError } from "jsonwebtoken";
import { createRefreshToken, deleteRefreshToken, getRefreshToken } from "./db";
import { CookieSerializeOptions } from "@fastify/cookie";

export async function generateTokens(
  userId: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const { JWT_SECRET } = process.env;

  if (JWT_SECRET === undefined) {
    throw new Error("JWT_SECRET is not defined");
  }

  const accessTokenPayload = {
    user_id: userId,
  };

  const accessTokenOptions = {
    expiresIn: "1h",
    issuer: "quotes_sharer",
    subject: "access_token",
  };

  const accessToken = jwt.sign(
    accessTokenPayload,
    JWT_SECRET,
    accessTokenOptions
  );

  const refreshTokenId = await createRefreshToken(userId);

  const refreshTokenPayload = {
    user_id: userId,
    token_id: refreshTokenId,
  };

  const refreshTokenOptions = {
    expiresIn: "30d",
    issuer: "quotes_sharer",
    subject: "refresh_token",
  };

  const refreshToken = jwt.sign(
    refreshTokenPayload,
    JWT_SECRET,
    refreshTokenOptions
  );

  return { accessToken, refreshToken };
}

type ISetCookies = {
  accessToken: string;
  refreshToken?: string;
};

export function setTokenCookies(reply: FastifyReply, cookies: ISetCookies) {
  const { accessToken, refreshToken } = cookies;

  const cookieOptions: CookieSerializeOptions =
    process.env.NODE_ENV === "development"
      ? {
          httpOnly: true,
          domain: "localhost",
          path: "/",
        }
      : {
          httpOnly: true,
          domain: "ktseo41.github.io",
          path: "/",
          secure: true,
          // TODO: sameSite?
        };

  reply.setCookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 60 * 60 * 1000,
  });

  if (refreshToken) {
    reply.setCookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}

export async function verityTokenMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (request.routerPath === "/auth") {
    return;
  }

  if (process.env.JWT_SECRET === undefined) {
    throw new Error("JWT_SECRET is not defined");
  }

  const { accessToken, refreshToken } = request.cookies;

  if (!accessToken) {
    reply.code(401).send({ message: "Unauthorized, no accessToken" });
    return;
  }

  if (!refreshToken) {
    reply.code(401).send({ message: "Unauthorized, no refreshToken" });
    return;
  }

  const accessTokenVerifyResult = await verifyTokenAsync(
    accessToken,
    process.env.JWT_SECRET
  );

  if (accessTokenVerifyResult === undefined) {
    reply.clearCookie("accessToken");
    reply.code(401).send({ message: "Unauthorized, invalid accessToken" });
    return;
  }

  if (
    accessTokenVerifyResult instanceof Error &&
    !(accessTokenVerifyResult instanceof TokenExpiredError)
  ) {
    reply.clearCookie("accessToken");
    reply.code(401).send({
      message: `Unauthorized, json token error ${accessTokenVerifyResult.message}`,
    });
    return;
  }

  if (accessTokenVerifyResult instanceof TokenExpiredError) {
    const [error, decodedRefreshToken] = decodeRefreshToken(refreshToken);

    if (error) {
      reply.clearCookie("refreshToken");
      reply.code(401).send({ message: "Unauthorized, invalid refreshToken" });
      return;
    }

    const { token_id, user_id } = decodedRefreshToken;

    const tokenId = await getRefreshToken(token_id, user_id);

    if (!tokenId) {
      reply.clearCookie("refreshToken");
      reply.code(401).send({ message: "Unauthorized, invalid refreshToken" });
      return;
    }

    await deleteRefreshToken(token_id);

    const { accessToken, refreshToken: _refreshToken } = await generateTokens(
      user_id
    );

    setTokenCookies(reply, { accessToken, refreshToken: _refreshToken });

    return;
  }
}

async function verifyTokenAsync(
  accessToken: string,
  jwtSecret: string
): Promise<jwt.VerifyErrors | string | jwt.JwtPayload | undefined> {
  return new Promise((resolve) => {
    verify(accessToken, jwtSecret, (error, decoded) => {
      if (error) {
        resolve(error);
        return;
      }

      resolve(decoded);
    });
  });
}

type AccessToken = jwt.JwtPayload & { user_id: string };

function isAccessToken(
  decodedAccessToken: jwt.JwtPayload | undefined
): decodedAccessToken is AccessToken {
  return decodedAccessToken !== undefined && "user_id" in decodedAccessToken;
}

export async function decodeAccessTokenAsync(
  accessToken: string
): Promise<AccessToken> {
  return new Promise((resolve, reject) => {
    const decodedAccessToken = jwt.decode(accessToken, { json: true });

    if (!decodedAccessToken) {
      reject(new Error("Invalid access token"));
      return;
    }

    if (isAccessToken(decodedAccessToken)) {
      resolve(decodedAccessToken);
      return;
    }

    reject(new Error("Invalid access token"));
  });
}

function decodeRefreshToken(
  refreshToken: string
): [true] | [null, jwt.JwtPayload] {
  const decodedRefreshToken = jwt.decode(refreshToken, { json: true });

  if (!decodedRefreshToken) {
    return [true];
  }

  if ("user_id" in decodedRefreshToken && "token_id" in decodedRefreshToken) {
    return [null, decodedRefreshToken];
  }

  return [true];
}
