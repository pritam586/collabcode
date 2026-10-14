import pino from 'pino';

export function createLogger({ level = 'info', pretty = false } = {}) {
  return pino({
    level,
    base: { service: 'collabcode-server' },
    // Never log user code or request bodies; they can be large and may contain secrets.
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    transport: pretty
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service' } }
      : undefined,
  });
}
