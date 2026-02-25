import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'src', 'data', 'countries.json');
const publicDir = path.join(__dirname, 'public');

// We use picsum.photos with a seed. This ensures every country/city gets a unique pseudo-random image, and it's very fast.
const download = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                let redirectUrl = response.headers.location;
                if (redirectUrl.startsWith('/')) {
                    const parsedUrl = new URL(url);
                    redirectUrl = `${parsedUrl.protocol}//${parsedUrl.host}${redirectUrl}`;
                }
                return download(redirectUrl, dest).then(resolve).catch(reject);
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
};

async function main() {
    const countries = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log('Downloading unique images from Picsum via seeds...');

    const promises = [];

    for (const country of countries) {
        const seedC = encodeURIComponent(country.name.toLowerCase().replace(/\s/g, ''));
        const urlCountry = `https://picsum.photos/seed/${seedC}/800/800`;
        const destCountry = path.join(publicDir, country.heroImage);
        promises.push(download(urlCountry, destCountry).then(() => console.log(`Downloaded ${country.name}`)));

        for (const city of country.cities) {
            const seedCity = encodeURIComponent(city.name.toLowerCase().replace(/\s/g, ''));
            const urlCity = `https://picsum.photos/seed/${seedCity}/800/800`;
            const destCity = path.join(publicDir, city.image);
            promises.push(download(urlCity, destCity).then(() => console.log(`Downloaded ${city.name}`)));
        }
    }

    // Promise.all to download them in parallel because Picsum is fast
    await Promise.all(promises);
    console.log('\nSuccessfully downloaded all 116 images!');
}

main().catch(console.error);
