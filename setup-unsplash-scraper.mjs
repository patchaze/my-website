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
            // Unsplash CND might redirect
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                let redirectUrl = response.headers.location;
                if (redirectUrl.startsWith('/')) {
                    const parsedUrl = new URL(url);
                    redirectUrl = `${parsedUrl.protocol}//${parsedUrl.host}${redirectUrl}`;
                }
                return downloadImage(redirectUrl, dest).then(resolve).catch(reject);
            }

            response.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
};

// Hit the main HTML search page and parse the first image URL out of the window.__INITIAL_STATE__ JSON
const getUnsplashSearchImage = (query) => {
    return new Promise((resolve, reject) => {
        const searchUrl = `https://unsplash.com/s/photos/${encodeURIComponent(query)}`;
        https.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(null); // Just give up on redirects here
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    // Unsplash embeds the initial state in a script tag
                    const match = data.match(/window\.__INITIAL_STATE__\s*=\s*(.*);<\/script>/);
                    if (match && match[1]) {
                        const state = JSON.parse(match[1]);
                        // dig through the horror of their redux state to find the first search result photo
                        // It's usually in state.entities.photos
                        if (state && state.entities && state.entities.photos) {
                            const photoIds = Object.keys(state.entities.photos);
                            if (photoIds.length > 0) {
                                // get the regular size url
                                const url = state.entities.photos[photoIds[0]].urls.regular;
                                return resolve(url);
                            }
                        }
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

    console.log('Scraping exactly one image from Unsplash.com search...');
    let count = 0;

    for (const country of countries) {
        console.log(`\nProcessing ${country.name}...`);

        if (country.name === 'Italy') {
            fs.copyFileSync(path.join(publicDir, 'images', 'card-amalfi.png'), path.join(publicDir, country.heroImage));
            console.log(`✓ Copied local Amalfi hero for Italy`);
            count++;
        } else if (country.name === 'Switzerland') {
            fs.copyFileSync(path.join(publicDir, 'images', 'card-alps.png'), path.join(publicDir, country.heroImage));
            console.log(`✓ Copied local Alps hero for Switzerland`);
            count++;
        } else {
            let keyword = `${country.name}`;
            if (country.name === 'Portugal') keyword = 'Porto Portugal';
            if (country.name === 'France') keyword = 'Paris France';

            try {
                const finalImageUrl = await getUnsplashSearchImage(keyword);
                if (finalImageUrl) {
                    await downloadImage(finalImageUrl, path.join(publicDir, country.heroImage));
                    console.log(`✓ Downloaded ${country.name} hero`);
                    count++;
                } else {
                    console.log(`✗ Failed to find image for ${country.name}`);
                }
            } catch (e) {
                console.error(`✗ Failed ${country.name}`, e);
            }
        }
        await delay(1000); // Be polite

        for (const city of country.cities) {
            const keywordCity = `${city.name} city`;
            const destCity = path.join(publicDir, city.image);

            try {
                const finalImageUrl = await getUnsplashSearchImage(keywordCity);
                if (finalImageUrl) {
                    await downloadImage(finalImageUrl, destCity);
                    console.log(`  ✓ Downloaded ${city.name}`);
                    count++;
                } else {
                    console.log(`  ✗ Failed to find image for ${city.name}`);
                }
            } catch (e) {
                console.error(`  ✗ Failed ${city.name}`, e);
            }
            await delay(1000); // Be polite
        }
    }

    console.log(`\nSuccessfully downloaded ${count} authentic JPEG images!`);
}

main().catch(console.error);
