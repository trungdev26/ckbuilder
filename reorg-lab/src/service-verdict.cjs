function evaluate(snapshot, canonicalHash, minimumHeight, applicationMatches) {
  const result = (verdict, reason) => ({verdict,reason});
  if (!canonicalHash) return result('ERROR','Canonical RPC observation unavailable');
  if (snapshot.error) return result('ERROR',snapshot.error);
  if (!snapshot.serviceAlive) return result('INCONCLUSIVE','Indexer is not running');
  if (!snapshot.checkpoint || snapshot.checkpoint.height < minimumHeight || snapshot.checkpoint.hash !== canonicalHash)
    return result('INCONCLUSIVE','Checkpoint has not reached the required canonical block');
  for (const cell of Object.values(snapshot.cells || {})) {
    if (cell && (cell.createdHeight > snapshot.checkpoint.height || cell.consumedHeight > snapshot.checkpoint.height))
      return result('ERROR','Cell state is ahead of the checkpoint');
  }
  return applicationMatches ? result('PASS','Canonical state and application assertion agree') : result('FAIL','Application assertion differs from canonical state');
}
module.exports = { evaluate };
