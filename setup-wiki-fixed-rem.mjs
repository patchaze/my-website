import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

const fixes = [
    { name: 'Bulgaria', file: '/images/destinations/bulgaria.jpg', title: 'Alexander_Nevsky_Cathedral,_Sofia' },
    { name: 'Bled', file: '/images/destinations/bled.jpg', title: 'Lake_Bled' }
];

const downloadImage = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, { headers: { 'User-Agent': 'DurianTravelScript/1.0 (patricia@example.com)' } }, (response) => {
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

const getWikipediaImageUrl = (title) => {
    return new Promise((resolve, reject) => {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=1000`;
        https.get(searchUrl, {
            headers: {
                'User-Agent': 'DurianTravelScript/1.0 (patricia@example.com)'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const pages = json.query?.pages;
                    if (!pages) return resolve(null);

                    const pageId = Object.keys(pages)[0];
                    if (pageId === '-1' || !pages[pageId].thumbnail) {
                        return resolve(null);
                    }
                    resolve(pages[pageId].thumbnail.source);
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', reject);
    });
};

async function main() {
    for (const fix of fixes) {
        const url = await getWikipediaImageUrl(fix.title);
        if (url) {
            await downloadImage(url, path.join(publicDir, fix.file));
            console.log(`✓ Fixed ${fix.name} using ${fix.title}`);
        } else {
            console.log(`✗ Still failed ${fix.name}`);
        }
    }
}

main().catch(console.error);
