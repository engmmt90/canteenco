import {
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

export const ACCESS_TOKEN_TTL_SECONDS =
  15 * 60;

export const REFRESH_TOKEN_TTL_SECONDS =
  30 * 24 * 60 * 60;

type AccessTokenUser = {
  id: string;
  email: string;
  sessionVersion: number;
};

function getAccessTokenSecret() {
  const secret =
    process.env.MOBILE_ACCESS_TOKEN_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "MOBILE_ACCESS_TOKEN_SECRET is missing or too short",
    );
  }

  return secret;
}

function encodeJson(
  value: unknown,
) {
  return Buffer.from(
    JSON.stringify(value),
  ).toString("base64url");
}

export function createAccessToken(
  user: AccessTokenUser,
) {
  const now =
    Math.floor(Date.now() / 1000);

  const header = encodeJson({
    alg: "HS256",
    typ: "JWT",
  });

  const payload = encodeJson({
    sub: user.id,
    email: user.email,
    role: "PARENT",
    sessionVersion:
      user.sessionVersion,
    type: "access",
    iat: now,
    exp:
      now +
      ACCESS_TOKEN_TTL_SECONDS,
  });

  const unsignedToken =
    `${header}.${payload}`;

  const signature =
    createHmac(
      "sha256",
      getAccessTokenSecret(),
    )
      .update(unsignedToken)
      .digest("base64url");

  return `${unsignedToken}.${signature}`;
}

export function createRefreshToken() {
  return randomBytes(48)
    .toString("base64url");
}

export function hashRefreshToken(
  token: string,
) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export function refreshExpiry() {
  return new Date(
    Date.now() +
      REFRESH_TOKEN_TTL_SECONDS *
        1000,
  );
}
