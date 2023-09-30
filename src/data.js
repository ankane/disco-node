import { createHash } from 'crypto';
import fs from 'fs';
import https from 'https';
import path from 'path';

export async function loadMovieLens() {
  const itemPath = await downloadFile(
    'ml-100k/u.item',
    'https://files.grouplens.org/datasets/movielens/ml-100k/u.item',
    '553841ebc7de3a0fd0d6b62a204ea30c1e651aacfb2814c7a6584ac52f2c5701'
  )

  const dataPath = await downloadFile(
    'ml-100k/u.data',
    'https://files.grouplens.org/datasets/movielens/ml-100k/u.data',
    '06416e597f82b7342361e41163890c81036900f418ad91315590814211dca490'
  )

  const movies = {};
  for (let line of readLines(itemPath)) {
    const row = line.split('|');
    movies[row[0]] = convertToUtf8(row[1]);
  }

  const data = [];
  for (let line of readLines(dataPath)) {
    const row = line.split('\t');
    data.push({
      userId: parseInt(row[0]),
      itemId: movies[row[1]],
      rating: parseInt(row[2])
    });
  }

  return data;
}

async function downloadFile(filename, url, fileHash) {
  // TODO handle this better
  const home = process.env['HOME'];
  if (!home) {
    throw new Error('No HOME');
  }

  const dest = `${home}/.disco/${filename}`;
  if (fs.existsSync(dest)) {
    return dest;
  }

  if (!fs.existsSync(path.dirname(dest))) {
    fs.mkdirSync(path.dirname(dest), {recursive: true});
  }

  console.log(`Downloading data from ${url}`);
  const contents = await get(url);

  const hash = createHash('sha256');
  const checksum = hash.update(contents).digest('hex');
  if (checksum != fileHash) {
    throw new Error(`Bad checksum: ${checksum}`);
  }
  console.log('✔ Success');

  await fs.writeFileSync(dest, contents);

  return dest;
}

async function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => { chunks.push(chunk); });
      res.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    }).on('error', (e) => {
      reject(e);
    });
  });
}

function readLines(path) {
  const lines = fs.readFileSync(path).toString('binary').split('\n');
  lines.pop();
  return lines;
}

function convertToUtf8(str) {
  const b = [];
  // iterate over bytes
  const s = Buffer.from(str, 'binary');
  for (let i = 0; i < s.length; i++) {
    const v = s[i];
    // ISO-8859-1 to UTF-8
    // first 128 are same
    if (v < 128) {
      b.push(v);
    } else {
      b.push(195, v - 64);
    }
  }
  return Buffer.from(b).toString('utf8');
}
