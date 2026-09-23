import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';

try {
  const data = JSON.parse(readFileSync(join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'models_cache.json'), 'utf8'));
  const ageHours = (Date.now() - Date.parse(data.fetched_at)) / 3600000;
  const models = data.models.filter(m => m.visibility === 'list').map(m => ({id: m.slug,
    description: m.description, efforts: m.supported_reasoning_levels.map(x => x.effort)}));
  console.log(JSON.stringify({source: 'local_codex_cache', fetchedAt: data.fetched_at,
    stale: !Number.isFinite(ageHours) || ageHours < -1 || ageHours > 168,
    note: 'Intersect with models exposed by the active dispatch tool. Cache membership alone does not prove access.', models}, null, 2));
} catch {
  console.log(JSON.stringify({source: 'unavailable', models: [], note: 'Use the active tool model catalog; do not guess.'}));
}
