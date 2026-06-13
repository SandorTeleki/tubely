import {
  checkPasswordHash,
  getBearerToken,
  makeJWT,
  makeRefreshToken,
} from "../auth";
import { type ApiConfig } from "../config";
import { createRefreshToken, revokeRefreshToken } from "../db/refresh-tokens";
import { getUserByEmail, getUserByRefreshToken } from "../db/users";
import { BadRequestError, UserNotAuthenticatedError } from "./errors";
import { respondWithJSON } from "./json";

export async function handlerLogin(cfg: ApiConfig, req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) {
    throw new BadRequestError("Email and password are required");
  }

  const user = getUserByEmail(cfg.db, email);
  if (!user) {
    throw new UserNotAuthenticatedError("Incorrect email or password");
  }

  const valid = await checkPasswordHash(password, user.password);
  if (!valid) {
    throw new UserNotAuthenticatedError("Incorrect email or password");
  }

  const accessExpiresMs = 30 * 24 * 60 * 60 * 1000;
  const accessToken = makeJWT(user.id, cfg.jwtSecret, accessExpiresMs);

  const refreshExpiresMs = 60 * 24 * 60 * 60 * 1000;
  const refreshToken = makeRefreshToken();

  createRefreshToken(cfg.db, {
    userID: user.id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + refreshExpiresMs),
  });

  return respondWithJSON(200, {
    user,
    token: accessToken,
    refreshToken: refreshToken,
  });
}

export async function handlerRefresh(cfg: ApiConfig, req: Request) {
  const refreshToken = getBearerToken(req.headers);
  const user = getUserByRefreshToken(cfg.db, refreshToken);
  if (!user) {
    throw new UserNotAuthenticatedError("Invalid or expired refresh token");
  }

  const oneHourMs = 60 * 60 * 1000;
  const accessToken = makeJWT(user.id, cfg.jwtSecret, oneHourMs);

  return respondWithJSON(200, { token: accessToken });
}

export async function handlerRevoke(cfg: ApiConfig, req: Request) {
  const refreshToken = getBearerToken(req.headers);

  revokeRefreshToken(cfg.db, refreshToken);
  return new Response(null, { status: 204 });
}
