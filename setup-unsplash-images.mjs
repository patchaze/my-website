import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'src', 'data', 'countries.json');
const publicDir = path.join(__dirname, 'public');

// Helper to follow Unsplash's redirect from the source API to the actual CDN URL
const resolveUnsplashUrl = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Return the final CDN URL
                resolve(res.headers.location);
            } else {
                reject(new Error(`Expected redirect but got ${res.statusCode}`));
            }
        }).on('error', reject);
    });
};

const downloadImage = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            // Just in case the CDN URL redirects again, capture it (unlikely)
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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    const countries = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    console.log('Downloading actual JPEGs from Unsplash source redirects...');
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
            let keyword = encodeURIComponent(country.name);
            if (country.name === 'Portugal') keyword = 'Porto';
            if (country.name === 'France') keyword = 'Paris';

            // This hits the Unsplash endpoint which returns a 302 redirect
            const sourceUrl = `https://source.unsplash.com/800x800/?${keyword},landmark`;
            const destCountry = path.join(publicDir, country.heroImage);

            try {
                // First we resolve the actual CDN url, this bypasses the weird HTML issue
                const finalImageCdnUrl = await resolveUnsplashUrl(sourceUrl);
                await downloadImage(finalImageCdnUrl, destCountry);
                console.log(`✓ Downloaded ${country.name} hero`);
                count++;
            } catch (e) {
                console.error(`✗ Failed ${country.name}`, e);
            }
        }
        await delay(300);

        for (const city of country.cities) {
            const keywordCity = encodeURIComponent(city.name);
            const sourceCityUrl = `https://source.unsplash.com/800x800/?${keywordCity},city`;
            const destCity = path.join(publicDir, city.image);

            try {
                const finalImageCdnUrl = await resolveUnsplashUrl(sourceCityUrl);
                await downloadImage(finalImageCdnUrl, destCity);
                console.log(`  ✓ Downloaded ${city.name}`);
                count++;
            } catch (e) {
                console.error(`  ✗ Failed ${city.name}`, e);
            }
            await delay(300);
        }
    }

    console.log(`\nSuccessfully downloaded ${count} authentic JPEG images!`);
}

main().catch(console.error);
