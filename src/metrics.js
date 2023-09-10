export default class Metrics {
  static rmse(act, exp) {
    if (act.length !== exp.length) {
      throw new Error('Size mismatch');
    }
    let sum = 0;
    const count = act.length;
    for (let i = 0; i < count; i++) {
      const diff = act[i] - exp[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum / count);
  }
}
