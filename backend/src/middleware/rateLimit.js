export function rateLimit({ limit, windowMs }) {
  const buckets = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, row] of buckets) if (row.until <= now) buckets.delete(key);
  }, windowMs);
  cleanup.unref();
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    let row = buckets.get(key);
    if (!row || now >= row.until) {
      if (buckets.size >= 10000)
        return res
          .status(429)
          .json({ error: "มีผู้ใช้งานจำนวนมาก กรุณารอสักครู่" });
      row = { count: 0, until: now + windowMs };
      buckets.set(key, row);
    }
    if (++row.count > limit) {
      res.set("Retry-After", String(Math.ceil((row.until - now) / 1000)));
      return res
        .status(429)
        .json({ error: "ทำรายการถี่เกินไป รอสักครู่แล้วลองใหม่" });
    }
    next();
  };
}
