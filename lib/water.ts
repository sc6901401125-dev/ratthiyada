export type Activity = 'low' | 'medium' | 'high';

export type DrinkLog = { id: string; amount: number; at: string };
export type DayRecord = { date: string; goal: number; logs: DrinkLog[] };

export const MAX_DRINK_AMOUNT = 5000;
export const MAX_SAVED_DAYS = 90;

export const activityExtra: Record<Activity, number> = {
  low: 0,
  medium: 350,
  high: 700,
};

export const isoDate = (date = new Date()) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

export const isActivity = (value: unknown): value is Activity =>
  value === 'low' || value === 'medium' || value === 'high';

export const isValidIsoDay = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isFinite(parsed.getTime()) && isoDate(parsed) === value;
};

export const normalizeWeight = (value: number) =>
  Math.max(30, Math.min(Number.isFinite(value) ? value : 60, 250));

export const calculateGoal = (weight: number, activity: Activity) =>
  Math.round((normalizeWeight(weight) * 35 + activityExtra[activity]) / 50) *
  50;

export const normalizeRecords = (value: unknown): DayRecord[] => {
  if (!Array.isArray(value)) return [];
  const normalized = value.flatMap((record): DayRecord[] => {
    if (!record || typeof record !== 'object') return [];
    const candidate = record as Partial<DayRecord>;
    if (
      typeof candidate.date !== 'string' ||
      !isValidIsoDay(candidate.date) ||
      !Array.isArray(candidate.logs)
    )
      return [];
    const logs = candidate.logs.flatMap((log, index): DrinkLog[] => {
      if (!log || typeof log !== 'object') return [];
      const item = log as Partial<DrinkLog>;
      const amount = Number(item.amount);
      if (!Number.isFinite(amount) || amount < 1 || amount > MAX_DRINK_AMOUNT)
        return [];
      return [
        {
          id:
            typeof item.id === 'string'
              ? item.id
              : `${candidate.date}-${index}`,
          amount: Math.round(amount),
          at:
            typeof item.at === 'string'
              ? item.at
              : `${candidate.date}T00:00:00.000Z`,
        },
      ];
    });
    const savedGoal = Number(candidate.goal);
    return [
      {
        date: candidate.date,
        goal:
          Number.isFinite(savedGoal) && savedGoal >= 1050 && savedGoal <= 10000
            ? savedGoal
            : 2100,
        logs,
      },
    ];
  });
  const byDate = new Map<string, DayRecord>();
  for (const record of normalized) {
    const existing = byDate.get(record.date);
    byDate.set(
      record.date,
      existing
        ? { ...record, logs: [...existing.logs, ...record.logs] }
        : record,
    );
  }
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_SAVED_DAYS);
};

export const shouldSendReminder = ({
  now,
  consumed,
  goal,
  lastReminderAt,
}: {
  now: Date;
  consumed: number;
  goal: number;
  lastReminderAt: number;
}) => {
  const hour = now.getHours() + now.getMinutes() / 60;
  if (
    hour < 8 ||
    hour > 21 ||
    consumed >= goal ||
    now.getTime() - lastReminderAt < 60 * 60 * 1000
  )
    return false;
  const expected = goal * Math.min(Math.max((hour - 7) / 15, 0), 1);
  return consumed + 250 < expected;
};
