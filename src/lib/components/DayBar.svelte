<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  import { timeToDecimal, addTimes, type Time, type BusyPeriod, type DailyCompletions } from '$lib/config.svelte.js';

  let {
    startTime = { hour: 0, minute: 0 },
    endTime = { hour: 24, minute: 0 },
    busyPeriods = [],
    completions = {},
  }: {
    startTime?: Time;
    endTime?: Time;
    busyPeriods?: BusyPeriod[];
    completions?: DailyCompletions;
  } = $props();

  let currentTime = $state(new Date());

  // Update current time every second
  $effect(() => {
    const interval = setInterval(() => {
      currentTime = new Date();
    }, 1000);

    return () => clearInterval(interval);
  });

  // Convert Time to decimal for calculations
  let startDecimal = $derived.by(() => timeToDecimal(startTime));
  let endDecimal = $derived.by(() => timeToDecimal(endTime));

  // Calculate progress percentage
  let progress = $derived.by(() => {
    const now = currentTime;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startTime.hour * 60 + startTime.minute;
    const endMinutes = endTime.hour * 60 + endTime.minute;
    const totalMinutes = endMinutes - startMinutes;

    if (currentMinutes < startMinutes) return 0;
    if (currentMinutes > endMinutes) return 100;

    return ((currentMinutes - startMinutes) / totalMinutes) * 100;
  });

  // Get current time as decimal hours
  let currentHourDecimal = $derived.by(() => {
    return currentTime.getHours() + currentTime.getMinutes() / 60;
  });

  // Helper to check if a period is completed
  function isCompleted(index: number): boolean {
    return completions[index] !== undefined;
  }

  // Helper to get completion time
  function getCompletionTime(index: number): Time | undefined {
    return completions[index]?.completedAt;
  }

  // Get fixed busy periods (non-floating, non-completed)
  let fixedBusyPeriods = $derived.by(() => {
    return busyPeriods
      .map((p, index) => ({ period: p, index }))
      .filter(({ period, index }) => !period.floating && !isCompleted(index))
      .map(({ period }) => {
        const start = period.start ? timeToDecimal(period.start) : 0;
        const end = period.end
          ? timeToDecimal(period.end)
          : period.start && period.duration
            ? timeToDecimal(addTimes(period.start, period.duration))
            : start;
        return { start, end };
      })
      .sort((a, b) => a.start - b.start);
  });

  // Get active floating periods (non-completed)
  let activeFloatingPeriods = $derived.by(() => {
    return busyPeriods
      .map((p, index) => ({ period: p, index }))
      .filter(({ period, index }) => period.floating && !isCompleted(index));
  });

  // Calculate positions for all floating periods, avoiding overlaps with fixed and each other
  let floatingPositions = $derived.by(() => {
    const fixed = fixedBusyPeriods;
    const floating = activeFloatingPeriods;
    const positions = new SvelteMap<number, number>();
    const placedPeriods: { start: number; end: number }[] = [];

    const obstacles = [...fixed];

    for (let i = 0; i < floating.length; i++) {
      const { period, index } = floating[i];
      const durationDecimal = period.duration ? timeToDecimal(period.duration) : 0;
      let start = currentHourDecimal;
      let end = start + durationDecimal;

      const allObstacles = [...obstacles, ...placedPeriods].sort((a, b) => a.start - b.start);

      let foundPosition = false;
      while (!foundPosition) {
        foundPosition = true;
        for (const obstacle of allObstacles) {
          if (start < obstacle.end && end > obstacle.start) {
            start = obstacle.end;
            end = start + durationDecimal;
            foundPosition = false;
            break;
          }
        }
      }

      positions.set(index, start);
      placedPeriods.push({ start, end });
    }

    return positions;
  });

  // Normalize busy periods for rendering
  let normalizedBusyPeriods = $derived.by(() => {
    const totalHours = endDecimal - startDecimal;
    const positions = floatingPositions;

    return busyPeriods.map((period, index) => {
      let start: number, end: number;
      const completed = isCompleted(index);

      if (period.floating && !completed) {
        // Use start time if current time is before start time
        const floatingStart = positions.get(index) ?? currentHourDecimal;
        start = Math.max(floatingStart, startDecimal);
        const durationDecimal = period.duration ? timeToDecimal(period.duration) : 0;
        end = start + durationDecimal;
      } else if (period.floating && completed) {
        // completionTime is the end time for floating periods
        const completionTime = getCompletionTime(index);
        const durationDecimal = period.duration ? timeToDecimal(period.duration) : 0;
        end = completionTime ? timeToDecimal(completionTime) : startDecimal + durationDecimal;
        start = end - durationDecimal;
      } else {
        start = period.start ? timeToDecimal(period.start) : 0;
        end = period.end
          ? timeToDecimal(period.end)
          : period.start && period.duration
            ? timeToDecimal(addTimes(period.start, period.duration))
            : start;
      }

      const left = ((start - startDecimal) / totalHours) * 100;
      const width = ((end - start) / totalHours) * 100;
      const atStart = left <= 0;
      const atEnd = left + width >= 100;

      return {
        left,
        width,
        completed,
        floating: period.floating ?? false,
        atStart,
        atEnd,
        color: period.color,
      };
    });
  });

  // Generate hour markers
  let hourMarkers = $derived.by(() => {
    const markers = [];
    const totalHours = endDecimal - startDecimal;
    const startH = Math.ceil(startDecimal);
    const endH = Math.floor(endDecimal);

    for (let h = startH; h <= endH; h++) {
      const position = ((h - startDecimal) / totalHours) * 100;
      markers.push({ hour: h, position });
    }

    return markers;
  });

  // Format time display
  let currentTimeDisplay = $derived.by(() => {
    return currentTime.toLocaleTimeString('en-CA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  });

  // Format date display
  let currentDateDisplay = $derived.by(() => {
    return currentTime.toLocaleDateString('en-CA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });

  function formatHour(hour: number) {
    return `${hour.toString().padStart(2, '0')}:00`;
  }
</script>

<div class="day-bar-container">
  <div class="date-display text-foreground">{currentDateDisplay}</div>
  <div class="time-display text-foreground">{currentTimeDisplay}</div>

  <div class="bar-wrapper">
    <div class="timeline-bar">
      <!-- Past time (dashed) -->
      <div class="past-section" style="width: {progress}%;">
        <!-- <div class="dashed-overlay"></div> -->
      </div>

      <!-- Future time (solid) -->
      <div class="future-section" style="width: {100 - progress}%; left: {progress}%;"></div>

      <!-- Busy time sections -->
      {#each normalizedBusyPeriods as period, i (i)}
        <div
          class="busy-section"
          class:completed={period.completed}
          class:floating={period.floating && !period.completed}
          style:left="{period.left}%"
          style:width="{period.width}%"
          style:background-color={!period.floating && !period.completed && period.color ? period.color : null}
        ></div>
      {/each}

      <!-- Current time indicator -->
      {#if progress > 0 && progress < 100}
        <div class="current-indicator" style="left: {progress}%">
          <div class="indicator-line"></div>
        </div>
      {/if}
    </div>

    <!-- Hour markers -->
    {#each hourMarkers as marker (marker.hour)}
      <div class="hour-marker" style="left: {marker.position}%">
        <div class="marker-line bg-foreground"></div>
        <span class="marker-label text-foreground">{formatHour(marker.hour)}</span>
      </div>
    {/each}
  </div>

  <div class="legend">
    <div class="legend-item text-foreground">
      <div class="legend-swatch past"></div>
      <span>Past</span>
    </div>
    <div class="legend-item text-foreground">
      <div class="legend-swatch future"></div>
      <span>Free</span>
    </div>
  </div>
</div>

<style lang="postcss">
  /*.day-bar-container {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    padding: 2rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }*/

  .date-display {
    text-align: center;
    font-size: 1.25rem;
    /*color: #a0a0a0;*/
    margin-bottom: 0.5rem;
  }

  .time-display {
    text-align: center;
    font-size: 3rem;
    font-weight: 200;
    /*color: #fff;*/
    margin-bottom: 2rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 2px;
  }

  .bar-wrapper {
    position: relative;
    /*padding: 0 1rem;*/
    margin-bottom: 1.5rem;
  }

  .timeline-bar {
    position: relative;
    height: 60px;
    /*background: rgba(0, 0, 0, 0.3);*/
    border-radius: 5px;
    overflow: hidden;
    /*border: 1px solid rgba(255, 255, 255, 0.1);*/
  }

  .past-section {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: #4a4a6a; /*linear-gradient(90deg, #4a4a6a 0%, #5a5a7a 100%);*/
    /*border-radius: 30px 0 0 30px;*/
    overflow: hidden;
  }

  /*.dashed-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      90deg,
      transparent,
      transparent 8px,
      rgba(0, 0, 0, 0.4) 8px,
      rgba(0, 0, 0, 0.4) 16px
    );
  }*/

  .future-section {
    position: absolute;
    top: 0;
    height: 100%;
    background: #6366f1; /*linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);*/
    /*border-radius: 0 30px 30px 0;*/
  }

  .busy-section {
    position: absolute;
    top: 0;
    height: 100%;
    background: rgba(239, 68, 68, 0.7);
    z-index: 5;
  }

  .busy-section.completed {
    background: rgba(34, 197, 94, 0.7);
  }

  .busy-section.floating {
    background: rgba(251, 191, 36, 0.7);
  }

  .current-indicator {
    position: absolute;
    top: -10px;
    bottom: -10px;
    transform: translateX(-50%);
    z-index: 10;
  }

  .indicator-line {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 3px;
    height: 100%;
    background: #fff;
    border-radius: 2px;
  }

  .hour-marker {
    position: absolute;
    top: 100%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 8px;
  }

  .marker-line {
    width: 1px;
    height: 12px;
    /*background: rgba(255, 255, 255, 0.3);*/
  }

  /*.hour-marker.past .marker-line {
    background: rgba(255, 255, 255, 0.15);
  }*/

  .marker-label {
    font-size: 0.7rem;
    /*color: rgba(255, 255, 255, 0.5);*/
    margin-top: 4px;
    white-space: nowrap;
  }

  /*.hour-marker.past .marker-label {
    color: rgba(255, 255, 255, 0.3);
  }*/

  .legend {
    display: flex;
    justify-content: center;
    gap: 2rem;
    margin-top: 3rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    /*color: #a0a0a0;*/
  }

  .legend-swatch {
    width: 24px;
    height: 12px;
    border-radius: 3px;
  }

  .legend-swatch.past {
    background: #4a4a6a; /*linear-gradient(90deg, #4a4a6a 0%, #5a5a7a 100%);*/
    /*background-image: repeating-linear-gradient(90deg, #5a5a7a, #5a5a7a 4px, #3a3a5a 4px, #3a3a5a 8px);*/
  }

  .legend-swatch.future {
    background: #6366f1; /*linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);*/
  }
</style>
