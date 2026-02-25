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

const getPexelsSearchImage = (query) => {
    return new Promise((resolve, reject) => {
        const searchUrl = `https://www.pexels.com/search/${encodeURIComponent(query)}/`;
        https.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    // Find the first image that looks like a photo result
                    // Typical format: https://images.pexels.com/photos/12345/pexels-photo-12345.jpeg?auto=compress&cs=tinysrgb&w=800
                    const match = data.match(/https:\/\/images\.pexels\.com\/photos\/\d+\/[^"'\s]+\.(?:jpeg|jpg|png)(?:\?[^"'\s]+w=800[^"'\s]*)?/i);

                    if (match && match[0]) {
                        // Ensure it requests an 800px width version
                        let finalUrl = match[0];
                        if (!finalUrl.includes('w=')) {
                            finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'auto=compress&cs=tinysrgb&w=800';
                        } else {
                            finalUrl = finalUrl.replace(/w=\d+/, 'w=800');
                        }
                        return resolve(finalUrl);
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

    console.log('Scraping exactly one image from Pexels search...');
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
            let keyword = `${country.name} landmark`;
            if (country.name === 'Portugal') keyword = 'Porto';
            if (country.name === 'France') keyword = 'Paris';

            try {
                const finalImageUrl = await getPexelsSearchImage(keyword);
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
        await delay(300);

        for (const city of country.cities) {
            const keywordCity = `${city.name} city`;
            const destCity = path.join(publicDir, city.image);

            try {
                const finalImageUrl = await getPexelsSearchImage(keywordCity);
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
            await delay(300);
        }
    }

    console.log(`\nSuccessfully downloaded ${count} authentic Pexels images!`);
}

main().catch(console.error);
