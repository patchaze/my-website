import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'src', 'data', 'countries.json');
const publicDir = path.join(__dirname, 'public');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Force the use of fetch API to mimic a browser, instead of Node HTTP module which gets blocked
const getRedirectedUrl = async (url) => {
    try {
        const response = await fetch(url, {
            redirect: 'follow', // Fetch automatically follows the redirect
            headers: {
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        return response.url; // fetch provides the final resolved URL after redirects
    } catch (e) {
        throw e;
    }
};

const downloadImage = async (url, dest) => {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://unsplash.com/'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(dest, Buffer.from(buffer));
};

async function main() {
    const countries = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    console.log('Fetching Unsplash images using browser-mimicking Fetch API...');
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
            let keyword = encodeURIComponent(country.name);
            if (country.name === 'Portugal') keyword = 'Porto';
            if (country.name === 'France') keyword = 'Paris';

            const sourceUrl = `https://source.unsplash.com/800x800/?${keyword},landmark`;
            const destCountry = path.join(publicDir, country.heroImage);

            try {
                const finalImageCdnUrl = await getRedirectedUrl(sourceUrl);
                await downloadImage(finalImageCdnUrl, destCountry);
                console.log(`✓ Downloaded ${country.name} hero`);
                count++;
            } catch (e) {
                console.error(`✗ Failed ${country.name}`, e.message);
            }
        }
        await delay(300);

        for (const city of country.cities) {
            const keywordCity = encodeURIComponent(city.name);
            const sourceCityUrl = `https://source.unsplash.com/800x800/?${keywordCity},city`;
            const destCity = path.join(publicDir, city.image);

            try {
                const finalImageCdnUrl = await getRedirectedUrl(sourceCityUrl);
                await downloadImage(finalImageCdnUrl, destCity);
                console.log(`  ✓ Downloaded ${city.name}`);
                count++;
            } catch (e) {
                console.error(`  ✗ Failed ${city.name}`, e.message);
            }
            await delay(300);
        }
    }

    console.log(`\nSuccessfully downloaded ${count} authentic JPEG images!`);
}

main().catch(console.error);
