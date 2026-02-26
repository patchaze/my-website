import puppeteer from 'puppeteer';
import { spawn } from 'child_process';

async function measureHeroHeight() {
    console.log('Starting dev server...');
    const devServer = spawn('npm', ['run', 'dev'], {
        cwd: process.cwd(),
        shell: true
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Launching browser...');
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    // Set to mobile viewport: iPhone 12 Pro dimensions
    await page.setViewport({ width: 390, height: 844 });

    try {
        console.log('Navigating to local site...');
        await page.goto('http://localhost:4321');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get bounding boxes of all hero elements
        const heroMetrics = await page.evaluate(() => {
            const hero = document.querySelector('.hero');
            const content = document.querySelector('.hero__content');
            const visuals = document.querySelector('.hero__visuals');

            return {
                hero: hero ? hero.getBoundingClientRect().height : null,
                content: content ? content.getBoundingClientRect().height : null,
                visuals: visuals ? visuals.getBoundingClientRect().height : null,
                heroPaddingTop: hero ? window.getComputedStyle(hero).paddingTop : null,
                heroPaddingBottom: hero ? window.getComputedStyle(hero).paddingBottom : null,
                visualsMarginTop: visuals ? window.getComputedStyle(visuals).marginTop : null
            };
        });

        console.log('--- Hero Sizing Metrics (390px width) ---');
        console.log(heroMetrics);

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        console.log('Cleaning up...');
        await browser.close();
        devServer.kill();
        process.exit(0);
    }
}

measureHeroHeight();
