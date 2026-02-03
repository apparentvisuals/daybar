import { PGlite } from '@electric-sql/pglite';
import { browser } from '$app/environment';

let db: PGlite | null = null;
let initPromise: Promise<PGlite> | null = null;

const SCHEMA = `
-- Week configuration for each day
CREATE TABLE IF NOT EXISTS day_config (
  day_of_week TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  start_hour INTEGER NOT NULL DEFAULT 6,
  start_minute INTEGER NOT NULL DEFAULT 0,
  end_hour INTEGER NOT NULL DEFAULT 22,
  end_minute INTEGER NOT NULL DEFAULT 0,
  use_custom_range BOOLEAN NOT NULL DEFAULT false
);

-- Busy periods for each day
CREATE TABLE IF NOT EXISTS busy_periods (
  id SERIAL PRIMARY KEY,
  day_of_week TEXT NOT NULL REFERENCES day_config(day_of_week) ON DELETE CASCADE,
  title TEXT,
  start_hour INTEGER,
  start_minute INTEGER,
  end_hour INTEGER,
  end_minute INTEGER,
  duration_hour INTEGER,
  duration_minute INTEGER,
  floating BOOLEAN DEFAULT false,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Completions tracked by date and period index
CREATE TABLE IF NOT EXISTS completions (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  period_index INTEGER NOT NULL,
  completed_at_hour INTEGER NOT NULL,
  completed_at_minute INTEGER NOT NULL,
  UNIQUE(date, period_index)
);

-- Migration tracking
CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

async function initSchema(database: PGlite): Promise<void> {
  await database.exec(SCHEMA);

  // Insert default day configs if they don't exist
  for (const day of DAYS_OF_WEEK) {
    await database.query(`INSERT INTO day_config (day_of_week) VALUES ($1) ON CONFLICT (day_of_week) DO NOTHING`, [
      day,
    ]);
  }
}

async function migrateFromLocalStorage(database: PGlite): Promise<void> {
  // Check if migration already done
  const migrationCheck = await database.query<{ id: string }>(`SELECT id FROM migrations WHERE id = 'localStorage_v1'`);

  if (migrationCheck.rows.length > 0) {
    return; // Already migrated
  }

  // Try to get localStorage data
  const configStr = localStorage.getItem('daybar-config');
  const completionsStr = localStorage.getItem('daybar-completions');

  if (configStr) {
    try {
      const config = JSON.parse(configStr) as Record<
        string,
        {
          enabled: boolean;
          startTime: { hour: number; minute: number };
          endTime: { hour: number; minute: number };
          useCustomRange: boolean;
          busyPeriods: Array<{
            title?: string;
            start?: { hour: number; minute: number };
            end?: { hour: number; minute: number };
            duration?: { hour: number; minute: number };
            floating?: boolean;
            color?: string;
          }>;
        }
      >;

      for (const [day, dayConfig] of Object.entries(config)) {
        // Update day config
        await database.query(
          `UPDATE day_config SET
            enabled = $1,
            start_hour = $2,
            start_minute = $3,
            end_hour = $4,
            end_minute = $5,
            use_custom_range = $6
          WHERE day_of_week = $7`,
          [
            dayConfig.enabled,
            dayConfig.startTime.hour,
            dayConfig.startTime.minute,
            dayConfig.endTime.hour,
            dayConfig.endTime.minute,
            dayConfig.useCustomRange,
            day,
          ],
        );

        // Insert busy periods
        for (let i = 0; i < dayConfig.busyPeriods.length; i++) {
          const period = dayConfig.busyPeriods[i];
          await database.query(
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
    } catch (e) {
      console.error('Failed to migrate config from localStorage:', e);
    }
  }

  if (completionsStr) {
    try {
      const completions = JSON.parse(completionsStr) as Record<
        string,
        Record<number, { completedAt: { hour: number; minute: number } }>
      >;

      for (const [date, dayCompletions] of Object.entries(completions)) {
        for (const [periodIndex, completion] of Object.entries(dayCompletions)) {
          await database.query(
            `INSERT INTO completions (date, period_index, completed_at_hour, completed_at_minute)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (date, period_index) DO NOTHING`,
            [date, parseInt(periodIndex), completion.completedAt.hour, completion.completedAt.minute],
          );
        }
      }
    } catch (e) {
      console.error('Failed to migrate completions from localStorage:', e);
    }
  }

  // Mark migration as complete
  await database.query(`INSERT INTO migrations (id) VALUES ('localStorage_v1')`);

  // Clear localStorage after successful migration
  localStorage.removeItem('daybar-config');
  localStorage.removeItem('daybar-completions');

  console.log('Successfully migrated from localStorage to PGlite');
}

export async function getDb(): Promise<PGlite> {
  if (!browser) {
    throw new Error('PGlite can only be used in the browser');
  }

  if (db) {
    return db;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const database = new PGlite('idb://daybar', {
      relaxedDurability: true,
    });

    await initSchema(database);
    await migrateFromLocalStorage(database);

    db = database;
    return database;
  })();

  return initPromise;
}

export function isDbReady(): boolean {
  return db !== null;
}
