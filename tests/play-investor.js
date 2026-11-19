// Plays The Investor in headless Chromium and checks routes, recaps and visuals.
// Run: node tests/play-investor.js   (exits non-zero on failure)
const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, '..', 'The Investor.html');
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' :: ' + detail}`);
  if (!ok) failures++;
}

async function open(browser, viewport = { width: 1920, height: 1080 }) {
  const page = await browser.newPage({ viewport });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(FILE);
  await page.waitForSelector('tw-passage tw-link');
  return page;
}

async function choices(page) {
  return page.$$('tw-passage tw-link');
}

async function pick(page, i) {
  const before = await page.$eval('tw-passage', (p) => p.innerText);
  const links = await choices(page);
  if (!links[i]) throw new Error(`no choice ${i}; have ${links.length}`);
  await links[i].click();
  await page.waitForFunction((b) => {
    const p = document.querySelector('tw-passage');
    return p && p.innerText !== b;
  }, before);
  await page.waitForTimeout(150);
}

// route: indexes for the 4 decision screens. Returns page on the Ending.
async function play(browser, route, opts = {}) {
  const page = await open(browser, opts.viewport);
  await pick(page, 0); // Begin investing
  const screens = [];
  for (const i of route) {
    screens.push(await snapshot(page));
    await pick(page, i);
  }
  screens.push(await snapshot(page));
  return { page, screens, text: screens[screens.length - 1].text };
}

async function snapshot(page) {
  return page.evaluate(() => ({
    text: document.querySelector('tw-passage').innerText,
    html: document.querySelector('tw-passage').innerHTML,
    recap: (document.querySelector('tw-passage .recap') || {}).innerText || '',
    errors: document.querySelectorAll('tw-error').length,
  }));
}

async function chartPath(page) {
  return page.$eval('.chart', (c) => c.getAttribute('data-path'));
}

(async () => {
  const browser = await chromium.launch();

  // ---------- Task 1: routes, recaps, history, $2,000 guard ----------
  const routes = {
    A: { r: [1, 1, 1, 0], total: '11,200', path: '10000,8000,8000,11200' },
    B: { r: [2, 0, 2, 2], total: '10,500', path: '10000,10000,10000,10500' },
    C: { r: [0, 1, 0, 1], total: '8,840', path: '10000,8000,6800,8840' },
    D: { r: [2, 2, 1, 0], total: '11,200', path: '10000,10000,10000,11200' },
  };
  for (const [name, R] of Object.entries(routes)) {
    const { page, screens, text } = await play(browser, R.r);
    check(`route ${name} final total $${R.total}`, text.includes('$' + R.total), text.slice(0, 300));
    check(`route ${name} chart data-path`, (await chartPath(page).catch(() => null)) === R.path, await chartPath(page).catch((e) => e.message));
    check(`route ${name} no Harlowe errors`, screens.every((s) => s.errors === 0));
    check(`route ${name} no JS errors`, page.errors.length === 0, page.errors.join('; '));
    check(`route ${name} Market shows recap`, screens[1].recap.trim().length > 10, JSON.stringify(screens[1].recap));
    check(`route ${name} Final Choice and Ending show recap`, screens[3].recap.trim().length > 10 && screens[4].recap.trim().length > 10);
    if (name === 'C') {
      check('route C Market: $2,000 option disabled', /Not enough cash/i.test(screens[1].text), screens[1].text);
      check('route C Market: $2,000 option is not a link', !/<tw-link[^>]*>[^<]*Invest \$2,000/.test(screens[1].html), screens[1].html.slice(0, 400));
    }
    if (name === 'D') {
      check('route D Market: $2,000 option is a link', /<tw-link[^>]*>[^<]*Invest \$2,000/.test(screens[1].html), screens[1].html.slice(0, 400));
    }
    await page.close();
  }

  // undo keeps history length
  {
    const page = await open(browser);
    await pick(page, 0);
    for (const i of [1, 1, 1]) await pick(page, i);
    await pick(page, 0); // to Ending
    await page.click('tw-sidebar tw-icon[title="Undo"]');
    await page.waitForFunction(() => /market recovers/i.test(document.querySelector('tw-passage').innerText));
    await pick(page, 0);
    check('undo keeps history length', (await chartPath(page)).split(',').length === 4, await chartPath(page));
    await page.close();
  }

  // replay resets
  {
    const { page } = await play(browser, [1, 1, 1, 0]);
    const links = await choices(page);
    await links[links.length - 1].click(); // Play again
    await page.waitForFunction(() => /Investor's Challenge/.test(document.querySelector('tw-passage').innerText));
    check('replay resets (no recap on Start)', (await page.$('tw-passage .recap')) === null);
    await pick(page, 0);
    await pick(page, 1);
    const recap = await page.$eval('tw-passage .recap', (r) => r.innerText).catch(() => '');
    check('replay: recap reflects new run', /index fund/i.test(recap), recap);
    await page.close();
  }

  if (process.env.TASK && Number(process.env.TASK) < 2) return finish(browser);

  // ---------- Task 2: theme and money bar ----------
  {
    const page = await open(browser);
    check('Start: money bar hidden', !(await page.isVisible('.money-bar').catch(() => false)));
    await pick(page, 0);
    await pick(page, 1); // index fund -> Market
    await page.waitForTimeout(900); // let count animation finish
    const bar = await page.evaluate(() => {
      const b = document.querySelector('.money-bar');
      return b && { text: b.innerText, inv: b.querySelector('.invested').className, top: b.getBoundingClientRect().top };
    });
    check('Market: bar total $8,000', bar && /Total[\s\S]*\$8,000/.test(bar.text), bar && bar.text);
    check('Market: invested marked down', bar && /\bdown\b/.test(bar.inv), bar && bar.inv);
    check('Market: bar at top of page', bar && bar.top < 200, bar && bar.top);
    const sizes = await page.evaluate(() => ({
      body: parseFloat(getComputedStyle(document.querySelector('tw-passage')).fontSize),
      link: parseFloat(getComputedStyle(document.querySelector('tw-passage tw-link')).fontSize),
    }));
    check('body text >= 28px', sizes.body >= 28, JSON.stringify(sizes));
    check('choice text >= 24px', sizes.link >= 24, JSON.stringify(sizes));
    await page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/market.png` : '/dev/null' }).catch(() => {});
    await page.close();
  }
  for (const vp of [{ width: 1280, height: 720 }, { width: 1024, height: 768 }]) {
    const { page, screens } = await play(browser, [2, 2, 1, 0], { viewport: vp });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`no horizontal scroll at ${vp.width}x${vp.height}`, sw <= vp.width, sw);
    await page.close();
  }

  if (process.env.TASK && Number(process.env.TASK) < 3) return finish(browser);

  // ---------- Task 3: results chart ----------
  {
    const { page } = await play(browser, [1, 1, 1, 0]);
    const chart = await page.evaluate(() => {
      const svg = document.querySelector('.chart svg');
      if (!svg) return null;
      return {
        lines: [...svg.querySelectorAll('polyline')].map((p) => p.getAttribute('points').trim().split(/\s+/).length),
        text: document.querySelector('.chart').textContent,
      };
    });
    check('chart svg with 3 lines of 4 points', chart && chart.lines.length === 3 && chart.lines.every((n) => n === 4), JSON.stringify(chart));
    for (const label of ['Your path', 'Index fund & hold', 'All savings', '$11,200']) {
      check(`chart shows "${label}"`, chart && chart.text.includes(label), chart && chart.text);
    }
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/ending.png` });
    await page.close();
  }

  finish(browser);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function finish(browser) {
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
}
