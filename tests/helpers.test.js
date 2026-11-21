const test = require("node:test");
const assert = require("node:assert");
const h = require("../app.js");

test("12h to 24h", () => {
  assert.deepStrictEqual(h.to24h("12", "00", "AM"), { h: 0, m: 0 });
  assert.deepStrictEqual(h.to24h("12", "30", "PM"), { h: 12, m: 30 });
  assert.deepStrictEqual(h.to24h("7", "05", "PM"), { h: 19, m: 5 });
});

test("one hour later crosses midnight", () => {
  assert.strictEqual(h.localDateTime("2026-12-31", 23, 30, 60), "2027-01-01T00:30:00");
});

test("weekly: same time groups into one series starting on first matching day", () => {
  // 2026-11-21 is a Saturday
  const slots = [
    { js: 0, rr: "SU", h: 19, m: 0 },
    { js: 3, rr: "WE", h: 19, m: 0 },
  ];
  const s = h.buildWeeklySeries("2026-11-21", slots, 8);
  assert.strictEqual(s.length, 1);
  assert.strictEqual(s[0].start, "2026-11-22T19:00:00");
  assert.strictEqual(s[0].end, "2026-11-22T20:00:00");
  assert.deepStrictEqual(s[0].recurrence, ["RRULE:FREQ=WEEKLY;BYDAY=SU,WE;COUNT=16"]);
});

test("weekly: different times make separate series", () => {
  const slots = [
    { js: 0, rr: "SU", h: 19, m: 0 },
    { js: 3, rr: "WE", h: 21, m: 0 },
  ];
  const s = h.buildWeeklySeries("2026-11-21", slots, 4);
  assert.strictEqual(s.length, 2);
  assert.strictEqual(s[0].start, "2026-11-22T19:00:00");
  assert.strictEqual(s[1].start, "2026-11-25T21:00:00");
  assert.deepStrictEqual(s[1].recurrence, ["RRULE:FREQ=WEEKLY;BYDAY=WE;COUNT=4"]);
});

test("message is name then link", () => {
  assert.strictEqual(h.buildMessage("Ahmed", "https://meet.google.com/x"), "Ahmed\nhttps://meet.google.com/x");
});
