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

test("message: bold name, details, then link", () => {
  assert.strictEqual(h.buildMessage("Ahmed", "https://meet.google.com/x", ["📅 a"]),
    "*Ahmed*\n📅 a\n🔗 https://meet.google.com/x");
});

test("time and date formatting", () => {
  assert.strictEqual(h.fmtTime(19, 0), "7:00 م");
  assert.strictEqual(h.fmtTime(0, 30), "12:30 ص");
  assert.strictEqual(h.fmtTime(24, 30), "12:30 ص");
  assert.strictEqual(h.fmtDate("2026-11-22"), "الأحد 22 نوفمبر 2026");
});

test("one-off session details", () => {
  assert.deepStrictEqual(h.sessionDetails({ type: "once", date: "2026-11-22", h: 23, m: 30 }), [
    "📅 الأحد 22 نوفمبر 2026",
    "⏰ من 11:30 م لـ 12:30 ص (بتوقيت القاهرة)",
  ]);
});

test("weekly session details are ordered from the start date", () => {
  // start Saturday 2026-11-21; Wednesday listed before Sunday on purpose
  const lines = h.sessionDetails({ type: "weekly", startDate: "2026-11-21", weeks: 8, slots: [
    { js: 3, ar: "الأربعاء", h: 21, m: 0 },
    { js: 0, ar: "الأحد", h: 19, m: 0 },
  ] });
  assert.deepStrictEqual(lines, [
    "🔁 كل أسبوع لمدة 8 أسابيع",
    "📅 الأحد من 7:00 م لـ 8:00 م",
    "📅 الأربعاء من 9:00 م لـ 10:00 م",
    "🗓️ من الأحد 22 نوفمبر 2026 لحد الأربعاء 13 يناير 2027",
    "⏰ المواعيد بتوقيت القاهرة",
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
