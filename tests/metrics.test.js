import { Metrics } from '../src/index';

test('rmse', () => {
  expect(Metrics.rmse([0, 0, 0, 1, 1], [0, 2, 4, 1, 1])).toBeCloseTo(2, 5);
});
