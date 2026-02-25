import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'src', 'data', 'countries.json');
const publicDir = path.join(__dirname, 'public');
const destDir = path.join(publicDir, 'images', 'destinations');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Download a high quality placeholder from Unsplash
const placeholderUrl = 'https://images.unsplash.com/photo-1518331647614-7a1f04cd34cb?q=80&w=800&auto=format&fit=crop';
const placeholderPath = path.join(destDir, 'placeholder.jpg');

const download = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

async function main() {
  console.log('Downloading placeholder image...');
  await download(placeholderUrl, placeholderPath);
  console.log('Placeholder downloaded.');

  const countries = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  let count = 0;

  for (const country of countries) {
    const heroImg = path.join(publicDir, country.heroImage);
    if (!fs.existsSync(heroImg)) {
      fs.copyFileSync(placeholderPath, heroImg);
      count++;
    }

    for (const city of country.cities) {
      const cityImg = path.join(publicDir, city.image);
      if (!fs.existsSync(cityImg)) {
        fs.copyFileSync(placeholderPath, cityImg);
        count++;
      }
    }
  }

  console.log(`Created ${count} placeholder images.`);
}

main().catch(console.error);
