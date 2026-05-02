module.exports = async ({ req, res, log, error }) => {
  const appUrl = process.env.APP_URL || 'https://animetracker.lol';
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    error('CRON_SECRET not configured');
    return res.json({ error: 'CRON_SECRET not configured' }, 500);
  }

  try {
    log('Triggering series backfill...');

    const response = await fetch(`${appUrl}/api/backfill-series`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const body = await response.json();
    log(`Backfill complete: ${JSON.stringify(body)}`);

    return res.json(body);
  } catch (err) {
    error(`Backfill failed: ${err.message}`);
    return res.json({ error: err.message }, 500);
  }
};
