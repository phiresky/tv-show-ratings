const puppeteer = require('puppeteer');

(async () => {
        const browser = await puppeteer.launch({args: ["--no-sandbox"]});
        const page = await browser.newPage();
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        await page.goto('https://phiresky.github.io/tv-show-ratings/');
})();
