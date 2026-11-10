export class UsageBuffer {
  constructor(write, max = 500) { this.write = write; this.max = max; this.rows = []; this.dropped = 0; this.pending = null; }
  add(row) {
    if (this.rows.length >= this.max) { this.rows.shift(); this.dropped++; }
    this.rows.push(row);
  }
  flush() {
    if (this.pending) return this.pending;
    if (!this.rows.length) return Promise.resolve();
    const batch = this.rows.splice(0, 100);
    this.pending = Promise.resolve().then(() => this.write(batch)).catch(() => {
      this.rows.unshift(...batch);
      if (this.rows.length > this.max) this.dropped += this.rows.splice(0, this.rows.length - this.max).length;
    }).finally(() => { this.pending = null; });
    return this.pending;
  }
}
