import { Metrics, Recommender, loadMovieLens } from '../src/index';

test('explicit', async () => {
  const data = await loadMovieLens();
  const recommender = new Recommender({factors: 20});
  recommender.fit(data);

  const expected = data.reduce((a, v) => a + v.rating, 0) / data.length;
  expect(recommender.globalMean()).toBeCloseTo(expected);

  const recs = recommender.itemRecs('Star Wars (1977)');
  expect(recs.length).toBe(5);

  const itemIds = recs.map((r) => r.itemId);
  expect(itemIds).toContain('Empire Strikes Back, The (1980)');
  expect(itemIds).toContain('Return of the Jedi (1983)');
  expect(itemIds).not.toContain('Star Wars (1977)');

  expect(recs[0].score).toBeCloseTo(0.9972, 2);

  expect(recommender.itemRecs('Star Wars (1977)', null).length).toBe(1663);
  expect(recommender.similarUsers(1, null).length).toBe(942);
});

test('implicit', async () => {
  const data = await loadMovieLens();
  data.forEach((v) => delete v.rating);

  const recommender = new Recommender({factors: 20});
  recommender.fit(data);

  expect(recommender.globalMean()).toBe(0);

  const recs = recommender.itemRecs('Star Wars (1977)', 10);
  const itemIds = recs.map((r) => r.itemId);
  expect(itemIds).toContain('Empire Strikes Back, The (1980)');
  expect(itemIds).toContain('Return of the Jedi (1983)');
  expect(itemIds).not.toContain('Star Wars (1977)');
});

test('examples', () => {
  let recommender = new Recommender();
  recommender.fit([
    {userId: 1, itemId: 1, rating: 5},
    {userId: 2, itemId: 1, rating: 3}
  ])
  recommender.userRecs(1);
  recommender.itemRecs(1);

  recommender = new Recommender();
  recommender.fit([
    {userId: 1, itemId: 1},
    {userId: 2, itemId: 1}
  ]);
  recommender.userRecs(1);
  recommender.itemRecs(1);
});

test('rated', () => {
  const data = [
    {userId: 1, itemId: 'A'},
    {userId: 1, itemId: 'B'},
    {userId: 1, itemId: 'C'},
    {userId: 1, itemId: 'D'},
    {userId: 2, itemId: 'C'},
    {userId: 2, itemId: 'D'},
    {userId: 2, itemId: 'E'},
    {userId: 2, itemId: 'F'}
  ];
  const recommender = new Recommender();
  recommender.fit(data);
  expect(recommender.userRecs(1).map((r) => r.itemId).sort()).toStrictEqual(['E', 'F']);
  expect(recommender.userRecs(2).map((r) => r.itemId).sort()).toStrictEqual(['A', 'B']);
});

test('item recs same score', () => {
  const data = [{userId: 1, itemId: 'A'}, {userId: 1, itemId: 'B'}, {userId: 2, itemId: 'C'}];
  const recommender = new Recommender({factors: 50});
  recommender.fit(data);
  expect(recommender.itemRecs('A').map((r) => r.itemId)).toStrictEqual(['B', 'C']);
});

test('similar users', async () => {
  const data = await loadMovieLens();
  const recommender = new Recommender({factors: 20});
  recommender.fit(data);

  expect(recommender.similarUsers(data[0].userId)).not.toHaveLength(0);
  expect(recommender.similarUsers('missing')).toHaveLength(0);
});

test('ids', () => {
  const data = [
    {userId: 1, itemId: 'A'},
    {userId: 1, itemId: 'B'},
    {userId: 2, itemId: 'B'}
  ];
  const recommender = new Recommender();
  recommender.fit(data);
  expect(recommender.userIds()).toStrictEqual([1, 2]);
  expect(recommender.itemIds()).toStrictEqual(['A', 'B']);
});

test('factors', () => {
  const data = [
    {userId: 1, itemId: 'A'},
    {userId: 1, itemId: 'B'},
    {userId: 2, itemId: 'B'}
  ];
  const recommender = new Recommender({factors: 20});
  recommender.fit(data);

  expect(recommender.userFactors(1)).toHaveLength(20);
  expect(recommender.itemFactors('A')).toHaveLength(20);

  expect(recommender.userFactors(3)).toBeNull();
  expect(recommender.itemFactors('C')).toBeNull();
});

test('validation set explicit', async () => {
  const data = await loadMovieLens();
  const trainSet = data.slice(0, 80000);
  const validationSet = data.slice(80000);
  const recommender = new Recommender({factors: 20, verbose: false});
  recommender.fit(trainSet, validationSet);
});

test('validation set implicit', async () => {
  const data = await loadMovieLens();
  data.forEach((v) => delete v.rating);
  const trainSet = data.slice(0, 80000);
  const validationSet = data.slice(80000);
  const recommender = new Recommender({factors: 20, verbose: false});
  recommender.fit(trainSet, validationSet);
});

test('user recs new user', () => {
  const recommender = new Recommender();
  recommender.fit([
    {userId: 1, itemId: 1, rating: 5},
    {userId: 2, itemId: 1, rating: 3}
  ]);
  expect(recommender.userRecs(1000)).toHaveLength(0);
});

test('predict', async () => {
  const data = await loadMovieLens();
  data.sort(() => Math.random() - 0.5);

  const trainSet = data.slice(0, 80000);
  const validSet = data.slice(80000);

  const recommender = new Recommender({factors: 20, verbose: false});
  recommender.fit(trainSet, validSet);

  const predictions = recommender.predict(validSet);
  expect(Metrics.rmse(validSet.map((v) => v.rating), predictions)).toBeCloseTo(0.91, 1);
});

test('predict new user', async () => {
  const data = await loadMovieLens();
  const recommender = new Recommender({factors: 20});
  recommender.fit(data);
  expect(recommender.predict([{userId: 100000, itemId: 'Star Wars (1977)'}])).toStrictEqual([recommender.globalMean()]);
});

test('predict new item', async () => {
  const data = await loadMovieLens();
  const recommender = new Recommender({factors: 20});
  recommender.fit(data);
  expect(recommender.predict([{userId: 1, itemId: 'New movie'}])).toStrictEqual([recommender.globalMean()]);
});

test('predict user recs consistent', () => {

});

test('no training data', () => {
  const recommender = new Recommender();
  expect(() => recommender.fit([])).toThrow('No training data');
});

test('missing user id', () => {
  const recommender = new Recommender();
  expect(() => recommender.fit([{itemId: 1, rating: 5}])).toThrow('Missing userId');
});

test('missing item id', () => {
  const recommender = new Recommender();
  expect(() => recommender.fit([{userId: 1, rating: 5}])).toThrow('Missing itemId');
});

test('missing rating', () => {
  const recommender = new Recommender();
  expect(() => recommender.fit([{userId: 1, itemId: 1, rating: 5}, {userId: 1, itemId: 2}])).toThrow('Missing rating');
});

test('missing rating validation set', () => {
  const recommender = new Recommender();
  expect(() => recommender.fit([{userId: 1, itemId: 1, rating: 5}], [{userId: 1, itemId: 2}])).toThrow('Missing rating');
});

test('invalid rating', () => {
  const recommender = new Recommender();
  expect(() => recommender.fit([{userId: 1, itemId: 1, rating: 'invalid'}])).toThrow('Rating must be numeric');
});

test('invalid rating validation set', () => {
  const recommender = new Recommender();
  expect(() => recommender.fit([{userId: 1, itemId: 1, rating: 5}], [{userId: 1, itemId: 1, rating: 'invalid'}])).toThrow('Rating must be numeric');
});

test('not fit', () => {
  const recommender = new Recommender();
  expect(() => recommender.userRecs(1)).toThrow('Not fit');
});

test('fit multiple', () => {
  const recommender = new Recommender();
  recommender.fit([{userId: 1, itemId: 1, rating: 5}]);
  recommender.fit([{userId: 2, itemId: 2}]);
  expect(recommender.userIds()).toStrictEqual([2]);
  expect(recommender.itemIds()).toStrictEqual([2]);
  expect(recommender.predict([{userId: 2, itemId: 2}])[0]).toBeLessThanOrEqual(1);
});
