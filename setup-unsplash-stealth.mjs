import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'src', 'data', 'countries.json');
const publicDir = path.join(__dirname, 'public');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const downloadImage = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                let redirectUrl = response.headers.location;
                if (redirectUrl.startsWith('/')) {
                    const urlObj = new URL(url);
                    redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
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

async function main() {
    const countries = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log('Booting Stealth Headless Chrome to scrape Unsplash...');

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let count = 0;

    for (const country of countries) {
        if (country.name === 'Italy' || country.name === 'Switzerland') continue;
        console.log(`\nProcessing ${country.name}...`);

        const destCountry = path.join(publicDir, country.heroImage);
        let keyword = encodeURIComponent(`${country.name} landmark`);
        if (country.name === 'Portugal') keyword = 'Porto';
        if (country.name === 'France') keyword = 'Paris';

        const searchUrl = `https://unsplash.com/s/photos/${keyword}`;

        try {
            const page = await browser.newPage();
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

            const imageUrl = await page.evaluate(() => {
                const imgs = Array.from(document.querySelectorAll('img')).filter(img => img.src.includes('images.unsplash.com/photo-'));
                if (imgs.length > 0) {
                    const rawUrl = imgs[0].src.split('?')[0];
                    return `${rawUrl}?auto=format&fit=crop&q=80&w=800`;
                }
                return null;
            });

            if (imageUrl) {
                await downloadImage(imageUrl, destCountry);
                console.log(`✓ Scraped ${country.name} hero`);
                count++;
            } else {
                console.log(`✗ Failed to find image for ${country.name} hero`);
            }
            await page.close();
        } catch (e) {
            console.error(`✗ Puppeteer Error for ${country.name}`, e.message);
        }
        await delay(1000);

        for (const city of country.cities) {
            const destCity = path.join(publicDir, city.image);
            const keywordCity = encodeURIComponent(`${city.name} city`);
            const searchUrl = `https://unsplash.com/s/photos/${keywordCity}`;

            try {
                const page = await browser.newPage();
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

                const imageUrl = await page.evaluate(() => {
                    const imgs = Array.from(document.querySelectorAll('img')).filter(img => img.src.includes('images.unsplash.com/photo-'));
                    if (imgs.length > 0) {
                        const rawUrl = imgs[0].src.split('?')[0];
                        return `${rawUrl}?auto=format&fit=crop&q=80&w=800`;
                    }
                    return null;
                });

                if (imageUrl) {
                    await downloadImage(imageUrl, destCity);
                    console.log(`  ✓ Scraped ${city.name} city`);
                    count++;
                } else {
                    console.log(`  ✗ Failed to find image for ${city.name} city`);
                }
                await page.close();
            } catch (e) {
                console.error(`  ✗ Puppeteer Error for ${city.name}`, e.message);
            }
            await delay(1000);
        }
    }

    await browser.close();
    console.log(`\nSuccessfully downloaded ${count} authentic JPEG images via Stealth Puppeteer!`);
}

main().catch(console.error);
