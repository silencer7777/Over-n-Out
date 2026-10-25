// botmatch.mjs — run ONE bot-vs-field match and print its JSON result.
// Used by rig/vm2-balance/run.mjs (and handy standalone for debugging).
//
// Usage: node rig/vm2-balance/botmatch.mjs --root <worktree> --mode tdm
//        --map compound --profile mobile --weapon ar --seed 11
//        [--max-ticks 36000]
import { argInt, argVal } from '../lib/riglib.mjs';
import { runBotMatch } from './driver.mjs';

const root = argVal(process.argv, '--root', null);
if (!root) { console.error('--root required'); process.exit(2); }
const res = await runBotMatch({
  root,
  modeId: argVal(process.argv, '--mode', 'tdm'),
  mapId: argVal(process.argv, '--map', 'compound'),
  seed: argInt(process.argv, '--seed', 1),
  maxTicks: argInt(process.argv, '--max-ticks', 36000),
  players: [{
    id: 'profile',
    profile: argVal(process.argv, '--profile', 'mobile'),
    weapon: argVal(process.argv, '--weapon', 'ar'),
  }],
});
console.log(JSON.stringify(res));
