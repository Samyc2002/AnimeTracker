module.exports = async ({ req, res, log, error }) => {
  const appUrl = process.env.APP_URL || 'https://animetracker.lol';
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    error('CRON_SECRET not configured');
    return res.json({ error: 'CRON_SECRET not configured' }, 500);
  }

  let totalUpdated = 0;
  let batches = 0;
  let offset = 0;
  const maxBatches = 200;

  try {
    log('Starting series backfill (full re-link)...');

    while (batches < maxBatches) {
      const response = await fetch(`${appUrl}/api/backfill-series?offset=${offset}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
      });

      const body = await response.json();
      batches++;

      if (!response.ok) {
        error(`Batch ${batches} failed: ${JSON.stringify(body)}`);
        break;
      }

      totalUpdated += body.updated || 0;
      log(`Batch ${batches}: offset ${body.offset}, updated ${body.updated}/${body.processed}, total ${body.total}`);

      if (body.done) {
        log('All entries processed.');
        break;
      }

      offset = body.nextOffset;
    }

    log(`Done. Total updated: ${totalUpdated} in ${batches} batches.`);
    return res.json({ totalUpdated, batches });
  } catch (err) {
    error(`Backfill failed: ${err.message}`);
    return res.json({ error: err.message }, 500);
  }
};
