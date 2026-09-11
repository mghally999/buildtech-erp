// After the whole suite: prove no test left a trace. purge() removes every tagged row in
// dependency order; scan() then looks in every text column of every base table for anything
// still tagged ZZTEST. Either finding a leak, or being unable to clean one, fails the run.
const { purge, scan } = require('./helpers/run');

module.exports = async () => {
  const before = await scan();      // what the specs' own afterAll hooks left behind
  await purge();                    // safety net, so the database is clean for Phase 7
  const after = await scan();
  if (after) throw new Error('E2E teardown: ZZTEST rows still present after purge — ' + after);
  if (before) throw new Error('E2E teardown: a test left ZZTEST rows (now cleaned) — ' + before);
  console.log('E2E teardown: zero ZZTEST rows remain in any table.');
};
