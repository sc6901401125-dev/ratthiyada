'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BellRing,
  Check,
  Droplets,
  Plus,
  Settings2,
  Sparkles,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import {
  MAX_DRINK_AMOUNT,
  MAX_SAVED_DAYS,
  calculateGoal,
  isoDate,
  isActivity,
  normalizeRecords,
  normalizeWeight,
  shouldSendReminder,
  type Activity,
  type DayRecord,
  type DrinkLog,
} from '@/lib/water';

const STORAGE_KEY = 'sipday-water-v1';
const activityLabel: Record<Activity, string> = {
  low: 'เบา · งานนั่งโต๊ะ',
  medium: 'ปานกลาง · ออกกำลัง 30–60 นาที',
  high: 'หนัก · ออกกำลังมากกว่า 60 นาที',
};
const quickAmounts = [250, 350, 500];
const formatMl = (value: number) => value.toLocaleString('th-TH');
const progressConfig = {
  consumed: { label: 'ดื่มแล้ว', color: '#138D9A' },
  remaining: { label: 'คงเหลือ', color: '#E5F1EF' },
} satisfies ChartConfig;
const weeklyConfig = {
  amount: { label: 'ปริมาณน้ำ', color: '#138D9A' },
} satisfies ChartConfig;

export default function Home() {
  const [weight, setWeight] = useState('60');
  const [activity, setActivity] = useState<Activity>('medium');
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [customAmount, setCustomAmount] = useState('200');
  const [reminders, setReminders] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success');
  const [storageWarning, setStorageWarning] = useState('');
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState('');
  const messageTimer = useRef<number | undefined>(undefined);
  const lastReminderAt = useRef(0);
  const preservedCorruptData = useRef(false);
  const normalizedWeight = normalizeWeight(Number(weight));
  const goal = calculateGoal(normalizedWeight, activity);
  const todayRecord = records.find((record) => record.date === today);
  const consumed =
    todayRecord?.logs.reduce((sum, log) => sum + log.amount, 0) ?? 0;
  const remaining = Math.max(goal - consumed, 0);
  const percent = goal ? Math.min(Math.round((consumed / goal) * 100), 100) : 0;

  useEffect(() => {
    const hydrate = () => {
      setToday(isoDate());
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, unknown>;
          setWeight(String(normalizeWeight(Number(parsed.weight))));
          setActivity(isActivity(parsed.activity) ? parsed.activity : 'medium');
          setRecords(normalizeRecords(parsed.records));
          setReminders(
            Boolean(parsed.reminders) &&
              typeof Notification !== 'undefined' &&
              Notification.permission === 'granted',
          );
        }
      } catch {
        if (saved) {
          try {
            localStorage.setItem(`${STORAGE_KEY}-backup-${Date.now()}`, saved);
            preservedCorruptData.current = true;
          } catch {
            /* Storage may be unavailable. */
          }
        }
        setStorageWarning(
          preservedCorruptData.current
            ? 'ข้อมูลเดิมเสียรูปแบบ ระบบสำรองข้อมูลเดิมไว้แล้วและเริ่มชุดใหม่'
            : 'อ่านข้อมูลเดิมไม่ได้ จึงเริ่มด้วยข้อมูลใหม่',
        );
      } finally {
        setReady(true);
      }
    };
    queueMicrotask(hydrate);
    const dayTimer = window.setInterval(
      () =>
        setToday((current) => {
          const next = isoDate();
          return current === next ? current : next;
        }),
      60_000,
    );
    return () => window.clearInterval(dayTimer);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          weight: normalizedWeight,
          activity,
          records: records.slice(-MAX_SAVED_DAYS),
          reminders,
        }),
      );
    } catch {
      queueMicrotask(() =>
        setStorageWarning(
          'บันทึกข้อมูลในอุปกรณ์ไม่สำเร็จ กรุณาตรวจพื้นที่จัดเก็บหรือโหมดส่วนตัว',
        ),
      );
    }
  }, [normalizedWeight, activity, records, reminders, ready]);
  useEffect(
    () => () => {
      if (messageTimer.current) window.clearTimeout(messageTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (
      !reminders ||
      typeof Notification === 'undefined' ||
      Notification.permission !== 'granted'
    )
      return;
    const check = () => {
      const now = new Date();
      if (
        shouldSendReminder({
          now,
          consumed,
          goal,
          lastReminderAt: lastReminderAt.current,
        })
      ) {
        try {
          new Notification('SipDay ชวนดื่มน้ำ 💧', {
            body: `วันนี้ยังเหลืออีก ${formatMl(remaining)} มล. ลองพักแล้วดื่มน้ำสักแก้วนะ`,
          });
          lastReminderAt.current = Date.now();
        } catch {
          queueMicrotask(() => {
            setReminders(false);
            setMessageTone('error');
            setMessage('เบราว์เซอร์นี้ไม่สามารถส่งการแจ้งเตือนได้');
          });
        }
      }
    };
    check();
    const id = window.setInterval(check, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [reminders, consumed, goal, remaining]);

  const addDrink = (amount: number) => {
    const normalizedAmount = Math.round(amount);
    if (
      !ready ||
      !today ||
      !Number.isFinite(normalizedAmount) ||
      normalizedAmount < 1 ||
      normalizedAmount > MAX_DRINK_AMOUNT
    ) {
      setMessageTone('error');
      setMessage(`กรุณาระบุปริมาณ 1–${formatMl(MAX_DRINK_AMOUNT)} มล.`);
      return;
    }
    const log: DrinkLog = {
      id: crypto.randomUUID(),
      amount: normalizedAmount,
      at: new Date().toISOString(),
    };
    setRecords((current) => {
      const existing = current.find((record) => record.date === today);
      const next = existing
        ? current.map((record) =>
            record.date === today
              ? { ...record, goal, logs: [...record.logs, log] }
              : record,
          )
        : [...current, { date: today, goal, logs: [log] }];
      return next
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-MAX_SAVED_DAYS);
    });
    setMessageTone('success');
    setMessage(`บันทึก ${formatMl(normalizedAmount)} มล. แล้ว`);
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(''), 2400);
  };
  const toggleReminder = async (checked: boolean) => {
    if (!checked) return setReminders(false);
    if (typeof Notification === 'undefined') {
      setMessageTone('error');
      setMessage('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setReminders(permission === 'granted');
      setMessageTone(permission === 'granted' ? 'success' : 'error');
      setMessage(
        permission === 'granted' ? 'เปิดการแจ้งเตือนแล้ว' : 'ยังไม่ได้รับอนุญาตแจ้งเตือน',
      );
    } catch {
      setReminders(false);
      setMessageTone('error');
      setMessage('ขอสิทธิ์แจ้งเตือนไม่สำเร็จ กรุณาตรวจการตั้งค่าเบราว์เซอร์');
    }
  };
  const updateTodayGoal = (nextWeight: number, nextActivity: Activity) => {
    if (!today) return;
    const nextGoal = calculateGoal(nextWeight, nextActivity);
    setRecords((current) =>
      current.map((record) =>
        record.date === today ? { ...record, goal: nextGoal } : record,
      ),
    );
  };
  const weeklyData = (() => {
    if (!today) return [];
    const formatter = new Intl.DateTimeFormat('th-TH', { weekday: 'short' });
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(`${today}T12:00:00`);
      date.setDate(date.getDate() - (6 - index));
      const key = isoDate(date);
      const record = records.find((item) => item.date === key);
      const amount =
        record?.logs.reduce((sum, log) => sum + log.amount, 0) ?? 0;
      return {
        date: key,
        day: formatter.format(date).replace('.', ''),
        amount,
        goal: key === today ? goal : (record?.goal ?? goal),
      };
    });
  })();
  const achievedDays = weeklyData.filter(
    (day) => day.amount >= day.goal,
  ).length;
  const weeklyAverage = weeklyData.length
    ? Math.round(
        weeklyData.reduce((sum, day) => sum + day.amount, 0) /
          weeklyData.length,
      )
    : 0;
  const weeklyChartMax = Math.max(
    1000,
    Math.ceil(
      Math.max(...weeklyData.flatMap((day) => [day.amount, day.goal]), goal) /
        1000,
    ) * 1000,
  );
  const weeklyTicks = Array.from(
    { length: weeklyChartMax / 1000 + 1 },
    (_, index) => index * 1000,
  );
  const progressData = [
    {
      name: 'consumed',
      value: Math.min(consumed, goal),
      fill: 'var(--color-consumed)',
    },
    { name: 'remaining', value: remaining, fill: 'var(--color-remaining)' },
  ];

  return (
    <main className="min-h-screen bg-[#F4F7F5] text-[#173B3D]">
      <header className="border-b border-[#DCE8E4] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-[#DDF3EF] text-[#087E8B]">
              <Droplets />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">SipDay</p>
              <p className="text-xs text-[#668183]">จิบน้ำให้ครบทุกวัน</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-[#EEF5F3] px-3 py-2 text-xs font-semibold text-[#517274]">
            <Sparkles className="size-4 text-[#E3923C]" /> วันนี้ {percent}%
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[1.25fr_.75fr] lg:py-9">
        <section className="rounded-[28px] bg-[#073F46] p-6 text-white shadow-[0_18px_50px_rgba(7,63,70,.14)] sm:p-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <p className="text-sm font-semibold text-[#9CD5D2]">เป้าหมายวันนี้</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
                เติมความสดชื่นให้ร่างกาย
              </h1>
              <p className="mt-2 text-sm text-[#B7D8D6]">
                บันทึกทุกแก้ว แล้วค่อย ๆ ไปถึงเป้าหมาย
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
              <p className="text-xs text-[#A9D5D3]">ยังเหลือ</p>
              <p className="text-xl font-bold">
                {formatMl(remaining)}{' '}
                <span className="text-sm font-medium">มล.</span>
              </p>
            </div>
          </div>
          <div className="mt-7 grid items-center gap-7 sm:grid-cols-[260px_1fr]">
            <figure
              className="relative mx-auto size-[240px]"
              aria-label={`ดื่มน้ำแล้ว ${percent}% หรือ ${formatMl(consumed)} จากเป้าหมาย ${formatMl(goal)} มิลลิลิตร`}
            >
              <ChartContainer
                config={progressConfig}
                className="size-full aspect-square"
                initialDimension={{ width: 240, height: 240 }}
              >
                <PieChart>
                  <Pie
                    data={progressData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={82}
                    outerRadius={108}
                    startAngle={90}
                    endAngle={-270}
                    strokeWidth={0}
                  />
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                <strong className="text-4xl">{percent}%</strong>
                <span className="mt-1 text-xs text-[#A9D5D3]">
                  {formatMl(consumed)} / {formatMl(goal)} มล.
                </span>
              </div>
            </figure>
            <div>
              <p className="mb-3 text-sm font-semibold text-[#C8E4E1]">
                ดื่มไปเท่าไรแล้ว?
              </p>
              <div className="grid grid-cols-3 gap-2">
                {quickAmounts.map((amount) => (
                  <Button
                    type="button"
                    key={amount}
                    onClick={() => addDrink(amount)}
                    className="h-14 rounded-2xl bg-white/10 text-white hover:bg-[#138D9A]"
                  >
                    <Plus className="size-4" /> {amount} มล.
                  </Button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  aria-label="ปริมาณน้ำแบบกำหนดเอง"
                  type="number"
                  min={1}
                  max={MAX_DRINK_AMOUNT}
                  step={1}
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                  className="h-11 border-white/20 bg-white/10 text-white placeholder:text-white/50"
                />
                <Button
                  type="button"
                  onClick={() => addDrink(Number(customAmount))}
                  className="h-11 bg-[#F3A84A] px-5 text-[#173B3D] hover:bg-[#FFC46D]"
                >
                  บันทึก
                </Button>
              </div>
              {message && (
                <p
                  aria-live="polite"
                  className="mt-3 flex items-center gap-2 text-sm text-[#B9E3D1]"
                >
                  {messageTone === 'success' ? (
                    <Check className="size-4" />
                  ) : (
                    <AlertCircle className="size-4" />
                  )}{' '}
                  {message}
                </p>
              )}
            </div>
          </div>
        </section>
        <aside className="grid gap-5">
          <section className="rounded-[24px] border border-[#DCE8E4] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Settings2 className="size-5 text-[#138D9A]" />
              <h2 className="font-bold">คำนวณเป้าหมายของคุณ</h2>
            </div>
            <label
              htmlFor="weight"
              className="block text-sm font-medium text-[#537174]"
            >
              น้ำหนักตัว (กก.)
            </label>
            <Input
              id="weight"
              type="number"
              min={30}
              max={250}
              step={0.1}
              value={weight}
              onChange={(event) => {
                const value = event.target.value;
                setWeight(value !== '' && Number(value) > 250 ? '250' : value);
              }}
              onBlur={() => {
                const nextWeight = normalizeWeight(Number(weight));
                setWeight(String(nextWeight));
                updateTodayGoal(nextWeight, activity);
              }}
              className="mt-2 h-11"
            />
            <label
              htmlFor="activity"
              className="mt-4 block text-sm font-medium text-[#537174]"
            >
              กิจกรรมวันนี้
            </label>
            <NativeSelect
              id="activity"
              value={activity}
              onChange={(event) => {
                const nextActivity = isActivity(event.target.value)
                  ? event.target.value
                  : 'medium';
                setActivity(nextActivity);
                updateTodayGoal(normalizedWeight, nextActivity);
              }}
              className="mt-2 w-full"
            >
              <NativeSelectOption value="low">
                {activityLabel.low}
              </NativeSelectOption>
              <NativeSelectOption value="medium">
                {activityLabel.medium}
              </NativeSelectOption>
              <NativeSelectOption value="high">
                {activityLabel.high}
              </NativeSelectOption>
            </NativeSelect>
            <div className="mt-5 rounded-2xl bg-[#EDF7F5] p-4">
              <p className="text-xs text-[#648083]">เป้าหมายแนะนำโดยประมาณ</p>
              <p className="mt-1 text-2xl font-bold text-[#087E8B]">
                {formatMl(goal)} มล.{' '}
                <span className="text-sm font-medium">/ วัน</span>
              </p>
              <p className="mt-2 text-[11px] leading-5 text-[#738C8E]">
                คำนวณจากน้ำหนัก × 35 มล. + กิจกรรม ค่านี้ใช้ติดตามทั่วไป ไม่แทนคำแนะนำแพทย์
              </p>
            </div>
          </section>
          <section className="rounded-[24px] border border-[#DCE8E4] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-3">
                {reminders ? (
                  <BellRing className="mt-0.5 size-5 text-[#E3923C]" />
                ) : (
                  <Bell className="mt-0.5 size-5 text-[#7A9294]" />
                )}
                <div>
                  <h2 className="font-bold">เตือนให้จิบน้ำ</h2>
                  <p className="mt-1 text-xs leading-5 text-[#6E8587]">
                    ตรวจทุก 5 นาทีและเตือนไม่เกินชั่วโมงละครั้ง ช่วง 08:00–21:00
                    เมื่อดื่มช้ากว่าเป้าหมาย โดยต้องเปิดเว็บนี้ไว้
                  </p>
                </div>
              </div>
              <Switch
                checked={reminders}
                onCheckedChange={toggleReminder}
                aria-label="เปิดหรือปิดการแจ้งเตือน"
              />
            </div>
          </section>
        </aside>
        {storageWarning && (
          <p
            role="alert"
            className="rounded-2xl border border-[#E7C284] bg-[#FFF7E8] px-4 py-3 text-sm text-[#805C22] lg:col-span-2"
          >
            {storageWarning}
          </p>
        )}
        <section className="rounded-[28px] border border-[#DCE8E4] bg-white p-5 shadow-sm sm:p-7 lg:col-span-2">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold text-[#138D9A]">7 วันที่ผ่านมา</p>
              <h2 className="mt-1 text-2xl font-bold">สรุปการดื่มน้ำรายสัปดาห์</h2>
            </div>
            <div className="flex gap-6 text-sm">
              <p>
                <span className="block text-xs text-[#71888A]">เฉลี่ยต่อวัน</span>
                <strong>{formatMl(weeklyAverage)} มล.</strong>
              </p>
              <p>
                <span className="block text-xs text-[#71888A]">ถึงเป้าหมาย</span>
                <strong>{achievedDays} / 7 วัน</strong>
              </p>
            </div>
          </div>
          <ChartContainer
            config={weeklyConfig}
            className="mt-6 h-[260px] w-full aspect-auto"
            initialDimension={{ width: 760, height: 260 }}
            aria-label="กราฟแท่งปริมาณน้ำย้อนหลัง 7 วัน"
          >
            <BarChart
              data={weeklyData}
              margin={{ left: -18, right: 8, top: 10 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="4 4" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis
                domain={[0, weeklyChartMax]}
                ticks={weeklyTicks}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value / 1000} ล.`}
              />
              <ChartTooltip
                cursor={{ fill: '#EEF5F3' }}
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <span className="font-semibold">
                        {formatMl(Number(value))} มล.
                      </span>
                    )}
                  />
                }
              />
              <Bar
                dataKey="amount"
                fill="var(--color-amount)"
                radius={[8, 8, 4, 4]}
                maxBarSize={46}
              />
            </BarChart>
          </ChartContainer>
          <p className="mt-2 text-center text-xs text-[#7A9092]">
            ข้อมูลบันทึกอยู่ในอุปกรณ์นี้ และจะแสดงย้อนหลังอัตโนมัติเมื่อใช้งานครบแต่ละวัน
          </p>
        </section>
      </div>
    </main>
  );
}
