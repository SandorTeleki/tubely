import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { UserNotAuthenticatedError } from "./api/errors";

export const ACCESS_TOKEN_ISSUER = "tubely-access";

export async function hashPassword(password: string) {
  return await Bun.password.hash(password, {
    algorithm: "argon2id",
  });
}

export async function checkPasswordHash(password: string, hash: string) {
  if (!password) return false;
  try {
    return await Bun.password.verify(password, hash);
  } catch {
    return false;
  }
}

type payload = Pick<JwtPayload, "iss" | "sub" | "iat" | "exp">;

export function makeJWT(userID: string, secret: string, expiresIn: number) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + expiresIn;
  const token = jwt.sign(
    {
      iss: ACCESS_TOKEN_ISSUER,
      sub: userID,
      iat: issuedAt,
      exp: expiresAt,
    } satisfies payload,
    secret,
    { algorithm: "HS256" },
  );

  return token;
}

export function validateJWT(tokenString: string, tokenSecret: string) {
  const decoded = jwt.verify(tokenString, tokenSecret) as jwt.JwtPayload;

  if (decoded.iss !== ACCESS_TOKEN_ISSUER) {
    throw new UserNotAuthenticatedError("Invalid issuer");
  }

  const userID = decoded.sub;
  if (!userID) {
    throw new UserNotAuthenticatedError("Missing subject (user ID)");
  }
  return userID;
}

export function getBearerToken(headers: Headers) {
  const authHeader = headers.get("Authorization");
  if (!authHeader) {
    throw new UserNotAuthenticatedError("Missing Authorization Header");
  }

  const split = authHeader.split(" ");
  if (split.length < 2 || split[0] !== "Bearer") {
    throw new UserNotAuthenticatedError("Malformed Authorization header");
  }
  return split[1];
}

export function makeRefreshToken(): string {
  const buf = randomBytes(32);
  return buf.toString("hex");
}
