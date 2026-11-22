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

test("message matches the customer service format", () => {
  assert.strictEqual(
    h.buildMessage("Habeba", "https://meet.google.com/aui-wneq-zdw", ["Saturday, 21 Nov · 6–7 PM"]),
    "Habeba\nSaturday, 21 Nov · 6–7 PM\nGoogle Meet joining info\nVideo call link: https://meet.google.com/aui-wneq-zdw");
});

test("date and time range formatting", () => {
  assert.strictEqual(h.fmtDate("2026-11-21"), "Saturday, 21 Nov");
  assert.strictEqual(h.fmtRange(18, 0), "6–7 PM");
  assert.strictEqual(h.fmtRange(18, 30), "6:30–7:30 PM");
  assert.strictEqual(h.fmtRange(11, 30), "11:30 AM–12:30 PM");
  assert.strictEqual(h.fmtRange(23, 0), "11 PM–12 AM");
});

test("one-off session details", () => {
  assert.deepStrictEqual(h.sessionDetails({ type: "once", date: "2026-11-21", h: 18, m: 0 }),
    ["Saturday, 21 Nov · 6–7 PM"]);
});

test("weekly session details: one line per day, ordered from the start date", () => {
  // start Saturday 2026-11-21; Wednesday listed before Sunday on purpose
  const lines = h.sessionDetails({ type: "weekly", startDate: "2026-11-21", weeks: 8, slots: [
    { js: 3, h: 21, m: 0 },
    { js: 0, h: 19, m: 0 },
  ] });
  assert.deepStrictEqual(lines, [
    "Sunday, 22 Nov · 7–8 PM (weekly, 8 weeks)",
    "Wednesday, 25 Nov · 9–10 PM (weekly, 8 weeks)",
  ]);
});

test("phone normalization defaults to Egypt", () => {
  assert.strictEqual(h.normalizePhone("01012345678"), "201012345678");
  assert.strictEqual(h.normalizePhone("010 1234 5678"), "201012345678");
  assert.strictEqual(h.normalizePhone("+20 101-234-5678"), "201012345678");
  assert.strictEqual(h.normalizePhone("00201012345678"), "201012345678");
  assert.strictEqual(h.normalizePhone("1012345678"), "201012345678");
  assert.strictEqual(h.normalizePhone("+966501234567"), "966501234567");
  assert.strictEqual(h.normalizePhone("abc"), "");
});

test("wa.me link encodes the message", () => {
  assert.strictEqual(h.waLink("201012345678", "Ahmed\nhttps://meet.google.com/x"),
    "https://wa.me/201012345678?text=Ahmed%0Ahttps%3A%2F%2Fmeet.google.com%2Fx");
  assert.strictEqual(h.waLink("", "hi"), "https://wa.me/?text=hi");
});
