import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const demo = (page: Page) => page.getByRole('region', { name: 'Interactive demo of Tuck' });
const button = (page: Page, name: string | RegExp) => demo(page).getByRole('button', { name });
const detail = (page: Page) => demo(page).locator('[data-detail]');
const row = (page: Page, n: number) => demo(page).locator(`[data-q="${n}"]`);

/* counts tuck:sorted events, the contract the homepage quest listens to */
async function open(page: Page, path = '/') {
  await page.addInitScript(() => {
    (window as unknown as { sorted: number }).sorted = 0;
    document.addEventListener('tuck:sorted', () => { (window as unknown as { sorted: number }).sorted++; });
  });
  await page.goto(path);
}
const sorted = (page: Page) => page.evaluate(() => (window as unknown as { sorted: number }).sorted);

test('opens on the first of six decisions with the labelled prototype', async ({ page }) => {
  await open(page);
  const d = demo(page);
  await expect(d).toContainText('Prototype with sample files');
  await expect(d).toContainText('6 decisions waiting. Nothing changes until you answer.');
  await expect(d).toContainText('0 of 6 done');
  await expect(d).toContainText('45 files waiting');
  await expect(d).toContainText('Nothing moves on disk. Every answer can be undone in History.');
  await expect(detail(page)).toContainText('Decision 1 of 6');
  await expect(detail(page).getByRole('heading')).toHaveText('Make a Labs folder in PHYS 1401');
  await expect(button(page, /Make Labs and move 12 files/)).toBeVisible();
  await expect(button(page, /Leave them in PHYS 1401/)).toBeVisible();
  await expect(button(page, /Choose folder/)).toBeVisible();
  await expect(button(page, /^Skip/)).toBeVisible();
  await expect(d.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
});

test('answering by button advances, updates the progress, and only Yes fires tuck:sorted', async ({ page }) => {
  await open(page);
  const d = demo(page);
  await button(page, /Leave them in PHYS 1401/).click();
  await expect(detail(page).getByRole('heading')).toHaveText('File IMG_2210.HEIC in PHYS 1401');
  await expect(d).toContainText('1 of 6 done');
  await expect(d).toContainText('33 files waiting');
  await expect(row(page, 0)).toContainText('Left as is');
  expect(await sorted(page)).toBe(0);
  await button(page, /Move to PHYS 1401/).click();
  await expect(d).toContainText('2 of 6 done');
  await expect(row(page, 1)).toContainText('Done');
  await expect(d.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  await expect(d.getByRole('status')).toContainText('Done: 1 file in PHYS 1401');
  expect(await sorted(page)).toBe(1);
});

test('every decision has its own title and actions', async ({ page }) => {
  await open(page);
  const cases: [string, string, string, string][] = [
    ['New folder', 'Make a Labs folder in PHYS 1401', 'Make Labs and move 12 files', 'Leave them in PHYS 1401'],
    ['Where it goes', 'File IMG_2210.HEIC in PHYS 1401', 'Move to PHYS 1401', 'Keep in Photos › Trips'],
    ['Old versions', 'Move 7 older resumes into Old Resumes', 'Make Old Resumes and move 7 files', 'Keep them with Resume (6)'],
    ['Duplicate folders', 'Combine the two Website Proposal folders', 'Combine into one folder', 'Keep both folders'],
    ['Private file', 'Keep Barnard club budget.xlsx private', 'Make it private', 'Not private'],
    ['Folder fit', 'Keep Robotics club in Projects', 'Keep it in Projects', 'It doesn’t fit'],
  ];
  for (const [n, [type, title, yes, no]] of cases.entries()) {
    await row(page, n).click();
    await expect(detail(page)).toContainText(`Decision ${n + 1} of 6`);
    await expect(detail(page).locator('.td-tag')).toHaveText(type);
    await expect(detail(page).getByRole('heading')).toHaveText(title);
    await expect(button(page, yes)).toBeVisible();
    await expect(button(page, no)).toBeVisible();
  }
});

test('keys answer only with focus in the demo, and never hijack typing or shortcuts', async ({ page }) => {
  await open(page);
  const d = demo(page);
  await page.keyboard.press('y');
  await expect(d).toContainText('0 of 6 done');
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'outside'; document.body.prepend(i); });
  await page.locator('#outside').focus();
  await page.keyboard.type('yns');
  await expect(page.locator('#outside')).toHaveValue('yns');
  await expect(d).toContainText('0 of 6 done');

  await button(page, /Make Labs and move 12 files/).focus();
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Control+s');
  await expect(d.getByRole('menu')).toBeHidden();
  await expect(d).toContainText('0 of 6 done');

  await page.keyboard.press('y');
  await expect(d).toContainText('1 of 6 done');
  expect(await sorted(page)).toBe(1);
  await page.keyboard.press('n');
  await expect(d).toContainText('2 of 6 done');
  expect(await sorted(page)).toBe(1);
  await page.keyboard.press('s');
  await expect(d).toContainText('2 of 6 done');
  await expect(detail(page)).toContainText('Decision 4 of 6');
  await expect(row(page, 2)).toContainText('Skipped');
});

test('arrow keys and space still scroll the page from inside the demo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await open(page);
  await button(page, /Accept all/).focus();
  const before = await page.evaluate(() => scrollY);
  await page.keyboard.press('PageDown');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
});

test('Choose folder is a real menu: it changes where the files go, Y commits it', async ({ page }) => {
  await open(page);
  const d = demo(page);
  await button(page, /Make Labs/).focus();
  await page.keyboard.press('c');
  const menu = d.getByRole('menu', { name: 'Choose a folder' });
  await expect(menu).toBeVisible();
  await expect(button(page, /Choose folder/)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('y');
  await expect(d).toContainText('0 of 6 done');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(button(page, /Choose folder/)).toBeFocused();

  await button(page, /Choose folder/).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(detail(page)).toContainText('Lab Reports');
  await expect(button(page, /Move 12 files to Lab Reports/)).toBeVisible();
  await button(page, /Choose folder/).click();
  await d.getByRole('menuitem', { name: 'Back to Tuck’s pick' }).click();
  await expect(button(page, /Make Labs and move 12 files/)).toBeVisible();

  await button(page, /Choose folder/).click();
  await page.mouse.click(4, 4);
  await expect(menu).toBeHidden();
});

test('file checkboxes update the primary button and the counts', async ({ page }) => {
  await open(page);
  const d = demo(page);
  const box = d.getByRole('checkbox', { name: 'Include Lab 7.pdf' });
  await box.uncheck();
  await expect(button(page, /Make Labs and move 11 files/)).toBeVisible();
  await expect(d).toContainText('11 of 12 included');
  await expect(d).toContainText('44 files waiting');
  await expect(d.getByRole('checkbox', { name: 'Include Lab 7.pdf' })).toBeFocused();
  await button(page, 'Tick all').click();
  await expect(d).toContainText('12 of 12 included');
  await button(page, 'Untick all').click();
  await expect(button(page, /Make Labs and move 0 files/)).toBeDisabled();
  await page.keyboard.press('y');
  await expect(d).toContainText('0 of 6 done');
});

test('a done row reopens read only, and Undo puts it back', async ({ page }) => {
  await open(page);
  const d = demo(page);
  await button(page, /Make Labs/).click();
  await row(page, 0).click();
  await expect(detail(page)).toContainText('Done: 12 files in Labs');
  await expect(button(page, /Make Labs/)).toHaveCount(0);
  await button(page, 'Undo').click();
  await expect(d).toContainText('0 of 6 done');
  await expect(button(page, /Make Labs and move 12 files/)).toBeVisible();
});

test('Accept all finishes everything, says nothing moved, and Start over resets', async ({ page }) => {
  await open(page);
  const d = demo(page);
  await button(page, 'Accept all 6').click();
  await expect(detail(page)).toContainText('All 6 answered');
  await expect(detail(page)).toContainText('Nothing moved on disk');
  await expect(d).toContainText('6 of 6 done');
  await expect(d).toContainText('0 files waiting');
  await expect(d.locator('[data-count]')).toBeHidden();
  expect(await sorted(page)).toBe(1);
  await expect(button(page, 'Start over')).toBeFocused();
  await button(page, 'Start over').click();
  await expect(d).toContainText('0 of 6 done');
  await expect(d).toContainText('45 files waiting');
  await expect(d.locator('[data-count]')).toHaveText(/^6/);
  await expect(detail(page)).toContainText('Decision 1 of 6');
});

test('the sixth answer lands on the done state, from the keyboard alone', async ({ page }) => {
  await open(page);
  await button(page, /Make Labs/).focus();
  for (const key of ['y', 'n', 'y', 'n', 'y', 'y']) await page.keyboard.press(key);
  await expect(detail(page)).toContainText('All 6 answered');
  await expect(demo(page).getByRole('status')).toContainText('Nothing moved on disk');
  await expect(button(page, 'Start over')).toBeFocused();
});

test('sidebar items other than Needs You are plain text', async ({ page }) => {
  await open(page);
  const side = demo(page).locator('.td-side');
  for (const name of ['Today', 'Tuck Brain', 'Chats', 'Diary', 'Edit Folders', 'Re-sort', 'History', 'Tidy Up']) await expect(side).toContainText(name);
  await expect(side.locator('a,button,[tabindex]')).toHaveCount(0);
  await expect(side.locator('[aria-current="page"]')).toContainText('Needs You');
  await expect(side.locator('[data-count]')).toContainText('6');
});

for (const width of [360, 768, 1100, 1440]) {
  test(`fits at ${width}px with every action reachable, on both pages`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/work/tuck']) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      for (const name of [/Make Labs/, /Leave them/, /Choose folder/, /^Skip/]) {
        const b = button(page, name);
        // the site scrolls smoothly; jump, so this checks reach and not scroll timing
        await b.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await expect(b).toBeInViewport();
      }
      for (let n = 0; n < 6; n++) {
        await row(page, n).click();
        const spill = await demo(page).evaluate((root) => {
          const edge = root.getBoundingClientRect();
          return [...root.querySelectorAll<HTMLElement>('button:not([role^="menu"]),.td-tag,.td-new,.td-lock,td,dd')]
            .filter((e) => { const r = e.getBoundingClientRect(); return r.right > edge.right + 1 || r.left < edge.left - 1; })
            .map((e) => e.textContent)
            .concat([...root.querySelectorAll<HTMLElement>('.td-body,.td-ts,.td-items,.td-act')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.className));
        });
        expect(spill, `decision ${n + 1}`).toEqual([]);
      }
      await row(page, 0).click();
      await button(page, /Make Labs/).click();
      await expect(demo(page)).toContainText('1 of 6 done');
    }
  });
}

test('at 360px Choose folder and Skip share a row under the two answers', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  const choose = await button(page, /Choose folder/).boundingBox();
  const skip = await button(page, /^Skip/).boundingBox();
  const no = await button(page, /Leave them/).boundingBox();
  expect(Math.abs(choose!.y - skip!.y)).toBeLessThan(2);
  expect(choose!.y).toBeGreaterThan(no!.y);
});

test('keyboard focus is visible', async ({ page }) => {
  await page.goto('/');
  const accept = button(page, 'Accept all 6');
  await accept.focus();
  await page.keyboard.press('Tab');
  const style = await page.evaluate(() => { const c = getComputedStyle(document.activeElement!); return [c.outlineStyle, parseFloat(c.outlineWidth)]; });
  expect(style).toEqual(['solid', 2]);
});

test('at 360px the panes stack and a row brings its decision into view', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 700 });
  await page.goto('/');
  const list = await demo(page).locator('[data-list]').boundingBox();
  const open = await detail(page).boundingBox();
  expect(open!.y).toBeGreaterThanOrEqual(list!.y + list!.height - 1);
  await row(page, 3).click();
  await expect(detail(page).getByRole('heading')).toBeInViewport();
});

test('reduced motion: answering does not animate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await button(page, /Make Labs/).click();
  expect(await detail(page).evaluate((e) => e.getAnimations().length)).toBe(0);
});

for (const path of ['/', '/work/tuck']) {
  test(`no serious accessibility issues in the demo on ${path}, open and done`, async ({ page }) => {
    await open(page, path);
    const check = async () => {
      // the fade between decisions would read as low contrast mid-way
      await detail(page).evaluate((e) => Promise.all(e.getAnimations().map((a) => a.finished)));
      const r = await new AxeBuilder({ page }).include('.tuck-demo').analyze();
      expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0].target}`)).toEqual([]);
    };
    await check();
    await button(page, /Choose folder/).click();
    await check();
    await page.keyboard.press('Escape');
    await button(page, /Make Labs/).click();
    await row(page, 0).click();
    await check();
    await button(page, /Accept all/).click();
    await check();
  });
}
