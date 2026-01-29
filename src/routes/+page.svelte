<script lang="ts">
  import { resolve } from '$app/paths';
  import { Button } from '$lib/components/ui/button/index.js';

  import DayBar from '$lib/components/DayBar.svelte';
  import { configStore, formatTime, addTimes, type Time } from '$lib/config.svelte.js';

  function getCurrentTime(): Time {
    const now = new Date();
    return { hour: now.getHours(), minute: now.getMinutes() };
  }

  function toggleCompleted(index: number) {
    configStore.toggleBusyPeriodCompleted(index, getCurrentTime());
  }

  function isCompleted(index: number): boolean {
    return configStore.isCompleted(index);
  }

  function formatPeriodTime(period: { start?: Time; end?: Time; duration?: Time; floating?: boolean }): string {
    if (period.floating) {
      const dur = period.duration ?? { hour: 0, minute: 0 };
      if (dur.hour > 0 && dur.minute > 0) {
        return `${dur.hour}h ${dur.minute}m`;
      } else if (dur.hour > 0) {
        return `${dur.hour}h`;
      } else {
        return `${dur.minute}m`;
      }
    }
    const start = period.start ?? { hour: 0, minute: 0 };
    const end = period.end ?? addTimes(start, period.duration ?? { hour: 0, minute: 0 });
    return `${formatTime(start)} - ${formatTime(end)}`;
  }
</script>

<main>
  {#if configStore.todayConfig.enabled}
    <DayBar
      startTime={configStore.todayConfig.useCustomRange ? configStore.todayConfig.startTime : { hour: 0, minute: 0 }}
      endTime={configStore.todayConfig.useCustomRange ? configStore.todayConfig.endTime : { hour: 24, minute: 0 }}
      busyPeriods={configStore.todayConfig.busyPeriods}
      completions={configStore.getTodayCompletions()}
    />

    {#if configStore.todayConfig.busyPeriods.length > 0}
      <div class="busy-list">
        {#each configStore.todayConfig.busyPeriods as period, index (index)}
          {@const completed = isCompleted(index)}
          <div
            class="busy-item"
            class:completed
            class:floating={period.floating && !completed}
            style:background-color={!period.floating && !completed && period.color ? period.color : null}
          >
            {#if period.floating}
              <input type="checkbox" checked={completed} onchange={() => toggleCompleted(index)} />
            {/if}
            <span class="text-foreground" class:strikethrough={completed}>
              {#if period.title}<strong>{period.title}</strong> &mdash;
              {/if}
              {formatPeriodTime(period)}
              {#if period.floating && !completed}
                <span class="floating-tag">task</span>
              {/if}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="disabled-message">
      <p>Today is disabled in your configuration.</p>
    </div>
  {/if}

  <div class="flex justify-center">
    <Button variant="link" href={resolve('/config')}>Configure</Button>
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'Segoe UI', system-ui, sans-serif;
    /*background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);*/
    min-height: 100vh;
    color: #e0e0e0;
    display: flex;
    justify-content: center;
  }

  main {
    width: 100%;
    max-width: 1400px;
    padding: 2rem;
    box-sizing: border-box;
  }

  .disabled-message {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 3rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
  }

  .disabled-message p {
    margin: 0;
    color: #a0a0a0;
    font-size: 1.25rem;
  }

  .busy-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1.5rem;
    padding: 1rem;
    /*background: rgba(255, 255, 255, 0.03);*/
    /*border-radius: 12px;*/
    /*border: 1px solid rgba(255, 255, 255, 0.1);*/
  }

  .busy-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: rgba(239, 68, 68, 0.8);
    border-radius: 8px;
    /*cursor: pointer;*/
    transition: background 0.2s;
  }

  /*.busy-item.non-interactive {
    cursor: default;
  }*/

  .busy-item:hover {
    background: rgba(239, 68, 68, 1);
  }

  .busy-item.completed {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.25);
  }

  .busy-item.completed:hover {
    background: rgba(34, 197, 94, 0.25);
  }

  .busy-item.floating {
    background: rgba(251, 191, 36, 0.8);
    border-color: rgba(251, 191, 36, 0.8);
  }

  .busy-item.floating:hover {
    background: rgba(251, 191, 36, 1);
  }

  .busy-item input[type='checkbox'] {
    width: 18px;
    height: 18px;
    accent-color: #22c55e;
    cursor: pointer;
  }

  .busy-item span {
    font-size: 1rem;
  }

  .strikethrough {
    text-decoration: line-through;
    opacity: 0.6;
  }

  .floating-tag {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    margin-left: 0.5rem;
    background: rgba(251, 191, 36, 0.3);
    border-radius: 4px;
    font-size: 0.75rem;
    color: #fbbf24;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
</style>
