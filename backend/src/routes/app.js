import { Router } from 'express';
import { readFileSync } from 'node:fs';

const release = JSON.parse(readFileSync(new URL('../releases/android.json', import.meta.url), 'utf8'));
const router = Router();
// Public metadata only; checking for an update needs no account or database query.
router.get('/android', (_req, res) => res.set('Cache-Control', 'no-store').json(release));
export default router;
