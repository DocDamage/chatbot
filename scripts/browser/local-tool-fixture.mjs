const marker = process.argv[2];

if (marker !== 'P03-T05-safe-run') {
  console.error('Unexpected browser E2E marker.');
  process.exitCode = 2;
} else {
  console.log(JSON.stringify({
    marker,
    status: 'completed',
    shellUsed: false,
    message: 'P03-T05 safe local tool harness completed.',
  }));
}
