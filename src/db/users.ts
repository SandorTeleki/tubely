import { randomUUID } from "crypto";
import type { Database } from "bun:sqlite";

export type User = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  password: string;
};

export type CreateUserParams = {
  email: string;
  password: string;
};

type UserRow = {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  password: string;
};

export function getUsers(db: Database): User[] {
  const sql = `
    SELECT *
    FROM users
  `;
  const query = db.query<UserRow, []>(sql);

  const users: User[] = [];
  for (const row of query.iterate()) {
    users.push({
      id: row.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      email: row.email,
      password: "",
    });
  }
  return users;
}

export function getUserByEmail(db: Database, email: string): User | undefined {
  const sql = `
    SELECT *
    FROM users
    WHERE email = ?
  `;

  const row = db.query<UserRow, [string]>(sql).get(email);

  if (!row) {
    return;
  }

  return {
    id: row.id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    email: row.email,
    password: row.password,
  };
}

export function getUserByRefreshToken(
  db: Database,
  token: string,
): User | undefined {
  const sql = `
    SELECT u.id, u.email, u.created_at, u.updated_at, u.password
    FROM users u
    JOIN refresh_tokens rt ON u.id = rt.user_id
    WHERE rt.token = ?
  `;

  const row = db.query<UserRow, [string]>(sql).get(token);
  if (!row) return;

  return {
    id: row.id,
    email: row.email,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    password: row.password,
  };
}

export function createUser(
  db: Database,
  params: CreateUserParams,
): User | undefined {
  const newID = randomUUID();

  const sql = `
    INSERT INTO users (id, created_at, updated_at, email, password)
    VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?)
  `;
  db.run(sql, [newID, params.email, params.password]);

  return getUser(db, newID);
}

export function getUser(db: Database, id: string): User | undefined {
  const sql = `
    SELECT *
    FROM users
    WHERE id = ?
  `;
  const row = db.query<UserRow, [string]>(sql).get(id);

  if (!row) return;

  return {
    id: row.id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    email: row.email,
    password: row.password,
  };
}

export function deleteUser(db: Database, id: string): void {
  const sql = `
    DELETE FROM users
    WHERE id = ?
  `;
  db.run(sql, [id]);
}
