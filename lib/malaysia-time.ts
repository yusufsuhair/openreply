export const MALAYSIA_LOCALE = "en-MY";
export const MALAYSIA_TIME_ZONE = "Asia/Kuala_Lumpur";

type DateValue = Date | string | number;

function dateParts(value: DateValue) {
  return Object.fromEntries(
    new Intl.DateTimeFormat(MALAYSIA_LOCALE, {
      timeZone: MALAYSIA_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<"year" | "month" | "day", string>;
}

export function formatMalaysiaDate(
  value: DateValue,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
) {
  return new Intl.DateTimeFormat(MALAYSIA_LOCALE, {
    ...options,
    timeZone: MALAYSIA_TIME_ZONE,
  }).format(new Date(value));
}

export function formatMalaysiaTime(value: DateValue) {
  return formatMalaysiaDate(value, { hour: "numeric", minute: "2-digit" });
}

export function formatMalaysiaDateTime(value: DateValue) {
  return formatMalaysiaDate(value, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A UTC Date whose calendar fields are the current Kuala Lumpur calendar day. */
export function malaysiaCalendarDate(value: DateValue = new Date()) {
  const { year, month, day } = dateParts(value);
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

export function malaysiaDateKey(value: DateValue) {
  const { year, month, day } = dateParts(value);
  return `${year}-${month}-${day}`;
}

export function malaysiaDayWindow(daysAgo = 0, now: DateValue = new Date()) {
  const { year, month, day } = dateParts(now);
  const start = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day) - daysAgo, -8),
  );
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function malaysiaMonthStart(now: DateValue = new Date()) {
  const { year, month } = dateParts(now);
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1, -8));
}
