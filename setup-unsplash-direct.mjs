import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'src', 'data', 'countries.json');
const publicDir = path.join(__dirname, 'public');

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

// We hit the unsplash search endpoint using their next.js public data API
// e.g. https://unsplash.com/napi/search/photos?query=porto&per_page=1
const getUnsplashPhotoUrl = (query) => {
    return new Promise((resolve, reject) => {
        const searchUrl = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=1`;
        https.get(searchUrl, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.results && json.results.length > 0) {
                        const photo = json.results[0];
                        // return regular sized URL (which is 1080w)
                        resolve(photo.urls.regular);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', reject);
    });
};

async function main() {
    const countries = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log('Fetching exactly one real image from Unsplash for each location...');

    let success = 0;

    for (const country of countries) {
        console.log(`\nProcessing ${country.name}...`);

        // Maintain existing logic for the two static assets you requested
        if (country.name === 'Italy') {
            fs.copyFileSync(path.join(publicDir, 'images', 'card-amalfi.png'), path.join(publicDir, country.heroImage));
            console.log(`✓ Copied local Amalfi hero for Italy`);
            success++;
        } else if (country.name === 'Switzerland') {
            fs.copyFileSync(path.join(publicDir, 'images', 'card-alps.png'), path.join(publicDir, country.heroImage));
            console.log(`✓ Copied local Alps hero for Switzerland`);
            success++;
        } else {
            let query = `${country.name} landmark`;
            if (country.name === 'Portugal') query = 'Porto';
            if (country.name === 'France') query = 'Paris';
            if (country.name === 'Liechtenstein') query = 'Vaduz Castle';

            const url = await getUnsplashPhotoUrl(query);
            if (url) {
                await downloadImage(url, path.join(publicDir, country.heroImage));
                console.log(`✓ Downloaded Unsplash hero image for ${country.name} (${query})`);
                success++;
            } else {
                console.log(`✗ Failed to find Unsplash image for ${country.name}`);
            }
        }
        await delay(500); // Be polite

        for (const city of country.cities) {
            const query = `${city.name} city`;
            const curl = await getUnsplashPhotoUrl(query);
            if (curl) {
                await downloadImage(curl, path.join(publicDir, city.image));
                console.log(`  ✓ Downloaded Unsplash city image for ${city.name} (${query})`);
                success++;
            } else {
                console.log(`  ✗ Failed to find Unsplash image for ${city.name}`);
            }
            await delay(500); // Be polite
        }
    }

    console.log(`\nFinished! Successfully snagged ${success} Unsplash JPEG images.`);
}

main().catch(console.error);
