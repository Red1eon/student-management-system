function pad2(value) {
  return String(value).padStart(2, '0');
}

function dateKeyFromYmd(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function ymdFromDate(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function nthWeekdayOfMonth(year, month, weekday, nth) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = first.getUTCDay();
  const offset = (7 + weekday - firstWeekday) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return dateKeyFromYmd(year, month, day);
}

function vernalEquinoxDay(year) {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnEquinoxDay(year) {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function buildBaseHolidays(year) {
  const holidays = new Map();

  holidays.set(dateKeyFromYmd(year, 1, 1), "New Year's Day");
  holidays.set(nthWeekdayOfMonth(year, 1, 1, 2), 'Coming of Age Day');
  holidays.set(dateKeyFromYmd(year, 2, 11), 'National Foundation Day');
  holidays.set(dateKeyFromYmd(year, 2, 23), "Emperor's Birthday");
  holidays.set(dateKeyFromYmd(year, 3, vernalEquinoxDay(year)), 'Vernal Equinox Day');
  holidays.set(dateKeyFromYmd(year, 4, 29), 'Showa Day');
  holidays.set(dateKeyFromYmd(year, 5, 3), 'Constitution Memorial Day');
  holidays.set(dateKeyFromYmd(year, 5, 4), 'Greenery Day');
  holidays.set(dateKeyFromYmd(year, 5, 5), "Children's Day");
  holidays.set(nthWeekdayOfMonth(year, 7, 1, 3), 'Marine Day');
  holidays.set(dateKeyFromYmd(year, 8, 11), 'Mountain Day');
  holidays.set(nthWeekdayOfMonth(year, 9, 1, 3), 'Respect for the Aged Day');
  holidays.set(dateKeyFromYmd(year, 9, autumnEquinoxDay(year)), 'Autumnal Equinox Day');
  holidays.set(nthWeekdayOfMonth(year, 10, 1, 2), 'Sports Day');
  holidays.set(dateKeyFromYmd(year, 11, 3), 'Culture Day');
  holidays.set(dateKeyFromYmd(year, 11, 23), 'Labour Thanksgiving Day');

  return holidays;
}

function applySubstituteHolidays(holidays) {
  const keys = Array.from(holidays.keys()).sort();

  keys.forEach((key) => {
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCDay() !== 0) return;

    let substitute = addDays(date, 1);
    let substituteKey = dateKeyFromYmd(substitute.getUTCFullYear(), substitute.getUTCMonth() + 1, substitute.getUTCDate());
    while (holidays.has(substituteKey)) {
      substitute = addDays(substitute, 1);
      substituteKey = dateKeyFromYmd(substitute.getUTCFullYear(), substitute.getUTCMonth() + 1, substitute.getUTCDate());
    }
    holidays.set(substituteKey, 'Substitute Holiday');
  });
}

function applyCitizensHolidays(holidays, year) {
  for (let month = 1; month <= 12; month += 1) {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = 2; day < daysInMonth; day += 1) {
      const key = dateKeyFromYmd(year, month, day);
      if (holidays.has(key)) continue;

      const prevKey = dateKeyFromYmd(year, month, day - 1);
      const nextKey = dateKeyFromYmd(year, month, day + 1);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCDay() === 0) continue;

      if (holidays.has(prevKey) && holidays.has(nextKey)) {
        holidays.set(key, "Citizen's Holiday");
      }
    }
  }
}

function getJapaneseHolidays(year) {
  const holidays = buildBaseHolidays(year);
  applySubstituteHolidays(holidays);
  applyCitizensHolidays(holidays, year);
  return holidays;
}

function getTokyoDateParts(referenceDate = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(referenceDate);

  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value);
  const day = Number(parts.find((p) => p.type === 'day').value);
  return { year, month, day };
}

function getSchoolDayStatus(dateUtc) {
  const { year, month, day } = ymdFromDate(dateUtc);
  const key = dateKeyFromYmd(year, month, day);
  const holidays = getJapaneseHolidays(year);
  const holidayName = holidays.get(key) || null;
  const weekday = dateUtc.getUTCDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const isHoliday = Boolean(holidayName);
  const isSchoolOpen = !isWeekend && !isHoliday;

  return {
    date: key,
    holidayName,
    isWeekend,
    isHoliday,
    isSchoolOpen,
    label: isSchoolOpen ? 'School Open' : (holidayName || (isWeekend ? 'Weekend' : 'School Closed'))
  };
}

function getJapanSchoolStatus(referenceDate = new Date()) {
  const todayParts = getTokyoDateParts(referenceDate);
  const todayDate = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day));
  const tomorrowDate = addDays(todayDate, 1);

  return {
    today: getSchoolDayStatus(todayDate),
    tomorrow: getSchoolDayStatus(tomorrowDate)
  };
}

module.exports = {
  getJapanSchoolStatus,
  getJapaneseHolidays
};
