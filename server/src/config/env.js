import { z } from 'zod';

// Blank values in .env (e.g. `PORT=`) mean "use the default", not "empty string".
const optional = (schema) => z.preprocess((value) => (value === '' ? undefined : value), schema);
const minutes = (count) => count * 60 * 1000;
const days = (count) => count * 24 * 60 * 60 * 1000;

const envSchema = z.object({
  NODE_ENV: optional(z.enum(['development', 'production', 'test']).default('development')),
  // 0 asks the OS for a free port (used by the integration tests).
  PORT: optional(z.coerce.number().int().min(0).max(65_535).default(4000)),
  CLIENT_ORIGIN: optional(z.string().default('http://localhost:5173')),
  TRUST_PROXY: optional(z.string().optional()),
  LOG_LEVEL: optional(z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info')),
  LOG_FORMAT: optional(z.enum(['pretty', 'json']).optional()),
  DATABASE_PATH: optional(z.string().default('data/collabcode.db')),
  MAX_PARTICIPANTS_PER_ROOM: optional(z.coerce.number().int().min(1).max(100).default(10)),
  EMPTY_ROOM_TTL_MINUTES: optional(z.coerce.number().int().min(1).default(30)),
  ROOM_RETENTION_DAYS: optional(z.coerce.number().int().min(1).default(30)),
  // Only the literal "false" disables the runner, matching the original behaviour.
  CODE_RUNNER_ENABLED: optional(z.string().default('true').transform((value) => value.trim().toLowerCase() !== 'false')),
  DOCKER_BIN: optional(z.string().default('docker')),
  JAVA_RUNNER_IMAGE: optional(z.string().default('eclipse-temurin:21-jdk-alpine')),
  CPP_RUNNER_IMAGE: optional(z.string().default('gcc:14.2.0')),
  PYTHON_RUNNER_IMAGE: optional(z.string().default('python:3.12-alpine')),
  TYPESCRIPT_RUNNER_IMAGE: optional(z.string().default('node:22-alpine')),
});

export function loadConfig(env = process.env) {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid server configuration:\n${z.prettifyError(result.error)}`);
  }

  const values = result.data;
  const isProduction = values.NODE_ENV === 'production';
  return {
    env: values.NODE_ENV,
    isProduction,
    port: values.PORT,
    clientOrigin: values.CLIENT_ORIGIN,
    trustProxy: parseTrustProxy(values.TRUST_PROXY),
    log: {
      level: values.LOG_LEVEL,
      // pino-pretty is a dev dependency, so only default to it during development.
      pretty: values.LOG_FORMAT ? values.LOG_FORMAT === 'pretty' : values.NODE_ENV === 'development',
    },
    databasePath: values.DATABASE_PATH,
    rooms: {
      maxParticipants: values.MAX_PARTICIPANTS_PER_ROOM,
      emptyRoomTtlMs: minutes(values.EMPTY_ROOM_TTL_MINUTES),
      retentionMs: days(values.ROOM_RETENTION_DAYS),
    },
    runner: {
      enabled: values.CODE_RUNNER_ENABLED,
      dockerBin: values.DOCKER_BIN,
      images: {
        java: values.JAVA_RUNNER_IMAGE,
        cpp: values.CPP_RUNNER_IMAGE,
        python: values.PYTHON_RUNNER_IMAGE,
        typescript: values.TYPESCRIPT_RUNNER_IMAGE,
      },
    },
  };
}

// Mirrors Express's "trust proxy" setting: true/false, a hop count, or a list of subnets.
function parseTrustProxy(value) {
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}
