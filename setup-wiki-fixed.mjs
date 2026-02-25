import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'src', 'data', 'countries.json');
const publicDir = path.join(__dirname, 'public');

// Custom mapping for captivating hero shots
const heroMapping = {
    "Austria": "Hallstatt",
    "Belgium": "Grand-Place",
    "France": "Eiffel_Tower",
    "Germany": "Neuschwanstein_Castle",
    "Luxembourg": "Luxembourg_City",
    "Netherlands": "Kinderdijk",
    "Greece": "Santorini",
    // Italy will be manually copied
    "Malta": "Valletta",
    "Portugal": "Luís_I_Bridge",
    "Spain": "Sagrada_Família",
    "Denmark": "Nyhavn",
    "Finland": "Suomenlinna",
    "Iceland": "Blue_Lagoon_(geothermal_spa)",
    "Norway": "Geirangerfjord",
    "Sweden": "Stockholm_Palace",
    "Croatia": "Dubrovnik",
    "Czech Republic": "Charles_Bridge",
    "Estonia": "Tallinn",
    "Hungary": "Hungarian_Parliament_Building",
    "Latvia": "Riga",
    "Lithuania": "Trakai_Island_Castle",
    "Poland": "Main_Square,_Kraków",
    "Slovakia": "Bratislava_Castle",
    "Slovenia": "Lake_Bled",
    "Liechtenstein": "Vaduz_Castle",
    // Switzerland will be manually copied
    "Bulgaria": "Alexander_Nevsky_Cathedral,_Sofia",
    "Romania": "Bran_Castle"
};

const delay = ms => new Promise(res => setTimeout(res, ms));

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
    const countries = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log('Fetching real images from Wikipedia...');

    let success = 0;

    for (const country of countries) {
        console.log(`\nProcessing ${country.name}...`);

        // Check manual copies
        if (country.name === 'Italy') {
            fs.copyFileSync(path.join(publicDir, 'images', 'card-amalfi.png'), path.join(publicDir, country.heroImage));
            console.log(`✓ Copied local Amalfi hero for Italy`);
            success++;
        } else if (country.name === 'Switzerland') {
            fs.copyFileSync(path.join(publicDir, 'images', 'card-alps.png'), path.join(publicDir, country.heroImage));
            console.log(`✓ Copied local Alps hero for Switzerland`);
            success++;
        } else {
            const searchTitle = heroMapping[country.name] || country.name;
            const url = await getWikipediaImageUrl(searchTitle);
            if (url) {
                await downloadImage(url, path.join(publicDir, country.heroImage));
                console.log(`✓ Downloaded hero image for ${country.name} (${searchTitle})`);
                success++;
            } else {
                console.log(`✗ Failed to find hero image for ${country.name} (${searchTitle})`);
            }
        }
        await delay(200);

        for (const city of country.cities) {
            let citySearch = city.name;
            if (city.name === 'Nice') citySearch = 'Nice';
            else if (city.name === 'Split') citySearch = 'Split,_Croatia';
            else if (city.name === 'Bled') citySearch = 'Bled,_Slovenia';
            else if (city.name === 'Porto') citySearch = 'Porto';
            else if (city.name === 'Krakow') citySearch = 'Kraków';
            else if (city.name === 'Gdansk') citySearch = 'Gdańsk';
            else if (city.name === 'Tromso') citySearch = 'Tromsø';
            else if (city.name === 'Malmo') citySearch = 'Malmö';
            else if (city.name === 'Kosice') citySearch = 'Košice';
            else if (city.name === 'Zilina') citySearch = 'Žilina';
            else if (city.name === 'Parnu') citySearch = 'Pärnu';
            else if (city.name === 'Brasov') citySearch = 'Brașov';
            else if (city.name === 'Cesky Krumlov') citySearch = 'Český_Krumlov';
            else if (city.name === 'Varna') citySearch = 'Varna,_Bulgaria';
            else if (city.name === 'Reykjavik') citySearch = 'Reykjavík';
            else if (city.name === 'Vik') citySearch = 'Vík_í_Mýrdal';
            else if (city.name === 'Klaipeda') citySearch = 'Klaipėda';
            else if (city.name === 'Jurmala') citySearch = 'Jūrmala';

            const curl = await getWikipediaImageUrl(citySearch);
            if (curl) {
                await downloadImage(curl, path.join(publicDir, city.image));
                console.log(`  ✓ Downloaded city image for ${city.name} (${citySearch})`);
                success++;
            } else {
                console.log(`  ✗ Failed to find city image for ${city.name} (${citySearch})`);
            }
            await delay(200);
        }
    }

    console.log(`\nFinished! Successfully grabbed ${success} images.`);
}

main().catch(console.error);
