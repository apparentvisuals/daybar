import { browser } from '$app/environment';
import { getDb } from './db';

export type Time = {
  hour: number;
  minute: number;
};

export type BusyPeriod = {
  title?: string;
  start?: Time;
  end?: Time;
  duration?: Time;
  floating?: boolean;
  color?: string;
};

export type Completion = {
  completedAt: Time;
};

export type DailyCompletions = Record<number, Completion>;
export type DateCompletions = Record<string, DailyCompletions>;

export type DayConfig = {
  enabled: boolean;
  startTime: Time;
  endTime: Time;
  useCustomRange: boolean;
  busyPeriods: BusyPeriod[];
};

export type DayOfWeek = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

export const DAYS_OF_WEEK: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
};

export type WeekConfig = Record<DayOfWeek, DayConfig>;

// Helper functions for Time conversion
export function timeToDecimal(time: Time): number {
  return time.hour + time.minute / 60;
}

export function decimalToTime(decimal: number): Time {
  const hour = Math.floor(decimal);
  const minute = Math.round((decimal - hour) * 60);
  return { hour, minute };
}

export function formatTime(time: Time): string {
  return `${time.hour.toString().padStart(2, '0')}:${time.minute.toString().padStart(2, '0')}`;
}

export function addTimes(base: Time, duration: Time): Time {
  let totalMinutes = base.hour * 60 + base.minute + duration.hour * 60 + duration.minute;
  return {
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
  };
}

export function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

function createDefaultDayConfig(): DayConfig {
  return {
    enabled: true,
    startTime: { hour: 6, minute: 0 },
    endTime: { hour: 22, minute: 0 },
    useCustomRange: false,
    busyPeriods: [],
  };
}

function createDefaultWeekConfig(): WeekConfig {
  return {
    sunday: createDefaultDayConfig(),
    monday: createDefaultDayConfig(),
    tuesday: createDefaultDayConfig(),
    wednesday: createDefaultDayConfig(),
    thursday: createDefaultDayConfig(),
    friday: createDefaultDayConfig(),
    saturday: createDefaultDayConfig(),
  };
}

function getCurrentDayOfWeek(): DayOfWeek {
  return DAYS_OF_WEEK[new Date().getDay()];
}

type DayConfigRow = {
  day_of_week: string;
  enabled: boolean;
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
  use_custom_range: boolean;
};

type BusyPeriodRow = {
  id: number;
  day_of_week: string;
  title: string | null;
  start_hour: number | null;
  start_minute: number | null;
  end_hour: number | null;
  end_minute: number | null;
  duration_hour: number | null;
  duration_minute: number | null;
  floating: boolean;
  color: string | null;
  sort_order: number;
};

type CompletionRow = {
  date: string;
  period_index: number;
  completed_at_hour: number;
  completed_at_minute: number;
};

class ConfigStore {
  weekConfig = $state<WeekConfig>(createDefaultWeekConfig());
  completions = $state<DateCompletions>({});
  selectedDay = $state<DayOfWeek>(getCurrentDayOfWeek());
  ready = $state<boolean>(false);
  #initPromise: Promise<void> | null = null;

  constructor() {
    if (browser) {
      this.#initPromise = this.init();
    }
  }

  async init(): Promise<void> {
    if (!browser) return;

    try {
      const db = await getDb();

      // Load day configs
      const dayConfigResult = await db.query<DayConfigRow>(`SELECT * FROM day_config`);

      for (const row of dayConfigResult.rows) {
        const day = row.day_of_week as DayOfWeek;
        this.weekConfig[day] = {
          enabled: row.enabled,
          startTime: { hour: row.start_hour, minute: row.start_minute },
          endTime: { hour: row.end_hour, minute: row.end_minute },
          useCustomRange: row.use_custom_range,
          busyPeriods: [],
        };
      }

      // Load busy periods
      const busyPeriodsResult = await db.query<BusyPeriodRow>(
        `SELECT * FROM busy_periods ORDER BY day_of_week, sort_order`,
      );

      for (const row of busyPeriodsResult.rows) {
        const day = row.day_of_week as DayOfWeek;
        const period: BusyPeriod = {
          floating: row.floating,
        };

        if (row.title) period.title = row.title;
        if (row.start_hour !== null && row.start_minute !== null) {
          period.start = { hour: row.start_hour, minute: row.start_minute };
        }
        if (row.end_hour !== null && row.end_minute !== null) {
          period.end = { hour: row.end_hour, minute: row.end_minute };
        }
        if (row.duration_hour !== null && row.duration_minute !== null) {
          period.duration = { hour: row.duration_hour, minute: row.duration_minute };
        }
        if (row.color) period.color = row.color;

        this.weekConfig[day].busyPeriods.push(period);
      }

      // Load completions
      const completionsResult = await db.query<CompletionRow>(`SELECT * FROM completions`);

      for (const row of completionsResult.rows) {
        if (!this.completions[row.date]) {
          this.completions[row.date] = {};
        }
        this.completions[row.date][row.period_index] = {
          completedAt: { hour: row.completed_at_hour, minute: row.completed_at_minute },
        };
      }

      this.ready = true;
    } catch (e) {
      console.error('Failed to initialize config store:', e);
      this.ready = true; // Still mark ready so UI doesn't hang
    }
  }

  async waitForReady(): Promise<void> {
    if (this.#initPromise) {
      await this.#initPromise;
    }
  }

  get currentDayConfig(): DayConfig {
    return this.weekConfig[this.selectedDay];
  }

  get todayConfig(): DayConfig {
    return this.weekConfig[getCurrentDayOfWeek()];
  }

  getTodayCompletions(): DailyCompletions {
    const dateStr = getDateString();
    return this.completions[dateStr] ?? {};
  }

  getCompletionsForDate(date: Date): DailyCompletions {
    const dateStr = getDateString(date);
    return this.completions[dateStr] ?? {};
  }

  isCompleted(periodIndex: number, date: Date = new Date()): boolean {
    const dateStr = getDateString(date);
    return this.completions[dateStr]?.[periodIndex] !== undefined;
  }

  getCompletionTime(periodIndex: number, date: Date = new Date()): Time | undefined {
    const dateStr = getDateString(date);
    return this.completions[dateStr]?.[periodIndex]?.completedAt;
  }

  async updateDayConfig(day: DayOfWeek, updates: Partial<DayConfig>): Promise<void> {
    this.weekConfig[day] = { ...this.weekConfig[day], ...updates };
    await this.saveDayConfig(day);
  }

  async setStartTime(time: Time): Promise<void> {
    this.weekConfig[this.selectedDay].startTime = time;
    await this.saveDayConfig(this.selectedDay);
  }

  async setEndTime(time: Time): Promise<void> {
    this.weekConfig[this.selectedDay].endTime = time;
    await this.saveDayConfig(this.selectedDay);
  }

  async setUseCustomRange(value: boolean): Promise<void> {
    this.weekConfig[this.selectedDay].useCustomRange = value;
    await this.saveDayConfig(this.selectedDay);
  }

  async setEnabled(value: boolean): Promise<void> {
    this.weekConfig[this.selectedDay].enabled = value;
    await this.saveDayConfig(this.selectedDay);
  }

  async addBusyPeriod(period: BusyPeriod): Promise<void> {
    this.weekConfig[this.selectedDay].busyPeriods.push(period);
    await this.saveBusyPeriods(this.selectedDay);
  }

  async updateBusyPeriod(index: number, period: BusyPeriod): Promise<void> {
    this.weekConfig[this.selectedDay].busyPeriods[index] = period;
    await this.saveBusyPeriods(this.selectedDay);
  }

  async removeBusyPeriod(index: number): Promise<void> {
    this.weekConfig[this.selectedDay].busyPeriods.splice(index, 1);
    await this.saveBusyPeriods(this.selectedDay);
  }

  async toggleBusyPeriodCompleted(periodIndex: number, currentTime: Time, date: Date = new Date()): Promise<void> {
    const dateStr = getDateString(date);
    const dayOfWeek = DAYS_OF_WEEK[date.getDay()];
    const period = this.weekConfig[dayOfWeek].busyPeriods[periodIndex];

    if (!this.completions[dateStr]) {
      this.completions[dateStr] = {};
    }

    const db = await getDb();

    if (this.completions[dateStr][periodIndex]) {
      // Uncomplete - remove the completion
      delete this.completions[dateStr][periodIndex];
      if (Object.keys(this.completions[dateStr]).length === 0) {
        delete this.completions[dateStr];
      }

      await db.query(`DELETE FROM completions WHERE date = $1 AND period_index = $2`, [dateStr, periodIndex]);
    } else {
      // Complete - add the completion with time
      let completionTime = currentTime;
      if (period?.floating && period.duration) {
        completionTime = addTimes(currentTime, period.duration);
      }
      this.completions[dateStr][periodIndex] = {
        completedAt: completionTime,
      };

      await db.query(
        `INSERT INTO completions (date, period_index, completed_at_hour, completed_at_minute)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (date, period_index) DO UPDATE SET
           completed_at_hour = EXCLUDED.completed_at_hour,
           completed_at_minute = EXCLUDED.completed_at_minute`,
        [dateStr, periodIndex, completionTime.hour, completionTime.minute],
      );
    }
  }

  selectDay(day: DayOfWeek): void {
    this.selectedDay = day;
  }

  private async saveDayConfig(day: DayOfWeek): Promise<void> {
    if (!browser) return;

    const config = this.weekConfig[day];
    const db = await getDb();

    await db.query(
      `UPDATE day_config SET
        enabled = $1,
        start_hour = $2,
        start_minute = $3,
        end_hour = $4,
        end_minute = $5,
        use_custom_range = $6
      WHERE day_of_week = $7`,
      [
        config.enabled,
        config.startTime.hour,
        config.startTime.minute,
        config.endTime.hour,
        config.endTime.minute,
        config.useCustomRange,
        day,
      ],
    );
  }

  private async saveBusyPeriods(day: DayOfWeek): Promise<void> {
    if (!browser) return;

    const db = await getDb();
    const periods = this.weekConfig[day].busyPeriods;

    // Delete existing periods for this day
    await db.query(`DELETE FROM busy_periods WHERE day_of_week = $1`, [day]);

    // Insert all periods with their sort order
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      await db.query(
        `INSERT INTO busy_periods (
          day_of_week, title, start_hour, start_minute, end_hour, end_minute,
          duration_hour, duration_minute, floating, color, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          day,
          period.title ?? null,
          period.start?.hour ?? null,
          period.start?.minute ?? null,
          period.end?.hour ?? null,
          period.end?.minute ?? null,
          period.duration?.hour ?? null,
          period.duration?.minute ?? null,
          period.floating ?? false,
          period.color ?? null,
          i,
        ],
      );
    }
  }

  async reset(): Promise<void> {
    this.weekConfig = createDefaultWeekConfig();
    this.completions = {};

    if (!browser) return;

    const db = await getDb();

    // Reset day configs to defaults
    for (const day of DAYS_OF_WEEK) {
      await db.query(
        `UPDATE day_config SET
          enabled = true,
          start_hour = 6,
          start_minute = 0,
          end_hour = 22,
          end_minute = 0,
          use_custom_range = false
        WHERE day_of_week = $1`,
        [day],
      );
    }

    // Delete all busy periods and completions
    await db.query(`DELETE FROM busy_periods`);
    await db.query(`DELETE FROM completions`);
  }
}

export const configStore = new ConfigStore();
