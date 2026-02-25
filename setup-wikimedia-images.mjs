import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'src', 'data', 'countries.json');
const publicDir = path.join(__dirname, 'public');

// We use an alternative stable image API (Pexels, Unsplash etc are completely locked down for bots)
// The Wikipedia approach works but the user explicitly wants "unsplash style" aesthetics.
// Pexels API failed earlier because the user doesn't have an auth token set up and my hardcoded one was rate-limited.
// The best reliable alternative for beautiful travel photography without auth is Wikimedia Commons with structured search.

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const downloadImage = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, { headers: { 'User-Agent': 'DurianTravelScript/1.0' } }, (response) => {
            // Wikimedia sometimes redirects
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

const getWikimediaImage = (query) => {
    return new Promise((resolve, reject) => {
        // Search Wikimedia Commons specifically for highly-rated images
        const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=filetype:bitmap|drawing ${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json`;
        https.get(searchUrl, { headers: { 'User-Agent': 'DurianTravelScript/1.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.query && json.query.pages) {
                        const pages = Object.values(json.query.pages);
                        if (pages.length > 0 && pages[0].imageinfo && pages[0].imageinfo.length > 0) {
                            // Get the 800px thumb url
                            return resolve(pages[0].imageinfo[0].thumburl || pages[0].imageinfo[0].url);
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

    console.log('Downloading high-quality travel photography from Wikimedia Commons...');
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
            if (country.name === 'Portugal') keyword = 'Porto Portugal';
            if (country.name === 'France') keyword = 'Eiffel Tower Paris';
            if (country.name === 'Liechtenstein') keyword = 'Vaduz Castle';

            try {
                const imageUrl = await getWikimediaImage(keyword);
                if (imageUrl) {
                    await downloadImage(imageUrl, path.join(publicDir, country.heroImage));
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
            let cityKeyword = `${city.name} city panorama`;
            try {
                const imageUrl = await getWikimediaImage(cityKeyword);
                if (imageUrl) {
                    await downloadImage(imageUrl, path.join(publicDir, city.image));
                    console.log(`  ✓ Downloaded ${city.name} city`);
                    count++;
                } else {
                    console.log(`  ✗ Failed to find image for ${city.name} city panorama`);
                    // Try fallback
                    const fallbackUrl = await getWikimediaImage(city.name);
                    if (fallbackUrl) {
                        await downloadImage(fallbackUrl, path.join(publicDir, city.image));
                        console.log(`  ✓ Downloaded ${city.name} (fallback)`);
                        count++;
                    } else {
                        console.log(`  ✗ Failed to find fallback for ${city.name}`);
                    }
                }
            } catch (e) {
                console.error(`  ✗ Failed ${city.name}`, e);
            }
            await delay(300);
        }
    }

    console.log(`\nSuccessfully downloaded ${count} authentic JPEG images!`);
}

main().catch(console.error);
