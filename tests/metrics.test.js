import assert from 'node:assert';
import test from 'node:test';
import { Metrics } from 'disco-rec';

test('rmse', () => {
  assert.equal(Metrics.rmse([0, 0, 0, 1, 1], [0, 2, 4, 1, 1]), 2);
});
