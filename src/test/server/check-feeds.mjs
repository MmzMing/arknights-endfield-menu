// Hand-rolled checks (project rule: no test frameworks, node:assert only).
// 生产事故回归：EdgeOne 边缘运行时的 fetch 不理会 signal、可能永不 settle，
// 聚合的返回时机必须由墙钟兜底（单源 deadline + 整体预算 race），而不是指望 abort 让请求收尾。
// 另外覆盖 ?batch=N 接口：切片口径、非法批次拒绝、全量兼容。
// Run: node src/test/server/check-feeds.mjs

import assert from "node:assert/strict";
import { FEED_CONFIG } from "../../../src/config/feeds.ts";
import { FEED_SOURCES, feedBatch, feedBatchCount } from "../../../src/config/feed-sources.ts";
import { aggregateFeeds, handleFeedsRequest } from "../../../server/feeds.ts";

// 最恶劣的运行时：fetch 立刻挂起且无视 signal，任何在途抓取都永不完成
globalThis.fetch = () => new Promise(() => {});
// 本脚本故意让全部源失败，逐源的 console.warn 是纯噪音
console.warn = () => {};

{
  const started = Date.now();
  const snapshot = await aggregateFeeds({ attempts: 1, concurrency: 22, maxPerSite: 5, timeoutMs: 300, budgetMs: 5000 });
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 2000, `单源 deadline 兑现后应尽快返回，实际 ${elapsed}ms`);
  assert.equal(snapshot.total, snapshot.failures.length, "每个源都要有失败记录");
  assert.ok(snapshot.failures.length > 0, "应抓取到源");
  for (const failure of snapshot.failures) {
    assert.equal(failure.reason, "请求超时", `源 ${failure.name} 的失败原因`);
  }
  console.log(`ok  单源 deadline 兜底: ${snapshot.failures.length} 源全部超时收尾, ${elapsed}ms`);
}

{
  const started = Date.now();
  const snapshot = await aggregateFeeds({ attempts: 1, concurrency: 22, maxPerSite: 5, timeoutMs: 2000, budgetMs: 500 });
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 1500, `预算到点必须交卷（不能等单源超时），实际 ${elapsed}ms`);
  assert.equal(snapshot.items.length, 0, "全挂时不应有条目");
  assert.equal(snapshot.total, snapshot.failures.length, "未开抓 / 在途的源都要记失败");
  for (const failure of snapshot.failures) {
    assert.equal(failure.reason, "未抓取（整体超时）", `源 ${failure.name} 的失败原因`);
  }
  assert.ok(!Number.isNaN(Date.parse(snapshot.generatedAt)), "generatedAt 应为合法时间");
  console.log(`ok  整体预算兜底: 预算到点交卷, ${snapshot.failures.length} 源记未抓取, ${elapsed}ms`);
}

{
  // 批次接口：每个源都返回一份合法 RSS，验证切片口径、非法批次拒绝与全量兼容
  let call = 0;
  const rssFor = (n) => `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel><title>t${n}</title>
<item><title>entry ${n}a</title><link>https://example.com/${n}/a</link><pubDate>Mon, 20 Oct 2026 00:00:00 GMT</pubDate></item>
<item><title>entry ${n}b</title><link>https://example.com/${n}/b</link><pubDate>Sun, 19 Oct 2026 00:00:00 GMT</pubDate></item>
</channel></rss>`;
  globalThis.fetch = async () => {
    const n = call++;
    return new Response(rssFor(n), { status: 200, headers: { "content-type": "application/rss+xml; charset=utf-8" } });
  };

  const batch = feedBatch(0);
  const res = await handleFeedsRequest(new Request("https://www.mmzhiku.xyz/api/feeds?batch=0"));
  assert.equal(res.status, 200);
  const snapshot = await res.json();
  assert.ok(batch.length > 0 && batch.length <= FEED_CONFIG.batchSize, "批大小应在 (0, batchSize]");
  assert.equal(snapshot.total, batch.length, "批内 total 应是该批的源数");
  assert.equal(snapshot.sites, batch.length, "每源 2 条，应全部成功");
  assert.equal(snapshot.items.length, batch.length * 2, "每源 2 条且互不重复");

  for (const invalid of ["abc", "", "1.5", "-1", String(feedBatchCount())]) {
    const bad = await handleFeedsRequest(new Request(`https://www.mmzhiku.xyz/api/feeds?batch=${invalid}`));
    assert.equal(bad.status, 400, `batch=${JSON.stringify(invalid)} 应被拒绝`);
  }

  const full = await handleFeedsRequest(new Request("https://www.mmzhiku.xyz/api/feeds"));
  assert.equal(full.status, 200);
  const fullSnapshot = await full.json();
  assert.equal(fullSnapshot.total, FEED_SOURCES.length, "不带 batch 应聚合全部源");
  console.log(
    `ok  批次接口: ${feedBatchCount()} 批 × ≤${FEED_CONFIG.batchSize} 源, 全量 ${FEED_SOURCES.length} 源, 非法批次 400`,
  );
}

console.log("\ncheck-feeds passed");