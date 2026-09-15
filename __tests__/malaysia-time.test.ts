import { expect, it } from "vitest";
import {
  malaysiaCalendarDate,
  malaysiaDateKey,
  malaysiaDayWindow,
  malaysiaMonthStart,
} from "../lib/malaysia-time";

it("uses Kuala Lumpur calendar boundaries instead of UTC boundaries", () => {
  const instant = new Date("2026-09-14T16:30:00.000Z");
  expect(malaysiaDateKey(instant)).toBe("2026-09-15");
  expect(malaysiaCalendarDate(instant).toISOString()).toBe(
    "2026-09-15T00:00:00.000Z",
  );
  expect(malaysiaDayWindow(0, instant).start.toISOString()).toBe(
    "2026-09-14T16:00:00.000Z",
  );
  expect(malaysiaMonthStart(instant).toISOString()).toBe(
    "2026-08-31T16:00:00.000Z",
  );
});
