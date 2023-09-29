# Disco Node

:fire: Recommendations for Node.js using collaborative filtering

- Supports user-based and item-based recommendations
- Works with explicit and implicit feedback
- Uses high-performance matrix factorization

[![Build Status](https://github.com/ankane/disco-node/workflows/build/badge.svg?branch=master)](https://github.com/ankane/disco-node/actions)

## Installation

Run:

```sh
npm install disco-rec
```

## Getting Started

Create a recommender

```javascript
import { Recommender } from 'disco-rec';

const recommender = new Recommender();
```

If users rate items directly, this is known as explicit feedback. Fit the recommender with:

```javascript
recommender.fit([
  {userId: 1, itemId: 1, rating: 5},
  {userId: 2, itemId: 1, rating: 3}
]);
```

> IDs can be integers or strings

If users don’t rate items directly (for instance, they’re purchasing items or reading posts), this is known as implicit feedback. Leave out the rating.

```javascript
recommender.fit([
  {userId: 1, itemId: 1},
  {userId: 2, itemId: 1}
]);
```

> Each `userId`/`itemId` combination should only appear once

Get user-based recommendations - “users like you also liked”

```javascript
recommender.userRecs(userId);
```

Get item-based recommendations - “users who liked this item also liked”

```javascript
recommender.itemRecs(itemId);
```

Use the `count` option to specify the number of recommendations (default is 5)

```javascript
recommender.userRecs(userId, 3);
```

Get predicted ratings for specific users and items

```javascript
recommender.predict([{userId: 1, itemId: 2}, {userId: 2, itemId: 4}]);
```

Get similar users

```javascript
recommender.similarUsers(userId);
```

## Examples

### MovieLens

Load the data

```javascript
import { loadMovieLens } from 'disco-rec';

const data = await loadMovieLens();
```

Create a recommender and get similar movies

```javascript
const recommender = new Recommender({factors: 20});
recommender.fit(data);
recommender.itemRecs('Star Wars (1977)');
```

## Storing Recommendations

Save recommendations to your database.

Alternatively, you can store only the factors and use a library like [pgvector-node](https://github.com/ankane/pgvector-node). See an [example](https://github.com/pgvector/pgvector-node/blob/master/examples/disco/example.js).

## Algorithms

Disco uses high-performance matrix factorization.

- For explicit feedback, it uses [stochastic gradient descent](https://www.csie.ntu.edu.tw/~cjlin/papers/libmf/libmf_journal.pdf)
- For implicit feedback, it uses [coordinate descent](https://www.csie.ntu.edu.tw/~cjlin/papers/one-class-mf/biased-mf-sdm-with-supp.pdf)

Specify the number of factors and epochs

```javascript
new Recommender({factors: 8, epochs: 20});
```

If recommendations look off, trying changing `factors`. The default is 8, but 3 could be good for some applications and 300 good for others.

## Validation

Pass a validation set with:

```javascript
recommender.fit(data, validationSet);
```

## Cold Start

Collaborative filtering suffers from the [cold start problem](https://en.wikipedia.org/wiki/Cold_start_(recommender_systems)). It’s unable to make good recommendations without data on a user or item, which is problematic for new users and items.

```javascript
recommender.userRecs(newUserId); // returns empty array
```

There are a number of ways to deal with this, but here are some common ones:

- For user-based recommendations, show new users the most popular items
- For item-based recommendations, make content-based recommendations

## Reference

Get ids

```javascript
recommender.userIds();
recommender.itemIds();
```

Get the global mean

```javascript
recommender.globalMean();
```

Get factors

```javascript
recommender.userFactors(userId);
recommender.itemFactors(itemId);
```

## Credits

Thanks to [LIBMF](https://github.com/cjlin1/libmf) for providing high performance matrix factorization

## History

View the [changelog](https://github.com/ankane/disco-node/blob/master/CHANGELOG.md)

## Contributing

Everyone is encouraged to help improve this project. Here are a few ways you can help:

- [Report bugs](https://github.com/ankane/disco-node/issues)
- Fix bugs and [submit pull requests](https://github.com/ankane/disco-node/pulls)
- Write, clarify, or fix documentation
- Suggest or add new features

To get started with development:

```sh
git clone https://github.com/ankane/disco-node.git
cd disco-node
npm install
npm test
```
