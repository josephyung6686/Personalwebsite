import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const spade = (page: Page) => page.locator('[data-demo="spade"]');
const aik = (page: Page) => page.locator('[data-demo="aikonic"]');
const openSpade = async (page: Page) => {
  await page.goto('/work/nutrigene');
  await spade(page).scrollIntoViewIfNeeded();
  await expect(spade(page)).toHaveAttribute('data-ready', 'true');
};
const openAikonic = async (page: Page) => {
  await page.goto('/work/aikonic');
  await aik(page).scrollIntoViewIfNeeded();
  await expect(aik(page)).toHaveAttribute('data-ready', 'true');
};
const noSidewaysScroll = async (page: Page) => {
  const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(scroll).toBeLessThanOrEqual(client);
};

test.describe('SPADE demo', () => {
  test('wears the label that says it is not the real product', async ({ page }) => {
    await openSpade(page);
    await expect(spade(page)).toContainText("A visualization of how the backend works, with sample data. Not the actual system.");
  });

  test('holds off, then recommends a range as the rounds add data', async ({ page }) => {
    await openSpade(page);
    const d = spade(page);
    const run = d.getByRole('button', { name: 'Run next round' });
    await run.click();
    await expect(d.getByRole('status')).toContainText('Not confident yet: holding off.');
    await expect(d.locator('.spd-count')).toHaveText('Round 1 of 6 · 8 experiments');
    await run.click();
    await run.click();
    await expect(d.getByRole('status')).toContainText(/Recommend: Glucose feed [\d.]+ to [\d.]+ g\/L/);
    await expect(d.getByRole('img')).toHaveAccessibleName(/Round 3 of 6\. 24 experiments so far/);
  });

  test('raising the target past anything reachable sends it back to holding off', async ({ page }) => {
    await openSpade(page);
    const d = spade(page);
    const run = d.getByRole('button', { name: 'Run next round' });
    for (let i = 0; i < 3; i++) await run.click();
    await d.getByLabel('Target yield').fill('95');
    await expect(d.getByRole('status')).toContainText('holding off');
    await expect(d.locator('.spd-tval')).toHaveText('95%');
  });

  test('stops at the budget, and Reset replays from the start', async ({ page }) => {
    await openSpade(page);
    const d = spade(page);
    const run = d.getByRole('button', { name: 'Run next round' });
    for (let i = 0; i < 6; i++) await run.click();
    await expect(d.locator('.spd-count')).toHaveText('Round 6 of 6 · 48 experiments');
    await expect(run).toHaveAttribute('aria-disabled', 'true');
    // Playwright waits forever on an aria-disabled button, so force the press a real visitor can still make.
    await run.click({ force: true });
    await expect(d.locator('.spd-count')).toHaveText('Round 6 of 6 · 48 experiments');
    await d.getByRole('button', { name: 'Reset' }).click();
    await expect(d.locator('.spd-count')).toHaveText('Round 0 of 6 · 0 experiments');
    await expect(run).toHaveAttribute('aria-disabled', 'false');
    await expect(d.getByRole('status')).toContainText('No experiments yet.');
  });

  test('the map is painted once it is near the viewport', async ({ page }) => {
    await openSpade(page);
    await spade(page).getByRole('button', { name: 'Run next round' }).click();
    // The fit eases in over a few frames, so wait for it rather than reading the first one.
    await expect.poll(() => spade(page).locator('canvas').evaluate((c: HTMLCanvasElement) => {
      const px = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      const colors = new Set<number>();
      for (let i = 0; i < px.length; i += 400) colors.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
      return colors.size;
    })).toBeGreaterThan(10);
  });
});

test.describe('SPADE demo on a touch screen', () => {
  test.use({ hasTouch: true, viewport: { width: 360, height: 800 } });
  test('a tap reads out a cell, and the reading stays after the finger lifts', async ({ page }) => {
    await openSpade(page);
    const d = spade(page);
    await d.getByRole('button', { name: 'Run next round' }).tap();
    const box = (await d.locator('canvas').boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(d.locator('.spd-readout')).toContainText(/predicted \d+%/);
  });
});

test.describe('Aikonic product', () => {
  const win = (page: Page) => aik(page).locator('.aik-window');
  const search = (page: Page, q: string) => aik(page).getByLabel("Search everything you've recorded").fill(q);
  const results = (page: Page) => aik(page).locator('.aik-result');
  const askFor = async (page: Page, text: string) => {
    await aik(page).getByLabel('Ask a question or give an instruction').fill(text);
    await aik(page).getByRole('button', { name: 'Send' }).click();
  };
  const drawer = (scope: Locator) => scope.locator('details.aik-drawer').first();
  const openDrawer = async (scope: Locator) => { await drawer(scope).locator('summary').click(); return drawer(scope); };

  test.describe('reads as a product before anything is pressed', () => {
    test('with JavaScript off, the window is already there', async ({ browser }) => {
      const ctx = await browser.newContext({ javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto('/work/aikonic');
      const d = aik(page);
      await expect(d).toContainText("A visualization of how the backend works, with sample data. Not the actual system.");
      await expect(d).toContainText('A voice notes app');
      await expect(d.getByRole('navigation', { name: 'Folders and recordings' })).toContainText('Q3 launch sync');
      await expect(d.getByRole('navigation', { name: 'Folders and recordings' })).toContainText('What Aikonic remembers');
      await expect(d.getByRole('list', { name: 'Transcript' })).toContainText('Purchase order PO-8812');
      await expect(d.getByRole('button', { name: 'Make a podcast' })).toBeVisible();
      await expect(d.getByRole('group', { name: 'Suggested prompts' })).toContainText('Why did the Kowloon opening move?');
      await expect(d.getByRole('group', { name: 'Microphone' })).toContainText('Call audio');
      await expect(d.getByRole('group', { name: 'Microphone' })).toContainText('Recording');
      await ctx.close();
    });

    test('the label stays in view while the window scrolls', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 700 });
      await openAikonic(page);
      await aik(page).locator('.aik-status').scrollIntoViewIfNeeded();
      await expect(aik(page).locator('.aik-label')).toBeInViewport();
    });

    test('only the shell loads: features wait until they are opened', async ({ page }) => {
      const seen: string[] = [];
      page.on('request', (r) => { if (/feature(Tools|Memory|Podcast|Desktop|Phone)|aikonicGuide/.test(r.url())) seen.push(r.url()); });
      await openAikonic(page);
      expect(seen).toEqual([]);
      await aik(page).getByRole('button', { name: 'Make a podcast' }).click();
      await expect(aik(page).getByRole('button', { name: 'Generate' })).toBeVisible();
      expect(seen.some((u) => u.includes('featurePodcast'))).toBe(true);
      expect(seen.some((u) => u.includes('featureMemory'))).toBe(false);
    });
  });

  test('opens calm: a short list, one transcript, one Ask box and one small How I built this', async ({ page }) => {
    await openAikonic(page);
    const d = aik(page);
    await expect(d.locator('.aik-rec:visible')).toHaveCount(4);
    await expect(d.locator('.aik-folder-h:visible, .aik-side-mem:visible, .aik-playbar:visible, .aik-linkchip:visible')).toHaveCount(0);
    await expect(d.locator('.aik-log .aik-msg')).toHaveCount(0);
    await expect(d.locator('.aik-chip:visible')).toHaveCount(2);
    await expect(d.locator('.aik-drawer:visible')).toHaveCount(1);
    await expect(d.locator('.aik-status')).toContainText('Microphone connected');
    await d.locator('.aik-chip[data-prompt^="Move"]').click();
    await expect(d.locator('.aik-folder-h').first()).toBeVisible();
    await d.getByRole('button', { name: 'Make a podcast' }).click();
    await expect(d.locator('.aik-drawer:visible')).toHaveCount(1);
    await d.locator('[data-show="mic"]').click();
    await expect(d.locator('.aik-linkchip:visible')).toHaveCount(2);
    await expect(d.locator('.aik-drawer:visible')).toHaveCount(1);
  });

  test.describe('the guide', () => {
    const guide = (page: Page) => aik(page).getByRole('region', { name: 'Guided tour' });
    const next = (page: Page) => guide(page).getByRole('button', { name: 'Next' });
    const startTour = async (page: Page) => {
      await guide(page).getByRole('button', { name: 'Start tour' }).click();
      await expect(guide(page)).toContainText('Step 1 of 6');
    };
    const atStep = (page: Page, n: number) => expect(aik(page)).toHaveAttribute('data-tour-done', String(n), { timeout: 15_000 });

    test('opens by default as a compact card, and does nothing until asked', async ({ page }) => {
      await openAikonic(page);
      await expect(guide(page)).toBeVisible();
      await expect(aik(page).locator('.aik-spotlit')).toHaveCount(0);
    });

    test('before the tour starts, nothing floats over the window: a key at the bottom of the screen can be pressed', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 740 });
      await openAikonic(page);
      const key = aik(page).locator('[data-rec]');
      await key.evaluate((n) => { const r = n.getBoundingClientRect(); window.scrollBy({ top: r.top + r.height / 2 - (innerHeight - 30), behavior: 'instant' }); });
      const onTop = await key.evaluate((n) => { const r = n.getBoundingClientRect(); return n.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); });
      expect(onTop).toBe(true);
    });

    test('walks six steps, spotlighting the real element, with his verbs and an invitation', async ({ page }) => {
      await openAikonic(page);
      await startTour(page);
      const steps: [string, string, string][] = [
        ['Find anything anyone said', 'Implemented hybrid retrieval, citation safeguards, and multilingual chunking improvements.', '.aik-ask'],
        ['Ask it to do things', 'Implemented 21 folder-scoped agent tools.', '.aik-ask'],
        ['It remembers what changed', 'Applied temporal fact versioning and redesigned asynchronous context dependencies to reduce race conditions.', '.aik-main'],
        ['Turn a meeting into a podcast', 'Converted a single-model workflow into a multi-stage agentic pipeline and reduced text-to-speech generation time by approximately 3x.', '.aik-main'],
        ['One microphone, two connections', 'Improved dual Bluetooth connectivity, session initialization, reconnection behavior, translation, recording reliability and added most app features.', '.aik-status'],
        ['The same note on your phone', 'Resolved silent failures, improved structured content rendering, persistent task states, localization, and user feedback.', '.aik-main'],
      ];
      for (let i = 0; i < steps.length; i++) {
        const [title, built, spot] = steps[i];
        await atStep(page, i + 1);
        await expect(guide(page)).toContainText(`Step ${i + 1} of 6`);
        await expect(guide(page)).toContainText(title);
        await expect(guide(page).locator('.aik-guide-built')).toContainText(`What I built ${built}`);
        await expect(guide(page).locator('.aik-guide-try')).toContainText('Try it:');
        await expect(aik(page).locator(`${spot}.aik-spotlit`)).toBeVisible();
        if (i < steps.length - 1) await next(page).click();
      }
    });

    test('presses real things for you: each step leaves the product changed', async ({ page }) => {
      await openAikonic(page);
      await startTour(page);
      await atStep(page, 1);
      await expect(results(page).filter({ hasText: '供應商' })).toContainText('Found in Cantonese');
      await next(page).click();
      await atStep(page, 2);
      await expect(aik(page).locator('.aik-log')).toContainText('Moved Q3 launch sync to the Q3 folder.');
      await expect(aik(page).locator('.aik-side')).not.toContainText('empty');
      await next(page).click();
      await atStep(page, 3);
      await expect(aik(page).locator('.aik-answer-a')).toContainText('understood to be 1 September');
      await next(page).click();
      await atStep(page, 4);
      await expect(aik(page).getByRole('button', { name: 'Play' })).toHaveAttribute('aria-disabled', 'false', { timeout: 8000 });
      await next(page).click();
      await atStep(page, 5);
      await expect(aik(page).locator('.aik-status-text')).toContainText('still working');
      await next(page).click();
      await atStep(page, 6);
      await expect(aik(page).locator('.aik-share')).toHaveText('ノートを共有');
    });

    test('each step ends by returning the window to calm, and so does the end of the tour', async ({ page }) => {
      await openAikonic(page);
      await startTour(page);
      await atStep(page, 1);
      await next(page).click();
      await atStep(page, 2);
      await expect(aik(page).locator('.aik-folder-h').first()).toBeVisible();
      await next(page).click();
      await atStep(page, 3);
      await expect(aik(page).locator('.aik-log .aik-msg')).toHaveCount(0);
      await expect(aik(page).locator('.aik-folder-h').first()).toBeHidden();
      await guide(page).getByRole('button', { name: 'Skip' }).click();
      await expect(aik(page).locator('.aik-vtitle')).toBeVisible();
      await expect(aik(page).locator('.aik-rec:visible')).toHaveCount(4);
    });

    test('Back goes back, and is not available on the first step', async ({ page }) => {
      await openAikonic(page);
      await startTour(page);
      const back = guide(page).getByRole('button', { name: 'Back' });
      await expect(back).toHaveAttribute('aria-disabled', 'true');
      await atStep(page, 1);
      await next(page).click();
      await atStep(page, 2);
      await back.click();
      await expect(guide(page)).toContainText('Step 1 of 6');
      await expect(aik(page).locator('.aik-ask.aik-spotlit')).toBeVisible();
    });

    test('Skip ends it and clears the spotlight, and it can be restarted', async ({ page }) => {
      await openAikonic(page);
      await startTour(page);
      await atStep(page, 1);
      await guide(page).getByRole('button', { name: 'Skip' }).click();
      await expect(guide(page)).toBeHidden();
      await expect(aik(page).locator('.aik-spotlit')).toHaveCount(0);
      const restart = aik(page).getByRole('button', { name: 'Start tour' });
      await expect(restart).toBeFocused();
      await restart.click();
      await expect(guide(page)).toContainText('Step 1 of 6');
    });

    test('Skip on the first card just closes it, without loading the guide', async ({ page }) => {
      const seen: string[] = [];
      page.on('request', (r) => { if (r.url().includes('aikonicGuide')) seen.push(r.url()); });
      await openAikonic(page);
      await guide(page).getByRole('button', { name: 'Skip' }).click();
      await expect(guide(page)).toBeHidden();
      expect(seen).toEqual([]);
    });

    test('Finish returns to the recording, and works by keyboard alone', async ({ page }) => {
      await openAikonic(page);
      await guide(page).getByRole('button', { name: 'Start tour' }).focus();
      await page.keyboard.press('Enter');
      await expect(next(page)).toBeFocused();
      for (let i = 1; i <= 6; i++) {
        await atStep(page, i);
        await page.keyboard.press('Enter');
      }
      await expect(guide(page)).toBeHidden();
      await expect(aik(page).locator('.aik-vtitle')).toBeVisible();
      await expect(aik(page).getByRole('button', { name: 'Start tour' })).toBeFocused();
    });

    test('Escape in the card ends it', async ({ page }) => {
      await openAikonic(page);
      await startTour(page);
      await atStep(page, 1);
      await next(page).focus();
      await page.keyboard.press('Escape');
      await expect(guide(page)).toBeHidden();
    });

    test('does not trap focus: Tab leaves the card, and the app stays usable mid-tour', async ({ page }) => {
      await openAikonic(page);
      await startTour(page);
      await atStep(page, 1);
      await guide(page).getByRole('button', { name: 'Skip' }).focus();
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('.aik-guide'))).toBe(false);
      await results(page).locator('[data-jump="launch-1"]').click();
      await expect(aik(page).locator('.aik-vtime')).toContainText('07:41');
      await expect(guide(page)).toContainText('Step 1 of 6');
    });

    test('respects reduced motion: the podcast lands finished, with no waiting', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openAikonic(page);
      await startTour(page);
      await atStep(page, 1);
      for (let i = 2; i <= 4; i++) { await next(page).click(); await atStep(page, i); }
      await expect(aik(page).locator('.aik-order-note')).toContainText('finished in the order 2, 3, 1');
    });

    for (const width of [360, 768, 1440]) {
      test(`at ${width}, every step's element comes into view with no sideways scroll`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await openAikonic(page);
        await startTour(page);
        for (let i = 1; i <= 6; i++) {
          await atStep(page, i);
          await expect(aik(page).locator('.aik-label')).toBeInViewport();
          await expect(guide(page)).toBeInViewport();
          await noSidewaysScroll(page);
          // The page may still be scrolling smoothly when a step with nothing to press reports done.
          await expect.poll(() => aik(page).evaluate((root) => [...root.querySelectorAll('.aik-spotlit')].some((n) => {
            const r = n.getBoundingClientRect();
            return r.bottom > 60 && r.top < innerHeight - 60;
          })), { message: `step ${i}: a spotlit element should be on screen` }).toBe(true);
          if (i < 6) await next(page).click();
        }
      });
    }

    test('has no axe violations at any step', async ({ page }) => {
      await openAikonic(page);
      await startTour(page);
      for (let i = 1; i <= 6; i++) {
        await atStep(page, i);
        const r = await new AxeBuilder({ page }).include('[data-demo="aikonic"]').analyze();
        expect(r.violations.map((v) => `step ${i}: ${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
        if (i < 6) await next(page).click();
      }
    });
  });

  test.describe('search and citations', () => {
    test('results sit beside the transcript, and a timestamp jumps in the open transcript', async ({ page }) => {
      await openAikonic(page);
      const d = aik(page);
      await search(page, 'supplier delay');
      const row = results(page).filter({ hasText: '供應商' });
      await expect(row).toContainText('Found in Cantonese');
      await row.getByRole('button', { name: /09:22/ }).click();
      await expect(d.locator('.aik-vtitle')).toContainText('Menu review');
      await expect(d.locator('.aik-vtime')).toContainText('09:22');
      const line = d.locator('.aik-line[aria-current="true"]');
      await expect(line).toContainText('供應商出唔到貨');
      await expect(line).toBeFocused();
      await expect(row).toBeVisible();
    });

    test('suggestions appear only when the box has focus', async ({ page }) => {
      await openAikonic(page);
      const d = aik(page);
      await expect(d.locator('.aik-suggest')).toHaveCount(0);
      await d.getByLabel("Search everything you've recorded").focus();
      await d.locator('.aik-suggest').getByRole('button', { name: /退款/ }).click();
      await expect(d.getByLabel("Search everything you've recorded")).toHaveValue('退款');
      await expect(results(page).first()).toBeVisible();
      await expect(d.locator('.aik-suggest')).toHaveCount(0);
    });

    test('Keyword, Semantic and Both live in How I built this, and closing it returns the search to normal', async ({ page }) => {
      await openAikonic(page);
      const d = aik(page);
      await expect(d.locator('.aik-titlebar')).not.toContainText('Semantic');
      await search(page, 'PO-8812');
      await expect(results(page)).toHaveCount(1);
      await expect(d.getByRole('button', { name: /^Semantic/ })).toBeHidden();
      await openDrawer(d.locator('.aik-results-wrap'));
      await d.getByRole('button', { name: /^Semantic/ }).click();
      await expect(results(page)).toHaveCount(0);
      await expect(d.locator('.aik-summary')).toContainText('Semantic found nothing for "PO-8812", but Both found 1.');
      await drawer(d.locator('.aik-results-wrap')).locator('summary').click();
      await expect(results(page)).toHaveCount(1);
    });

    test('a query nothing matches says so, and a typed query stays plain text', async ({ page }) => {
      await openAikonic(page);
      await search(page, '<img src=x onerror=alert(1)>');
      await expect(aik(page).locator('.aik-summary')).toContainText('Nothing you have recorded matches');
      await expect(aik(page).locator('.aik-summary img')).toHaveCount(0);
    });

    test('Back to Ask clears the search', async ({ page }) => {
      await openAikonic(page);
      await search(page, 'budget');
      await aik(page).getByRole('button', { name: 'Back to Ask' }).click();
      await expect(aik(page).getByRole('log', { name: 'Conversation' })).toBeVisible();
      await expect(aik(page).getByLabel("Search everything you've recorded")).toHaveValue('');
    });

    test('an unresolved citation is plain text beside resolved buttons that jump', async ({ page }) => {
      await openAikonic(page);
      const log = aik(page).getByRole('log', { name: 'Conversation' });
      await aik(page).getByRole('button', { name: 'Why did the Kowloon opening move?' }).click();
      const none = log.locator('.aik-cite-none');
      await expect(none).toHaveText('Source not found');
      await expect(none.locator('button, a')).toHaveCount(0);
      await log.getByRole('button', { name: /22:58/ }).click();
      await expect(aik(page).locator('.aik-vtime')).toContainText('22:58');
    });

    test('How I built this: ranks, the embedding switch and chunking, kept out of the product until asked', async ({ page }) => {
      await openAikonic(page);
      const d = aik(page);
      await search(page, 'supplier delay');
      await expect(results(page)).toHaveCount(8);
      await expect(d.getByRole('switch')).toHaveCount(0);
      await expect(results(page).first().locator('.aik-tag.lab').first()).toBeHidden();

      const box = await openDrawer(d.locator('.aik-results-wrap'));
      await expect(box).toContainText('What I built Implemented hybrid retrieval');
      await expect(box).toContainText('Reciprocal Rank Fusion');
      await expect(results(page).first()).toContainText('RRF 0.0328');

      const sw = box.getByRole('switch', { name: 'Embedding service down' });
      await sw.click();
      await expect(box.locator('.aik-why')).toContainText('Keyword retrieval keeps answering');
      await expect(results(page)).toHaveCount(1);
      await sw.click();
      await expect(results(page)).toHaveCount(8);

      await expect(box.locator('.aik-chunk')).toHaveCount(5);
      await expect(box.locator('.aik-stats')).toContainText('14:05');
      await box.getByRole('button', { name: /Before/ }).click();
      await expect(box.locator('.aik-chunk')).toHaveCount(1);
      await expect(box.locator('.aik-stats')).toContainText('00:00');
    });
  });

  test.describe('Ask and the tools', () => {
    const lastReply = (page: Page) => aik(page).locator('.aik-log > .aik-msg:not(.me)').last();

    test('"move this to the Q3 folder" moves it, says so in a sentence, and can be undone', async ({ page }) => {
      await openAikonic(page);
      const d = aik(page);
      await d.getByRole('button', { name: 'Move this to the Q3 folder' }).click();
      await expect(lastReply(page).locator('p')).toHaveText('Moved Q3 launch sync to the Q3 folder.');
      await expect(lastReply(page)).not.toContainText('Tool');
      await expect(d.locator('.aik-rec-meta')).toContainText('Store openings / Q3');
      await lastReply(page).getByRole('button', { name: 'Undo' }).click();
      await expect(d.locator('.aik-rec-meta')).not.toContainText('Q3');
      await expect(lastReply(page).locator('.aik-reply-after')).toBeFocused();
      await d.getByRole('button', { name: 'Move this to the Q3 folder' }).click();
      await d.getByRole('button', { name: 'Move this to the Q3 folder' }).click();
      await expect(lastReply(page)).toContainText('already in Q3');
    });

    test('another folder is explained in plain words, and works once that folder is open', async ({ page }) => {
      await openAikonic(page);
      const d = aik(page);
      const chip = d.getByRole('button', { name: 'Summarize Board prep' });
      await d.locator('[data-show="folders"]').click();
      await expect(chip).toContainText('In another folder');
      await chip.click();
      await expect(lastReply(page).locator('p')).toHaveText('I can only work in the folder you have open, so I left Board prep alone.');
      await lastReply(page).getByRole('button', { name: 'Open Finance' }).click();
      await expect(d.locator('.aik-vtitle')).toHaveText('Board prep');
      await expect(lastReply(page).locator('.aik-reply-after')).toBeFocused();
      await expect(chip.locator('small')).toBeHidden();
      await chip.click();
      await expect(lastReply(page)).toContainText('Summarized Board prep.');
      await expect(d.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
      await expect(d.locator('.aik-sub[data-sub="summary"]')).toContainText('The budget review is due');
    });

    test('How I built this keeps the folder check: what was asked, what scope it saw, what it decided', async ({ page }) => {
      await openAikonic(page);
      const d = aik(page);
      await d.locator('[data-show="folders"]').click();
      const box = await openDrawer(d.locator('.aik-ask-wrap'));
      await d.getByRole('button', { name: 'Summarize Board prep' }).click();
      const last = box.locator('.aik-last');
      await expect(last).toContainText('refused, outside this folder');
      await expect(last).toContainText('Store openings');
      await expect(last).toContainText('Board prep, in Finance');
      await expect(last).toContainText('Nothing was read or changed.');
      await d.getByRole('button', { name: 'Move this to the Q3 folder' }).click();
      await expect(last).toContainText('tool call allowed');
      await expect(last).toContainText('Move and reorganize recordings between folders');
    });

    test('a question gets an answer with citations, and nothing invented when nothing fits', async ({ page }) => {
      await openAikonic(page);
      const d = aik(page);
      await askFor(page, 'Why are refunds slow?');
      const reply = d.locator('.aik-log > .aik-msg:not(.me)').last();
      await expect(reply.locator('.aik-time').first()).toBeVisible();
      await askFor(page, 'Order me a pizza');
      await expect(d.locator('.aik-log > .aik-msg:not(.me)').last()).toContainText('couldn’t find that in your recordings');
    });

    test('How I built this shows 21 and the six groups', async ({ page }) => {
      await openAikonic(page);
      const box = await openDrawer(aik(page).locator('.aik-ask-wrap'));
      await expect(box).toContainText('What I built Implemented 21 folder-scoped agent tools.');
      await expect(box).toContainText('21 discrete tool calls');
      await expect(box.locator('.aik-groups li')).toHaveCount(6);
    });
  });

  test.describe('the open recording', () => {
    test('opens from the sidebar, with Transcript, Summary and To-dos as real tabs', async ({ page }) => {
      await openAikonic(page);
      const d = aik(page);
      await d.locator('.aik-rec[data-open="osaka"]').click();
      await expect(d.locator('.aik-vtitle')).toContainText('Osaka store prep');
      await expect(d.locator('.aik-line').first()).toContainText('大阪店');
      const tab = (name: string) => d.getByRole('tab', { name, exact: true });
      await tab('Transcript').focus();
      await page.keyboard.press('ArrowRight');
      await expect(tab('Summary')).toBeFocused();
      await expect(d.getByRole('tabpanel', { name: 'Summary' })).toContainText('The fit-out should finish');
      await page.keyboard.press('End');
      await expect(tab('To-dos')).toBeFocused();
      await expect(d.getByRole('tabpanel', { name: 'To-dos' })).toContainText('Decide on the supplier');
    });
  });

  test('Memory: the slider reconstructs what was true, and versions stay linked', async ({ page }) => {
    await openAikonic(page);
    const d = aik(page);
    await d.locator('[data-show="memory"]').click();
    const a = d.locator('.aik-answer-a');
    await expect(a).toContainText('21 September');
    const slider = d.getByLabel(/Look back to/);
    await slider.fill('60');
    await expect(a).toContainText('understood to be 18 August');
    await expect(d.locator('.aik-versions li[data-v="v3"]')).toHaveAttribute('data-status', 'future');
    await d.getByRole('button', { name: 'Replaced by v2' }).click();
    await expect(a).toContainText('1 September');
    await expect(d.locator('.aik-versions li[data-v="v1"]')).toHaveAttribute('data-status', 'superseded');
    await slider.fill('0');
    await expect(a).toContainText('nothing had been recorded');
    await d.locator('.aik-rec[data-memory="sam"]').click();
    await expect(a).toContainText('Sam’s role was understood to be head of supply');
    await expect(d.locator('.aik-versions li')).toHaveCount(2);
  });

  test('Memory: the race lives in How I built this', async ({ page }) => {
    await openAikonic(page);
    const d = aik(page);
    await d.locator('[data-show="memory"]').click();
    await expect(d.getByRole('button', { name: 'Run the pipeline' })).toHaveCount(0);
    const box = await openDrawer(d.locator('.aik-host[data-host="memory"]'));
    await expect(box).toContainText('What I built Applied temporal fact versioning');
    const run = box.getByRole('button', { name: 'Run the pipeline' });
    const out = box.locator('.aik-race-out');
    await run.click();
    await expect(out).toHaveAttribute('data-result', 'missing');
    await run.click();
    await expect(out).toHaveAttribute('data-result', 'ready');
    await box.getByRole('button', { name: /After: prior-meeting/ }).click();
    await run.click();
    await run.click();
    await expect(out).toHaveAttribute('data-result', 'prior');
    await expect(out).toContainText('Runs missing context: 0 of 2');
    await box.getByRole('button', { name: /Before: same-meeting/ }).click();
    await expect(out.locator('.aik-tally')).toHaveText('Runs missing context: 1 of 2.');
  });

  test('Podcast: the button on the recording runs the stages, and Play opens early', async ({ page }) => {
    await openAikonic(page);
    const d = aik(page);
    await d.getByRole('button', { name: 'Make a podcast' }).click();
    const play = d.getByRole('button', { name: 'Play' });
    await expect(play).toHaveAttribute('aria-disabled', 'true');
    await d.getByRole('button', { name: 'Generate' }).click();
    await expect(play).toHaveAttribute('aria-disabled', 'false', { timeout: 8000 });
    await expect(d.locator('.aik-pod-status')).toContainText('Your episode is ready', { timeout: 10_000 });
    await expect(d.locator('.aik-order-note')).toContainText('finished in the order 2, 3, 1', { timeout: 10_000 });
    await expect(d.locator('.aik-stages li[data-phase="done"]')).toHaveCount(5);
    await expect(d.locator('.aik-con-t')).toContainText('about 3x');
    await expect(d.locator('.aik-compare')).toContainText('Simulated');
    await play.click();
    await expect(d.locator('.aik-play-text')).toContainText('Playing segment 1 of 6');
    await d.getByRole('button', { name: '12 min' }).click();
    await expect(d.locator('.aik-stages li').nth(4)).toContainText('Expands');
    await d.getByRole('button', { name: /Back to Q3 launch sync/ }).click();
    await expect(d.locator('.aik-vtitle')).toBeVisible();
  });

  test.describe('Desktop, in the status bar', () => {
    const chip = (page: Page, id: string) => aik(page).locator(`.aik-linkchip[data-id="${id}"]`);

    test('drop one link, the other keeps working, and it reconnects by itself', async ({ page }) => {
      await openAikonic(page);
      await aik(page).locator('[data-show="mic"]').click();
      await aik(page).getByRole('button', { name: 'Disconnect Call audio' }).click();
      await expect(chip(page, 'classic')).toHaveAttribute('data-state', 'reconnecting');
      await expect(chip(page, 'ble')).toHaveAttribute('data-state', 'connected');
      await expect(aik(page).locator('.aik-status-text')).toContainText('still working');
      await expect(chip(page, 'classic')).toHaveAttribute('data-state', 'connected', { timeout: 5000 });
      await expect(aik(page).locator('.aik-status-text')).toContainText('reconnected on its own');
    });

    test('a recording carries on through a classic drop, and waits on a Low Energy drop', async ({ page }) => {
      await openAikonic(page);
      const d = aik(page);
      await d.locator('[data-show="mic"]').click();
      await d.locator('[data-rec]').click();
      await expect(d.locator('.aik-status-text')).toContainText('Recording ready 0.3 s after the press (simulated)');
      await d.getByRole('button', { name: 'Disconnect Call audio' }).click();
      await expect(d.locator('.aik-status-text')).toContainText('The recording carries on');
      await d.getByRole('button', { name: 'Disconnect Recording' }).click();
      await expect(d.locator('[data-rec]')).toHaveAttribute('aria-disabled', 'true');
      await expect(chip(page, 'ble')).toHaveAttribute('data-state', 'connected', { timeout: 5000 });
      await d.locator('[data-rec]').click();
      await expect(d.locator('.aik-status-text')).toContainText('Stopped after');
    });

    test('How I built this: cold and pre-warmed starts really differ', async ({ page }) => {
      await openAikonic(page);
      const d = aik(page);
      await d.locator('[data-show="mic"]').click();
      const box = await openDrawer(d.locator('.aik-status'));
      await expect(box).toContainText('What I built Improved dual Bluetooth connectivity');
      await expect(box).toContainText('Simulated');
      await box.getByRole('button', { name: /Before: cold/ }).click();
      await d.locator('[data-rec]').click();
      await expect(d.locator('.aik-status-text')).toHaveText('Starting...');
      await expect(d.locator('.aik-status-text')).toContainText('2.2 s after the press', { timeout: 5000 });
    });
  });

  test.describe('the phone view', () => {
    const openPhone = async (page: Page) => {
      await aik(page).getByRole('button', { name: 'Phone view' }).click();
      await expect(aik(page).locator('.aik-phone')).toBeVisible();
      return aik(page).locator('.aik-host[data-host="phone"]');
    };

    test('shows the same note: a to-do ticked here is ticked on the To-dos tab, and across a real reload', async ({ page }) => {
      await openAikonic(page);
      let p = await openPhone(page);
      await p.getByRole('checkbox', { name: 'Contact the backup supplier' }).check();
      await expect(p.locator('.aik-saved')).toHaveText('Saved on this device');
      await aik(page).getByRole('button', { name: /Back to Q3 launch sync/ }).click();
      await aik(page).getByRole('tab', { name: 'To-dos' }).click();
      await expect(aik(page).getByRole('checkbox', { name: 'Contact the backup supplier' })).toBeChecked();
      await page.reload();
      await openAikonic(page);
      p = await openPhone(page);
      await expect(p.getByRole('checkbox', { name: 'Contact the backup supplier' })).toBeChecked();
      await p.getByRole('checkbox', { name: 'Contact the backup supplier' }).uncheck();
    });

    test('with storage blocked it still works, and says it could not save', async ({ page }) => {
      await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await openAikonic(page);
      const p = await openPhone(page);
      await p.getByRole('checkbox', { name: 'Order new lids' }).check();
      await expect(p.locator('.aik-saved')).toContainText('Could not save here');
      expect(errors).toEqual([]);
    });

    test('switches between English, Japanese and Traditional Chinese', async ({ page }) => {
      await openAikonic(page);
      const p = await openPhone(page);
      await p.getByRole('button', { name: 'JA', exact: true }).click();
      await expect(p.locator('.aik-share')).toHaveText('ノートを共有');
      await expect(p.locator('.aik-phone-body')).toHaveAttribute('lang', 'ja');
      await p.getByRole('button', { name: '繁中' }).click();
      await expect(p.locator('.aik-share')).toHaveText('分享筆記');
      await expect(p.locator('.aik-phone-body')).toHaveAttribute('lang', 'zh-Hant');
    });

    test('a note without a translation says so instead of pretending', async ({ page }) => {
      await openAikonic(page);
      await aik(page).locator('.aik-rec[data-open="menu"]').click();
      const p = await openPhone(page);
      await p.getByRole('button', { name: 'JA', exact: true }).click();
      await expect(p.locator('.aik-phone-en')).toBeVisible();
    });

    test('How I built this: flat versus structured, and silent versus clear failure', async ({ page }) => {
      await openAikonic(page);
      const p = await openPhone(page);
      await p.getByRole('button', { name: 'Share note' }).click();
      await expect(p.locator('.aik-banner')).toContainText('Could not share this note');
      await p.getByRole('button', { name: 'Try again' }).click();
      await expect(p.locator('.aik-banner')).toContainText('Note shared.');
      const box = await openDrawer(p);
      await expect(box).toContainText('What I built Resolved silent failures');
      await box.getByRole('button', { name: 'Before: flat' }).click();
      await expect(p.locator('.aik-phone .aik-block-h')).toHaveCount(0);
      await expect(p.locator('.aik-flat')).toContainText('Decisions Move the Kowloon opening');
      await box.getByRole('button', { name: 'Before: silent' }).click();
      await p.getByRole('button', { name: 'Share note' }).click();
      await expect(p.locator('.aik-banner')).toBeHidden();
      await expect(p.locator('.aik-narrate')).toContainText('the screen gave no sign');
      await box.getByRole('button', { name: 'Reload this screen' }).click();
      await expect(p.locator('.aik-narrate')).toContainText('Reloaded from storage');
    });
  });

  test('no em or en dashes anywhere in the window, with every view opened', async ({ page }) => {
    await openAikonic(page);
    const d = aik(page);
    const check = async () => expect(await d.innerText()).not.toMatch(/[–—]/);
    await check();
    for (const open of ['[data-action="podcast"]', '[data-action="back"]', '[data-show="memory"]', '[data-action="back"]', '[data-action="phone"]']) {
      await d.locator(open).click();
      await check();
    }
  });
});

test.describe('Both demos', () => {
  for (const width of [360, 768, 1440]) {
    test(`no sideways scroll at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openSpade(page);
      const run = spade(page).getByRole('button', { name: 'Run next round' });
      for (let i = 0; i < 3; i++) await run.click();
      await noSidewaysScroll(page);
      await openAikonic(page);
      await aik(page).getByLabel("Search everything you've recorded").fill('supplier delay');
      await noSidewaysScroll(page);
      for (const open of ['[data-action="podcast"]', '[data-action="back"]', '[data-show="memory"]', '[data-action="back"]', '[data-action="phone"]']) {
        await aik(page).locator(open).click();
        await noSidewaysScroll(page);
      }
    });
  }

  test('have no axe violations while in use', async ({ page }) => {
    await openSpade(page);
    await spade(page).getByRole('button', { name: 'Run next round' }).click();
    const s = await new AxeBuilder({ page }).include('[data-demo="spade"]').analyze();
    expect(s.violations).toEqual([]);
    await openAikonic(page);
    await aik(page).getByLabel("Search everything you've recorded").fill('supplier delay');
    const a = await new AxeBuilder({ page }).include('[data-demo="aikonic"]').analyze();
    expect(a.violations).toEqual([]);
    for (const open of ['[data-action="close-results"]', '[data-action="podcast"]', '[data-action="back"]', '[data-show="memory"]', '[data-action="back"]', '[data-action="phone"]']) {
      await aik(page).locator(open).click();
      const r = await new AxeBuilder({ page }).include('[data-demo="aikonic"]').analyze();
      expect(r.violations.map((v) => `${open}: ${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
    }
  });

  test('previews on the homepage hold no tab stops', async ({ page }) => {
    await page.goto('/');
    for (const s of ['.v-sp', '.v-ak']) {
      await expect(page.locator(s)).toHaveAttribute('aria-hidden', 'true');
      await expect(page.locator(`${s} :is(a, button, input, [tabindex])`)).toHaveCount(0);
    }
  });
});
