import type { Database } from "bun:sqlite";

export type RefreshToken = {
  token: string;
  userID: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date;
};

interface RefreshTokenRow {
  token: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  expires_at: string;
  revoked_at?: string;
}

export type CreateRefreshTokenParams = {
  token: string;
  userID: string;
  expiresAt: Date;
};

export function createRefreshToken(
  db: Database,
  params: CreateRefreshTokenParams,
) {
  const query = `
    INSERT INTO refresh_tokens (
      token,
      created_at,
      updated_at,
      user_id,
      expires_at
    ) VALUES (
      ?,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      ?,
      ?
    )
  `;
  db.run(query, [params.token, params.userID, params.expiresAt.toISOString()]);

  return getRefreshToken(db, params.token);
}

export function revokeRefreshToken(db: Database, token: string) {
  const query = `
    UPDATE refresh_tokens
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE token = ?
  `;
  return db.run(query, [token]);
}

export function getRefreshToken(db: Database, token: string) {
  const row = db
    .query<RefreshTokenRow, [string]>(
      `
      SELECT
        token,
        created_at,
        updated_at,
        user_id,
        expires_at,
        revoked_at
      FROM refresh_tokens
      WHERE token = ?
    `,
    )
    .get(token);

  if (!row) {
    return;
  }

  const createdAt = new Date(row.created_at);
  const updatedAt = new Date(row.updated_at);
  const expiresAt = new Date(row.expires_at);
  const revokedAt = row.revoked_at ? new Date(row.revoked_at) : undefined;

  return {
    token: row.token,
    userID: row.user_id,
    expiresAt,
    createdAt,
    updatedAt,
    revokedAt,
  } satisfies RefreshToken;
}

export function deleteRefreshToken(db: Database, token: string) {
  const query = `
    DELETE FROM refresh_tokens
    WHERE token = ?
  `;
  return db.run(query, [token]);
}
