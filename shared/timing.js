/**
 * Timing middleware — add to each service to measure handler time and flag slow requests.
 * Prints one log line per API request with handler duration.
 * Skips health-check and swagger noise.
 */
function timingMiddleware(serviceName) {
  return (req, res, next) => {
    if (req.url === '/health' || req.url.startsWith('/api-docs') || req.url.startsWith('/swagger')) {
      return next();
    }
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const flag = ms > 500 ? ' ⚠ SLOW' : ms > 200 ? ' △' : '';
      console.log(`[${serviceName}] ${req.method} ${req.path} → ${res.statusCode} | handler=${ms.toFixed(1)}ms${flag}`);
    });
    next();
  };
}

module.exports = timingMiddleware;
