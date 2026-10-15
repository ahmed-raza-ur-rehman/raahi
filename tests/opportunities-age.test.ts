import assert from "node:assert/strict";
import test from "node:test";
import { ageOn, checkAge, daysFrom } from "@/lib/opportunities/age";

test("age in completed years, months and days", () => {
  assert.deepEqual(ageOn("2000-03-15", "2026-10-15"), { years: 26, months: 7, days: 0 });
  assert.deepEqual(ageOn("2000-03-15", "2026-03-14"), { years: 25, months: 11, days: 27 }, "the day before a birthday");
  assert.deepEqual(ageOn("2000-03-15", "2026-03-15"), { years: 26, months: 0, days: 0 }, "on the birthday");
  assert.deepEqual(ageOn("1999-12-31", "2027-01-01"), { years: 27, months: 0, days: 1 }, "across New Year");
  assert.deepEqual(ageOn("2000-01-31", "2000-03-01"), { years: 0, months: 1, days: 1 });
  assert.deepEqual(ageOn("2026-10-15", "2026-10-15"), { years: 0, months: 0, days: 0 });
});

test("a 29 February birthday is counted on 1 March in other years", () => {
  assert.deepEqual(ageOn("2000-02-29", "2026-02-28"), { years: 25, months: 11, days: 30 });
  assert.deepEqual(ageOn("2000-02-29", "2026-03-01"), { years: 26, months: 0, days: 0 });
  assert.deepEqual(ageOn("2000-02-29", "2028-02-29"), { years: 28, months: 0, days: 0 }, "a leap year has the real day");
});

test("invalid input gives no answer", () => {
  assert.equal(ageOn("2000-13-01", "2026-10-15"), undefined);
  assert.equal(ageOn("2000-02-30", "2026-10-15"), undefined);
  assert.equal(ageOn("not a date", "2026-10-15"), undefined);
  assert.equal(ageOn("2030-01-01", "2026-10-15"), undefined, "born after the reference date");
  assert.equal(checkAge({ dob: "", asOn: "2026-10-15", maxYears: 28 }), undefined);
});

test("limit of 28 years: both readings, and the last day for each", () => {
  const ok = checkAge({ dob: "2000-03-15", asOn: "2026-10-15", maxYears: 28 })!;
  assert.equal(ok.limit, 28);
  assert.equal(ok.withinByCompletedYears, true);
  assert.equal(ok.withinToTheDay, true);
  assert.equal(ok.lastDayToTheDay, "2028-03-15", "the 28th birthday itself");
  assert.equal(ok.lastDayByCompletedYears, "2029-03-14", "the day before the 29th birthday");

  // 28 years and one day: inside by completed years, outside to the day
  const edge = checkAge({ dob: "2000-03-15", asOn: "2028-03-16", maxYears: 28 })!;
  assert.deepEqual(edge.age, { years: 28, months: 0, days: 1 });
  assert.equal(edge.withinByCompletedYears, true);
  assert.equal(edge.withinToTheDay, false);

  // the exact 28th birthday is inside both
  const exact = checkAge({ dob: "2000-03-15", asOn: "2028-03-15", maxYears: 28 })!;
  assert.equal(exact.withinToTheDay, true);

  // the 29th birthday is outside both
  const over = checkAge({ dob: "2000-03-15", asOn: "2029-03-15", maxYears: 28 })!;
  assert.equal(over.withinByCompletedYears, false);
  assert.equal(over.withinToTheDay, false);
});

test("relaxation adds to the limit, a minimum age is checked separately", () => {
  const strict = checkAge({ dob: "1995-06-01", asOn: "2026-10-15", maxYears: 28 })!;
  assert.equal(strict.withinByCompletedYears, false, "31 is over 28");
  const relaxed = checkAge({ dob: "1995-06-01", asOn: "2026-10-15", maxYears: 28, relaxationYears: 5 })!;
  assert.equal(relaxed.limit, 33);
  assert.equal(relaxed.withinByCompletedYears, true);
  assert.equal(checkAge({ dob: "1995-06-01", asOn: "2026-10-15", maxYears: 28, relaxationYears: -4 })!.limit, 28, "negative relaxation is ignored");

  const young = checkAge({ dob: "2010-01-01", asOn: "2026-10-15", minYears: 18 })!;
  assert.equal(young.meetsMinimum, false);
  assert.equal(young.limit, undefined, "no limit entered, no verdict on it");
  assert.equal(checkAge({ dob: "2000-01-01", asOn: "2026-10-15", minYears: 18 })!.meetsMinimum, true);
});

test("a leap-day birthday's last days use the same 1 March convention", () => {
  const check = checkAge({ dob: "2000-02-29", asOn: "2026-10-15", maxYears: 29 })!;
  assert.equal(check.lastDayToTheDay, "2029-03-01");
  assert.equal(check.lastDayByCompletedYears, "2030-02-28");
});

test("how many days remain until a date", () => {
  assert.equal(daysFrom("2026-10-15", "2026-10-20"), 5);
  assert.equal(daysFrom("2026-10-15", "2026-10-15"), 0);
  assert.equal(daysFrom("2026-10-15", "2026-10-10"), -5);
});
