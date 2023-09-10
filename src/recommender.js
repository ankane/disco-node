import { Loss, Matrix, Model } from 'libmf';

export default class Recommender {
  #globalMean;
  #userFactors;
  #itemFactors;

  constructor(options = {}) {
    this.factors = options.factors ?? 8;
    this.epochs = options.epochs ?? 20;
    this.verbose = options.verbose;
    this.userMap = new Map();
    this.itemMap = new Map();
  }

  fit(trainSet, validationSet) {
    if (trainSet.length === 0) {
      throw new Error('No training data');
    }

    this.implicit = true;
    for (let v of trainSet) {
      if ('rating' in v) {
        this.implicit = false;
        break;
      }
    }

    if (!this.implicit) {
      this.#checkRatings(trainSet);

      if (validationSet) {
        this.#checkRatings(validationSet);
      }
    }

    this.userMap = new Map();
    this.itemMap = new Map();
    this.rated = new Map();

    const input = new Matrix();
    for (let v of trainSet) {
      let u = this.userMap.get(v.userId);
      if (u === undefined) {
        u = this.userMap.size;
        this.userMap.set(v.userId, u);
      }

      let i = this.itemMap.get(v.itemId);
      if (i === undefined) {
        i = this.itemMap.size;
        this.itemMap.set(v.itemId, i);
      }

      let rated = this.rated.get(u);
      if (!rated) {
        rated = new Set();
        this.rated.set(u, rated);
      }
      rated.add(i);

      input.push(u, i, this.implicit ? 1 : v.rating);
    }

    // much more efficient than checking every value in another pass
    if (this.userMap.has(undefined)) {
      throw new Error('Missing userId');
    }
    if (this.itemMap.has(undefined)) {
      throw new Error('Missing itemId');
    }

    if (!this.implicit) {
      const ratings = trainSet.map((v) => v.rating);
      this.minRating = Infinity;
      this.maxRating = -Infinity;
      for (let v of ratings) {
        if (v < this.minRating) {
          this.minRating = v;
        }
        if (v > this.maxRating) {
          this.maxRating = v;
        }
      }
    } else {
      this.minRating = null;
      this.maxRating = null;
    }

    let evalSet = null;
    if (validationSet) {
      evalSet = new Matrix();
      for (let v of validationSet) {
        let u = this.userMap.get(v.userId);
        let i = this.itemMap.get(v.itemId);

        // set to non-existent item
        u ??= -1;
        i ??= -1;

        evalSet.push(u, i, this.implicit ? 1 : v.rating);
      }
    }

    const loss = this.implicit ? Loss.ONE_CLASS_L2 : Loss.REAL_L2;
    const verbose = this.verbose ?? evalSet !== null;
    const model = new Model({loss: loss, factors: this.factors, iterations: this.epochs, quiet: !verbose});
    model.fit(input, evalSet);

    this.#globalMean = model.bias();

    this.#userFactors = model.p();
    this.#itemFactors = model.q();

    this.normalizedUserFactors = null;
    this.normalizedItemFactors = null;
  }

  // generates a prediction even if a user has already rated the item
  predict(data) {
    const u = data.map((v) => this.userMap.get(v.userId));
    const i = data.map((v) => this.itemMap.get(v.itemId));

    const newIndex = [];
    for (let j = 0; j < data.length; j++) {
      if (u[j] === undefined || i[j] === undefined) {
        newIndex.push(j);
      }
    }
    for (let j of newIndex) {
      u[j] = 0;
      i[j] = 0;
    }

    let predictions = [];
    for (let j = 0; j < data.length; j++) {
      const a = this.#userFactors[u[j]];
      const b = this.#itemFactors[i[j]];
      predictions.push(this.#innerProduct(a, b));
    }
    if (this.minRating !== null) {
      predictions = predictions.map((v) => Math.max(Math.min(v, this.maxRating), this.minRating));
    }
    for (let j of newIndex) {
      predictions[j] = this.#globalMean;
    }
    return predictions;
  }

  userRecs(userId, count = 5) {
    this.#checkFit();

    const u = this.userMap.get(userId);
    if (u === undefined) {
      return [];
    }

    const rated = this.rated.get(u);

    const factors = this.#userFactors[u];
    const predictions = this.#itemFactors.map((v) => this.#innerProduct(v, factors));

    let candidates = Array.from(predictions.entries());
    candidates.sort((a, b) => b[1] - a[1]);
    if (count !== null) {
      candidates = candidates.slice(0, count + rated.size);
    }

    if (this.minRating !== null) {
      for (let v of candidates) {
        v[1] = Math.max(Math.min(v[1], this.maxRating), this.minRating);
      }
    }

    const keys = Array.from(this.itemMap.keys());
    const result = [];
    for (let c of candidates) {
      if (rated.has(c[0])) {
        continue;
      }

      result.push({itemId: keys[c[0]], score: c[1]});
    }
    return result;
  }

  itemRecs(itemId, count = 5) {
    this.#checkFit();
    return this.#similar(itemId, 'itemId', this.itemMap, this.#normalizedItemFactors(), count);
  }

  similarUsers(userId, count = 5) {
    this.#checkFit();
    return this.#similar(userId, 'userId', this.userMap, this.#normalizedUserFactors(), count);
  }

  userIds() {
    return Array.from(this.userMap.keys());
  }

  itemIds() {
    return Array.from(this.itemMap.keys());
  }

  userFactors(userId) {
    const u = this.userMap.get(userId);
    return u !== undefined ? this.#userFactors[u] : null;
  }

  itemFactors(itemId) {
    const i = this.itemMap.get(itemId);
    return i !== undefined ? this.#itemFactors[i] : null;
  }

  globalMean() {
    return this.#globalMean;
  }

  #normalizedUserFactors() {
    this.normalizedUserFactors ??= this.#normalize(this.#userFactors);
    return this.normalizedUserFactors;
  }

  #normalizedItemFactors() {
    this.normalizedItemFactors ??= this.#normalize(this.#itemFactors);
    return this.normalizedItemFactors;
  }

  #normalize(factors) {
    return factors.map((row) => {
      const norm = this.#norm(row);
      if (norm > 0) {
        return row.map((x) => x / norm);
      }
      return row;
    });
  }

  #similar(id, key, map, normFactors, count) {
    const i = map.get(id);
    if (i === undefined) {
      return [];
    }

    const factors = normFactors[i];
    const predictions = normFactors.map((v) => this.#innerProduct(v, factors));

    let candidates = Array.from(predictions.entries());
    candidates.sort((a, b) => b[1] - a[1]);
    if (count !== null) {
      candidates = candidates.slice(0, count + 1);
    }

    const keys = Array.from(map.keys());

    const result = [];
    for (let c of candidates) {
      if (c[0] === i) {
        continue;
      }

      const v = {};
      v[key] = keys[c[0]];
      v['score'] = c[1];
      result.push(v);
    }
    return result;
  }

  #checkRatings(ratings) {
    for (let r of ratings) {
      if (!('rating' in r)) {
        throw new Error('Missing rating');
      }
    }
    for (let r of ratings) {
      if (typeof r.rating !== 'number') {
        throw new Error('Rating must be numeric');
      }
    }
  }

  #checkFit() {
    if (this.implicit === undefined) {
      throw new Error('Not fit');
    }
  }

  #innerProduct(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  #norm(row) {
    let sum = 0;
    for (let x of row) {
      sum += x * x;
    }
    return Math.sqrt(sum);
  }
};
