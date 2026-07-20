import pino from "pino";

const redactPaths = [
  "req.headers.authorization",
  "*.apiKey",
  "*.accessToken",
  "*.refreshToken",
  "*.appSecret",
  "*.secret",
  "*.token",
  "*.OPENAI_API_KEY",
  "*.MIAOSHOU_APP_SECRET",
  "*.MIAOSHOU_ACCESS_TOKEN"
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]"
  },
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true, singleLine: true }
        }
});
