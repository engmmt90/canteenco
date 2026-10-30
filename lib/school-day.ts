export const DEFAULT_SCHOOL_TIMEZONE = "Australia/Brisbane";

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function getSchoolDateParts(date: Date, timeZone = DEFAULT_SCHOOL_TIMEZONE): DateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getSchoolDateParts(date, timeZone);

  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) -
    Math.floor(date.getTime() / 1000) * 1000
  );
}

export function getSchoolDateStartUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  let result = new Date(utcGuess.getTime() - timeZoneOffsetMs(utcGuess, timeZone));

  // Re-evaluate once at the resulting instant so DST boundaries are handled correctly.
  result = new Date(
    utcGuess.getTime() - timeZoneOffsetMs(result, timeZone),
  );

  return result;
}

export function getSchoolDayBounds(
  now: Date,
  timeZone = DEFAULT_SCHOOL_TIMEZONE,
) {
  const parts = getSchoolDateParts(now, timeZone);

  const start = getSchoolDateStartUtc(
    parts.year,
    parts.month,
    parts.day,
    timeZone,
  );

  const nextLocalDate = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + 1),
  );

  const end = getSchoolDateStartUtc(
    nextLocalDate.getUTCFullYear(),
    nextLocalDate.getUTCMonth() + 1,
    nextLocalDate.getUTCDate(),
    timeZone,
  );

  return { start, end };
}


export function getSchoolDateBounds(
  year: number,
  month: number,
  day: number,
  timeZone = DEFAULT_SCHOOL_TIMEZONE,
) {
  const start = getSchoolDateStartUtc(
    year,
    month,
    day,
    timeZone,
  );

  const nextLocalDate = new Date(
    Date.UTC(year, month - 1, day + 1),
  );

  const end = getSchoolDateStartUtc(
    nextLocalDate.getUTCFullYear(),
    nextLocalDate.getUTCMonth() + 1,
    nextLocalDate.getUTCDate(),
    timeZone,
  );

  return { start, end };
}
