import jwt from "jsonwebtoken";

type IGenerateAccessToken = {
  userId: string;
};

export function generateAccessToken({ userId }: IGenerateAccessToken) {
  const { JWT_SECRET } = process.env;

  if (JWT_SECRET === undefined) {
    throw new Error("JWT_SECRET is not defined");
  }

  const tokenPayload = {
    user_id: userId,
  };

  const tokenOptions = {
    expiresIn: "1h",
    issuer: "QuotesSharer",
    subject: "accessToken",
  };

  return jwt.sign(tokenPayload, JWT_SECRET, tokenOptions);
}
