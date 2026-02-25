import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'src', 'data', 'countries.json');
const publicDir = path.join(__dirname, 'public');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to use native fetch for better browser-like behavior and easy retries
const downloadImageWithRetry = async (url, dest, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });

            if (response.status === 429 || response.status === 403) {
                console.log(`    Rate limited (${response.status}). Waiting...`);
                await delay(2000 * (i + 1));
                continue;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                throw new Error('Received HTML instead of image');
            }

            const buffer = await response.arrayBuffer();
            fs.writeFileSync(dest, Buffer.from(buffer));

            // Validate size
            const stats = fs.statSync(dest);
            if (stats.size < 5000) {
                throw new Error(`File too small (${stats.size} bytes), likely an error page.`);
            }
            return true;
        } catch (e) {
            console.log(`    Attempt ${i + 1} failed: ${e.message}`);
            await delay(1500);
        }
    }
    return false;
};

const getWikimediaImage = async (query) => {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=filetype:bitmap|drawing ${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json`;

    try {
        const response = await fetch(searchUrl, {
            headers: { 'User-Agent': 'DurianTravel/1.0 (patricia@example.com)' }
        });
        const json = await response.json();
        if (json.query && json.query.pages) {
            const pages = Object.values(json.query.pages);
            if (pages.length > 0 && pages[0].imageinfo && pages[0].imageinfo.length > 0) {
                return pages[0].imageinfo[0].thumburl || pages[0].imageinfo[0].url;
            }
        }
    } catch (e) {
        // ignore
    }
    return null;
};

async function main() {
    const countries = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    console.log('Fixing corrupted 2KB HTML error pages with authentic JPEGs...');
    let fixedCount = 0;

    for (const country of countries) {
        if (country.name === 'Italy' || country.name === 'Switzerland') continue;

        // Check if the country hero needs fixing
        const destCountry = path.join(publicDir, country.heroImage);
        const statC = fs.statSync(destCountry);
        if (statC.size < 5000) {
            let keyword = `${country.name} landmark`;
            if (country.name === 'Portugal') keyword = 'Porto Portugal';
            if (country.name === 'France') keyword = 'Eiffel Tower Paris';
            if (country.name === 'Liechtenstein') keyword = 'Vaduz Castle';

            console.log(`\nFixing ${country.name} hero...`);
            const imageUrl = await getWikimediaImage(keyword);
            if (imageUrl) {
                const success = await downloadImageWithRetry(imageUrl, destCountry);
                if (success) {
                    console.log(`✓ Fixed ${country.name} hero`);
                    fixedCount++;
                } else {
                    console.log(`✗ Could not download ${country.name} hero`);
                }
            } else {
                console.log(`✗ Could not find image for ${keyword}`);
            }
            await delay(1000);
        }

        for (const city of country.cities) {
            const destCity = path.join(publicDir, city.image);
            const statCity = fs.statSync(destCity);
            if (statCity.size < 5000) {
                console.log(`Fixing ${city.name} city...`);
                let cityKeyword = `${city.name} city panorama`;
                let imageUrl = await getWikimediaImage(cityKeyword);
                if (!imageUrl) {
                    imageUrl = await getWikimediaImage(city.name);
                }

                if (imageUrl) {
                    const success = await downloadImageWithRetry(imageUrl, destCity);
                    if (success) {
                        console.log(`  ✓ Fixed ${city.name}`);
                        fixedCount++;
                    } else {
                        console.log(`  ✗ Could not download ${city.name}`);
                    }
                } else {
                    console.log(`  ✗ Could not find image for ${city.name}`);
                }
                await delay(1000);
            }
        }
    }

    console.log(`\nSuccessfully fixed ${fixedCount} corrupted images!`);
}

main().catch(console.error);
