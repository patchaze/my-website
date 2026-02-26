import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';

async function testMobileNav() {
    console.log('Starting dev server...');
    const devServer = spawn('npm', ['run', 'dev'], {
        cwd: process.cwd(),
        shell: true
    });

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Launching browser...');
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    // Set to mobile viewport
    await page.setViewport({ width: 375, height: 812 });

    try {
        console.log('Navigating to local site...');
        await page.goto('http://localhost:4321');

        // Wait for the hydration script to attach
        await new Promise(resolve => setTimeout(resolve, 1000));

        const toggleBtn = await page.$('#nav-toggle');
        if (!toggleBtn) throw new Error('Could not find #nav-toggle button');

        console.log('Clicking hamburger menu...');
        await toggleBtn.click();

        // Wait for animation frame
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check classes and styles
        const menuEl = await page.$('#nav-mobile');
        const classList = await page.evaluate(el => Array.from(el.classList), menuEl);
        const computedStyle = await page.evaluate(el => window.getComputedStyle(el).display, menuEl);
        const btnAria = await page.evaluate(el => el.getAttribute('aria-expanded'), toggleBtn);

        console.log('--- Test Results ---');
        console.log('Menu Classes:', classList);
        console.log('Menu Computed Display:', computedStyle);
        console.log('Button aria-expanded:', btnAria);

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        console.log('Cleaning up...');
        await browser.close();
        devServer.kill();
        process.exit(0);
    }
}

testMobileNav();
