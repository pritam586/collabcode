// `checks` maps a name to a function that returns a JSON-safe summary or throws when unhealthy.
export function createHealthController({ checks = {}, startedAt = Date.now() } = {}) {
  return {
    show(request, response) {
      const results = {};
      let healthy = true;
      for (const [name, check] of Object.entries(checks)) {
        try {
          results[name] = check();
        } catch (error) {
          healthy = false;
          results[name] = 'unavailable';
          request.log.error({ err: error, check: name }, 'Health check failed');
        }
      }

      response.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        checks: results,
      });
    },
  };
}
