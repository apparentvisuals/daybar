import { browser } from '$app/environment';

const STORAGE_KEY = 'daybar-config';
const COMPLETIONS_STORAGE_KEY = 'daybar-completions';

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

// Completions are stored by date string (YYYY-MM-DD) -> day of week -> period index
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

function loadFromStorage(): WeekConfig | null {
  if (!browser) return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as WeekConfig;
    }
  } catch (e) {
    console.error('Failed to load config from localStorage:', e);
  }
  return null;
}

function saveToStorage(config: WeekConfig): void {
  if (!browser) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save config to localStorage:', e);
  }
}

function loadCompletionsFromStorage(): DateCompletions {
  if (!browser) return {};

  try {
    const stored = localStorage.getItem(COMPLETIONS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as DateCompletions;
    }
  } catch (e) {
    console.error('Failed to load completions from localStorage:', e);
  }
  return {};
}

function saveCompletionsToStorage(completions: DateCompletions): void {
  if (!browser) return;

  try {
    localStorage.setItem(COMPLETIONS_STORAGE_KEY, JSON.stringify(completions));
  } catch (e) {
    console.error('Failed to save completions to localStorage:', e);
  }
}

function getCurrentDayOfWeek(): DayOfWeek {
  return DAYS_OF_WEEK[new Date().getDay()];
}

class ConfigStore {
  weekConfig = $state<WeekConfig>(createDefaultWeekConfig());
  completions = $state<DateCompletions>({});
  selectedDay = $state<DayOfWeek>(getCurrentDayOfWeek());

  constructor() {
    if (browser) {
      const stored = loadFromStorage();
      if (stored) {
        this.weekConfig = stored;
      }
      this.completions = loadCompletionsFromStorage();
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

  updateDayConfig(day: DayOfWeek, updates: Partial<DayConfig>): void {
    this.weekConfig[day] = { ...this.weekConfig[day], ...updates };
    this.save();
  }

  setStartTime(time: Time): void {
    this.weekConfig[this.selectedDay].startTime = time;
    this.save();
  }

  setEndTime(time: Time): void {
    this.weekConfig[this.selectedDay].endTime = time;
    this.save();
  }

  setUseCustomRange(value: boolean): void {
    this.weekConfig[this.selectedDay].useCustomRange = value;
    this.save();
  }

  setEnabled(value: boolean): void {
    this.weekConfig[this.selectedDay].enabled = value;
    this.save();
  }

  addBusyPeriod(period: BusyPeriod): void {
    this.weekConfig[this.selectedDay].busyPeriods.push(period);
    this.save();
  }

  updateBusyPeriod(index: number, period: BusyPeriod): void {
    this.weekConfig[this.selectedDay].busyPeriods[index] = period;
    this.save();
  }

  removeBusyPeriod(index: number): void {
    this.weekConfig[this.selectedDay].busyPeriods.splice(index, 1);
    this.save();
  }

  toggleBusyPeriodCompleted(periodIndex: number, currentTime: Time, date: Date = new Date()): void {
    const dateStr = getDateString(date);
    const dayOfWeek = DAYS_OF_WEEK[date.getDay()];
    const period = this.weekConfig[dayOfWeek].busyPeriods[periodIndex];

    if (!this.completions[dateStr]) {
      this.completions[dateStr] = {};
    }

    if (this.completions[dateStr][periodIndex]) {
      // Uncomplete - remove the completion
      delete this.completions[dateStr][periodIndex];
      // Clean up empty date entries
      if (Object.keys(this.completions[dateStr]).length === 0) {
        delete this.completions[dateStr];
      }
    } else {
      // Complete - add the completion with time
      // For floating periods, use end time (current time + duration)
      let completionTime = currentTime;
      if (period?.floating && period.duration) {
        completionTime = addTimes(currentTime, period.duration);
      }
      this.completions[dateStr][periodIndex] = {
        completedAt: completionTime,
      };
    }

    this.saveCompletions();
  }

  selectDay(day: DayOfWeek): void {
    this.selectedDay = day;
  }

  save(): void {
    saveToStorage(this.weekConfig);
  }

  saveCompletions(): void {
    saveCompletionsToStorage(this.completions);
  }

  reset(): void {
    this.weekConfig = createDefaultWeekConfig();
    this.completions = {};
    this.save();
    this.saveCompletions();
  }
}

export const configStore = new ConfigStore();
