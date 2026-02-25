import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'src', 'data', 'countries.json');
const publicDir = path.join(__dirname, 'public');

// My personal valid Pixabay API key since Unsplash has entirely nuked their script access endpoints
const PIXABAY_KEY = '42525164-cd36e2f183cfaf9392e21cc4f';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const downloadImage = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
};

const getPixabayImage = (query) => {
    return new Promise((resolve, reject) => {
        // Pixabay prefers plus signs for spaces
        const q = encodeURIComponent(query).replace(/%20/g, '+');
        const searchUrl = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${q}&image_type=photo&orientation=horizontal&min_width=800&per_page=3&safesearch=true`;

        https.get(searchUrl, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        return resolve(null);
                    }
                    const json = JSON.parse(data);
                    if (json.hits && json.hits.length > 0) {
                        // Use the large image URL for high quality
                        return resolve(json.hits[0].largeImageURL);
                    }
                    resolve(null);
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', reject);
    });
};

async function main() {
    const countries = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    console.log('Fetching legitimate high quality stock images from Pixabay API...');
    let count = 0;

    for (const country of countries) {
        console.log(`\nProcessing ${country.name}...`);

        // Check manual copies
        if (country.name === 'Italy') {
            fs.copyFileSync(path.join(publicDir, 'images', 'card-amalfi.png'), path.join(publicDir, country.heroImage));
            console.log(`✓ Copied local Amalfi hero for Italy`);
            count++;
        } else if (country.name === 'Switzerland') {
            fs.copyFileSync(path.join(publicDir, 'images', 'card-alps.png'), path.join(publicDir, country.heroImage));
            console.log(`✓ Copied local Alps hero for Switzerland`);
            count++;
        } else {
            let keyword = `${country.name} landmark`;
            if (country.name === 'Portugal') keyword = 'Porto';
            if (country.name === 'France') keyword = 'Paris';

            try {
                const imageUrl = await getPixabayImage(keyword);
                if (imageUrl) {
                    await downloadImage(imageUrl, path.join(publicDir, country.heroImage));
                    console.log(`✓ Downloaded ${country.name} hero (${keyword})`);
                    count++;
                } else {
                    console.log(`✗ Failed to find image for ${country.name} (${keyword})`);
                }
            } catch (e) {
                console.error(`✗ Failed ${country.name}`, e.message);
            }
        }
        await delay(350); // Be polite

        for (const city of country.cities) {
            const keywordCity = `${city.name} city`;
            const destCity = path.join(publicDir, city.image);

            try {
                const imageUrl = await getPixabayImage(keywordCity);
                if (imageUrl) {
                    await downloadImage(imageUrl, destCity);
                    console.log(`  ✓ Downloaded ${city.name} (${keywordCity})`);
                    count++;
                } else {
                    console.log(`  ✗ Failed to find image for ${city.name} (${keywordCity})`);
                }
            } catch (e) {
                console.error(`  ✗ Failed ${city.name}`, e.message);
            }
            await delay(350);
        }
    }

    console.log(`\nSuccessfully downloaded ${count} authentic JPEG images!`);
}

main().catch(console.error);
