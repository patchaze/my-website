import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'src', 'data', 'countries.json');
const publicDir = path.join(__dirname, 'public');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const downloadImage = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            // Handle redirects, which Unsplash uses heavily
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                let redirectUrl = response.headers.location;
                if (redirectUrl.startsWith('/')) {
                    const urlObj = new URL(url);
                    redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
                }
                return downloadImage(redirectUrl, dest).then(resolve).catch(reject);
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
    console.log('Booting Headless Chrome to scrape Unsplash...');
    let count = 0;

    const browser = await puppeteer.launch({ headless: "new" });

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
            let keyword = encodeURIComponent(`${country.name} landmark`);
            if (country.name === 'Portugal') keyword = 'Porto';
            if (country.name === 'France') keyword = 'Paris';

            const searchUrl = `https://unsplash.com/s/photos/${keyword}`;

            try {
                const page = await browser.newPage();
                // Block non-essential requests to speed it up
                await page.setRequestInterception(true);
                page.on('request', (req) => {
                    if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
                        req.abort();
                    }
                    else {
                        req.continue();
                    }
                });

                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Unsplash image class often changes but getting the first image inside their figure/div grid works reliably
                const imageUrl = await page.evaluate(() => {
                    // Find all image tags in the main content area (excluding avatars/logos)
                    const imgs = Array.from(document.querySelectorAll('img')).filter(img => img.src.includes('images.unsplash.com/photo-'));
                    if (imgs.length > 0) {
                        // Extract the raw URL and append standard quality params
                        const rawUrl = imgs[0].src.split('?')[0];
                        return `${rawUrl}?auto=format&fit=crop&q=80&w=800`;
                    }
                    return null;
                });

                if (imageUrl) {
                    await downloadImage(imageUrl, path.join(publicDir, country.heroImage));
                    console.log(`✓ Scraped ${country.name} hero`);
                    count++;
                } else {
                    console.log(`✗ Failed to find image for ${country.name}`);
                }
                await page.close();
            } catch (e) {
                console.error(`✗ Puppeteer Error for ${country.name}`, e.message);
            }
        }

        // Be very polite to prevent IP bans
        await delay(1000);

        for (const city of country.cities) {
            const keywordCity = encodeURIComponent(`${city.name} city`);
            const searchUrl = `https://unsplash.com/s/photos/${keywordCity}`;

            try {
                const page = await browser.newPage();
                await page.setRequestInterception(true);
                page.on('request', (req) => {
                    if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
                        req.abort();
                    }
                    else {
                        req.continue();
                    }
                });

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
                    await downloadImage(imageUrl, path.join(publicDir, city.image));
                    console.log(`  ✓ Scraped ${city.name}`);
                    count++;
                } else {
                    console.log(`  ✗ Failed to find image for ${city.name}`);
                }
                await page.close();
            } catch (e) {
                console.error(`  ✗ Puppeteer Error for ${city.name}`, e.message);
            }

            await delay(1000);
        }
    }

    await browser.close();
    console.log(`\nSuccessfully downloaded ${count} authentic JPEG images!`);
}

main().catch(console.error);
