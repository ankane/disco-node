import assert from 'node:assert';
import test from 'node:test';
import { Metrics, Recommender, loadMovieLens } from 'disco-rec';

test('explicit', async () => {
  const data = await loadMovieLens();
  const recommender = new Recommender({factors: 20});
  recommender.fit(data);

  const expected = data.reduce((a, v) => a + v.rating, 0) / data.length;
  assert(almostEqual(recommender.globalMean(), expected));

  const recs = recommender.itemRecs('Star Wars (1977)');
  assert.equal(recs.length, 5);

  const itemIds = recs.map((r) => r.itemId);
  assert(itemIds.includes('Empire Strikes Back, The (1980)'));
  assert(itemIds.includes('Return of the Jedi (1983)'));
  assert(!itemIds.includes('Star Wars (1977)'));

  assert(almostEqual(recs[0].score, 0.9972));

  assert.equal(recommender.itemRecs('Star Wars (1977)', null).length, 1663);
  assert.equal(recommender.similarUsers(1, null).length, 942);
});

test('implicit', async () => {
  const data = await loadMovieLens();
  data.forEach((v) => delete v.rating);

  const recommender = new Recommender({factors: 20});
  recommender.fit(data);

  assert.equal(recommender.globalMean(), 0);

  const recs = recommender.itemRecs('Star Wars (1977)', 10);
  const itemIds = recs.map((r) => r.itemId);
  assert(itemIds.includes('Empire Strikes Back, The (1980)'));
  assert(itemIds.includes('Return of the Jedi (1983)'));
  assert(!itemIds.includes('Star Wars (1977)'));
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
  assert.deepEqual(recommender.userRecs(1).map((r) => r.itemId).sort(), ['E', 'F']);
  assert.deepEqual(recommender.userRecs(2).map((r) => r.itemId).sort(), ['A', 'B']);
});

test('item recs same score', () => {
  const data = [{userId: 1, itemId: 'A'}, {userId: 1, itemId: 'B'}, {userId: 2, itemId: 'C'}];
  const recommender = new Recommender({factors: 50});
  recommender.fit(data);
  assert.deepEqual(recommender.itemRecs('A').map((r) => r.itemId), ['B', 'C']);
});

test('similar users', async () => {
  const data = await loadMovieLens();
  const recommender = new Recommender({factors: 20});
  recommender.fit(data);

  assert.notEqual(recommender.similarUsers(data[0].userId).length, 0);
  assert.equal(recommender.similarUsers('missing').length, 0);
});

test('ids', () => {
  const data = [
    {userId: 1, itemId: 'A'},
    {userId: 1, itemId: 'B'},
    {userId: 2, itemId: 'B'}
  ];
  const recommender = new Recommender();
  recommender.fit(data);
  assert.deepEqual(recommender.userIds(), [1, 2]);
  assert.deepEqual(recommender.itemIds(), ['A', 'B']);
});

test('factors', () => {
  const data = [
    {userId: 1, itemId: 'A'},
    {userId: 1, itemId: 'B'},
    {userId: 2, itemId: 'B'}
  ];
  const recommender = new Recommender({factors: 20});
  recommender.fit(data);

  assert.equal(recommender.userFactors(1).length, 20);
  assert.equal(recommender.itemFactors('A').length, 20);

  assert.equal(recommender.userFactors(3), null);
  assert.equal(recommender.itemFactors('C'), null);
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
  assert.equal(recommender.userRecs(1000).length, 0);
});

test('predict', async () => {
  const data = await loadMovieLens();
  data.sort(() => Math.random() - 0.5);

  const trainSet = data.slice(0, 80000);
  const validSet = data.slice(80000);

  const recommender = new Recommender({factors: 20, verbose: false});
  recommender.fit(trainSet, validSet);

  const predictions = recommender.predict(validSet);
  assert(almostEqual(Metrics.rmse(validSet.map((v) => v.rating), predictions), 0.91));
});

test('predict new user', async () => {
  const data = await loadMovieLens();
  const recommender = new Recommender({factors: 20});
  recommender.fit(data);
  assert.deepEqual(recommender.predict([{userId: 100000, itemId: 'Star Wars (1977)'}]), [recommender.globalMean()]);
});

test('predict new item', async () => {
  const data = await loadMovieLens();
  const recommender = new Recommender({factors: 20});
  recommender.fit(data);
  assert.deepEqual(recommender.predict([{userId: 1, itemId: 'New movie'}]), [recommender.globalMean()]);
});

test('no training data', () => {
  const recommender = new Recommender();
  assert.throws(() => recommender.fit([]), {message: 'No training data'});
});

test('missing user id', () => {
  const recommender = new Recommender();
  assert.throws(() => recommender.fit([{itemId: 1, rating: 5}]), {message: 'Missing userId'});
});

test('missing item id', () => {
  const recommender = new Recommender();
  assert.throws(() => recommender.fit([{userId: 1, rating: 5}]), {message: 'Missing itemId'});
});

test('missing rating', () => {
  const recommender = new Recommender();
  assert.throws(() => recommender.fit([{userId: 1, itemId: 1, rating: 5}, {userId: 1, itemId: 2}]), {message: 'Missing rating'});
});

test('missing rating validation set', () => {
  const recommender = new Recommender();
  assert.throws(() => recommender.fit([{userId: 1, itemId: 1, rating: 5}], [{userId: 1, itemId: 2}]), {message: 'Missing rating'});
});

test('invalid rating', () => {
  const recommender = new Recommender();
  assert.throws(() => recommender.fit([{userId: 1, itemId: 1, rating: 'invalid'}]), {message: 'Rating must be numeric'});
});

test('invalid rating validation set', () => {
  const recommender = new Recommender();
  assert.throws(() => recommender.fit([{userId: 1, itemId: 1, rating: 5}], [{userId: 1, itemId: 1, rating: 'invalid'}]), {message: 'Rating must be numeric'});
});

test('not fit', () => {
  const recommender = new Recommender();
  assert.throws(() => recommender.userRecs(1), {message: 'Not fit'});
});

test('fit multiple', () => {
  const recommender = new Recommender();
  recommender.fit([{userId: 1, itemId: 1, rating: 5}]);
  recommender.fit([{userId: 2, itemId: 2}]);
  assert.deepEqual(recommender.userIds(), [2]);
  assert.deepEqual(recommender.itemIds(), [2]);
  assert(recommender.predict([{userId: 2, itemId: 2}])[0] <= 1);
});

function almostEqual(actual, expected) {
  return Math.abs(actual - expected) < 0.01;
}
