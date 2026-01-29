<script lang="ts">
  import { resolve } from '$app/paths';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as InputGroup from '$lib/components/ui/input-group/index.js';
  import * as ButtonGroup from '$lib/components/ui/button-group/index.js';

  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';

  import {
    configStore,
    DAYS_OF_WEEK,
    DAY_LABELS,
    formatTime,
    addTimes,
    type DayOfWeek,
    type Time,
    type BusyPeriod,
  } from '$lib/config.svelte.js';

  const DEFAULT_COLOR = '#ef4444';

  let newBusyTitle = $state('');
  let newBusyStart: Time = $state({ hour: 9, minute: 0 });
  let newBusyEnd: Time = $state({ hour: 10, minute: 0 });
  let newBusyDuration: Time = $state({ hour: 1, minute: 0 });
  let useDuration = $state(false);
  let useFloating = $state(false);
  let newBusyColor = $state(DEFAULT_COLOR);

  // Editing state
  let editingIndex = $state<number | null>(null);
  let editTitle = $state('');
  let editStart: Time = $state({ hour: 9, minute: 0 });
  let editEnd: Time = $state({ hour: 10, minute: 0 });
  let editDuration: Time = $state({ hour: 1, minute: 0 });
  let editUseDuration = $state(false);
  let editUseFloating = $state(false);
  let editColor = $state(DEFAULT_COLOR);

  function startEditing(index: number) {
    const period = configStore.currentDayConfig.busyPeriods[index];
    editingIndex = index;
    editTitle = period.title ?? '';
    editUseFloating = period.floating ?? false;
    editUseDuration = !!period.duration && !period.end;
    editStart = period.start ? { ...period.start } : { hour: 9, minute: 0 };
    editEnd = period.end ? { ...period.end } : { hour: 10, minute: 0 };
    editDuration = period.duration ? { ...period.duration } : { hour: 1, minute: 0 };
    editColor = period.color ?? DEFAULT_COLOR;
  }

  function cancelEditing() {
    editingIndex = null;
  }

  function saveEditing() {
    if (editingIndex === null) return;

    const title = editTitle.trim() || undefined;
    let updatedPeriod: BusyPeriod;

    if (editUseFloating) {
      updatedPeriod = {
        title,
        duration: { ...editDuration },
        floating: true,
      };
    } else if (editUseDuration) {
      updatedPeriod = {
        title,
        start: { ...editStart },
        duration: { ...editDuration },
        color: editColor,
      };
    } else {
      updatedPeriod = {
        title,
        start: { ...editStart },
        end: { ...editEnd },
        color: editColor,
      };
    }

    configStore.updateBusyPeriod(editingIndex, updatedPeriod);
    editingIndex = null;
  }

  function addBusyPeriod() {
    const title = newBusyTitle.trim() || undefined;
    if (useFloating) {
      configStore.addBusyPeriod({
        title,
        duration: { ...newBusyDuration },
        floating: true,
      });
    } else if (useDuration) {
      configStore.addBusyPeriod({
        title,
        start: { ...newBusyStart },
        duration: { ...newBusyDuration },
        color: newBusyColor,
      });
    } else {
      configStore.addBusyPeriod({
        title,
        start: { ...newBusyStart },
        end: { ...newBusyEnd },
        color: newBusyColor,
      });
    }
    newBusyTitle = '';
    newBusyColor = DEFAULT_COLOR;
  }

  function removeBusyPeriod(index: number) {
    configStore.removeBusyPeriod(index);
  }

  function isCompleted(index: number): boolean {
    return configStore.isCompleted(index);
  }

  function selectDay(day: DayOfWeek) {
    configStore.selectDay(day);
  }

  function getCurrentDayIndex(): number {
    return new Date().getDay();
  }

  function isSelectedDayToday(): boolean {
    return configStore.selectedDay === DAYS_OF_WEEK[getCurrentDayIndex()];
  }

  function formatPeriodTime(period: { start?: Time; end?: Time; duration?: Time; floating?: boolean }): string {
    if (period.floating) {
      return `${period.duration?.hour ?? 0}h ${period.duration?.minute ?? 0}m (floating)`;
    }
    const start = period.start ?? { hour: 0, minute: 0 };
    const end = period.end ?? addTimes(start, period.duration ?? { hour: 0, minute: 0 });
    return `${formatTime(start)} - ${formatTime(end)}`;
  }

  function formatDuration(duration: Time): string {
    if (duration.hour > 0 && duration.minute > 0) {
      return `${duration.hour}h ${duration.minute}m`;
    } else if (duration.hour > 0) {
      return `${duration.hour}h`;
    } else {
      return `${duration.minute}m`;
    }
  }
</script>

<main class="flex flex-col gap-2">
  <Button href={resolve('/')} variant="link">← Back to Timeline</Button>
  <h1 class="text-foreground">Configuration</h1>

  <Card.Root>
    <Card.Header>
      <Card.Title>Day of Week</Card.Title>
      <Card.Action>
        <input
          id="day-enabled"
          type="checkbox"
          checked={configStore.currentDayConfig.enabled}
          onchange={(e) => configStore.setEnabled(e.currentTarget.checked)}
        />
        <label for="day-enabled">Day enabled</label>
      </Card.Action>
    </Card.Header>
    <Card.Content>
      <div class="day-selector">
        {#each DAYS_OF_WEEK as day, index (day)}
          <Button
            class="day-btn"
            variant={configStore.selectedDay === day
              ? 'default'
              : index === getCurrentDayIndex()
                ? 'secondary'
                : 'ghost'}
            onclick={() => selectDay(day)}
          >
            {DAY_LABELS[day]}
          </Button>
        {/each}
      </div>
    </Card.Content>
  </Card.Root>

  {#if configStore.currentDayConfig.enabled}
    <Card.Root>
      <Card.Header>
        <Card.Action>
          <label class="toggle">
            <input
              type="checkbox"
              checked={configStore.currentDayConfig.useCustomRange}
              onchange={(e) => configStore.setUseCustomRange(e.currentTarget.checked)}
            />
            <span>Use custom time range</span>
          </label>
        </Card.Action>
      </Card.Header>
      <Card.Content>
        {#if configStore.currentDayConfig.useCustomRange}
          <div class="time-inputs">
            <label>
              Start:
              <Input
                type="time"
                value={formatTime(configStore.currentDayConfig.startTime)}
                onchange={(e) => {
                  const [h, m] = e.currentTarget.value.split(':').map(Number);
                  configStore.setStartTime({ hour: h, minute: m });
                }}
              />
            </label>
            <label>
              End:
              <Input
                type="time"
                value={formatTime(configStore.currentDayConfig.endTime)}
                onchange={(e) => {
                  const [h, m] = e.currentTarget.value.split(':').map(Number);
                  configStore.setEndTime({ hour: h, minute: m });
                }}
              />
            </label>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  {/if}

  {#if configStore.currentDayConfig.enabled}
    <Card.Root>
      <Card.Header><Card.Title>Busy Periods for {DAY_LABELS[configStore.selectedDay]}</Card.Title></Card.Header>
      <Card.Content>
        <div class="busy-input-row">
          <label>
            Title:
            <Input type="text" placeholder="Optional" bind:value={newBusyTitle} />
          </label>
          {#if !useFloating}
            <label class="color-input">
              Color:
              <input type="color" bind:value={newBusyColor} />
            </label>
          {/if}
        </div>

        <div class="busy-input-row">
          <label class="toggle-inline">
            <input type="checkbox" bind:checked={useFloating} />
            <span>Floating</span>
          </label>

          {#if !useFloating}
            <label class="toggle-inline">
              <input type="checkbox" bind:checked={useDuration} />
              <span>Use duration</span>
            </label>
          {/if}
        </div>

        <div class="busy-input-row">
          {#if !useFloating}
            <label>
              Start:
              <Input
                type="time"
                value={formatTime(newBusyStart)}
                onchange={(e) => {
                  const [h, m] = e.currentTarget.value.split(':').map(Number);
                  newBusyStart = { hour: h, minute: m };
                }}
              />
            </label>
          {/if}

          {#if useFloating || useDuration}
            <label class="duration-input">
              Duration:
              <div class="duration-fields">
                <InputGroup.Root>
                  <InputGroup.Input
                    type="number"
                    min="0"
                    max="23"
                    value={newBusyDuration.hour}
                    onchange={(e) => (newBusyDuration.hour = Number(e.currentTarget.value))}
                  />
                  <InputGroup.Addon align="inline-end">
                    <InputGroup.Text>H</InputGroup.Text>
                  </InputGroup.Addon>
                </InputGroup.Root>
                <InputGroup.Root>
                  <InputGroup.Input
                    type="number"
                    min="0"
                    max="59"
                    step="5"
                    value={newBusyDuration.minute}
                    onchange={(e) => (newBusyDuration.minute = Number(e.currentTarget.value))}
                  />
                  <InputGroup.Addon align="inline-end">
                    <InputGroup.Text>M</InputGroup.Text>
                  </InputGroup.Addon>
                </InputGroup.Root>
              </div>
            </label>
          {:else}
            <label>
              End:
              <Input
                type="time"
                value={formatTime(newBusyEnd)}
                onchange={(e) => {
                  const [h, m] = e.currentTarget.value.split(':').map(Number);
                  newBusyEnd = { hour: h, minute: m };
                }}
              />
            </label>
          {/if}

          <button class="add-btn" onclick={addBusyPeriod}>Add</button>
        </div>
      </Card.Content>
    </Card.Root>

    {#if configStore.currentDayConfig.busyPeriods.length > 0}
      <div class="busy-list">
        {#each configStore.currentDayConfig.busyPeriods as period, index (index)}
          {@const completed = isSelectedDayToday() && isCompleted(index)}
          {#if editingIndex === index}
            <div class="busy-item editing">
              <div class="edit-form">
                <div class="edit-row">
                  <label>
                    Title:
                    <input type="text" placeholder="Optional" bind:value={editTitle} />
                  </label>
                  {#if !editUseFloating}
                    <label class="color-input">
                      Color:
                      <input type="color" bind:value={editColor} />
                    </label>
                  {/if}
                </div>
                <div class="edit-row">
                  <label class="toggle-inline">
                    <input type="checkbox" bind:checked={editUseFloating} />
                    <span>Floating</span>
                  </label>
                  {#if !editUseFloating}
                    <label class="toggle-inline">
                      <input type="checkbox" bind:checked={editUseDuration} />
                      <span>Use duration</span>
                    </label>
                  {/if}
                </div>
                <div class="edit-row">
                  {#if !editUseFloating}
                    <label>
                      Start:
                      <input
                        type="time"
                        value={formatTime(editStart)}
                        onchange={(e) => {
                          const [h, m] = e.currentTarget.value.split(':').map(Number);
                          editStart = { hour: h, minute: m };
                        }}
                      />
                    </label>
                  {/if}
                  {#if editUseFloating || editUseDuration}
                    <label class="duration-input">
                      Duration:
                      <div class="duration-fields">
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={editDuration.hour}
                          onchange={(e) => (editDuration.hour = Number(e.currentTarget.value))}
                        />
                        <span>h</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          step="5"
                          value={editDuration.minute}
                          onchange={(e) => (editDuration.minute = Number(e.currentTarget.value))}
                        />
                        <span>m</span>
                      </div>
                    </label>
                  {:else}
                    <label>
                      End:
                      <input
                        type="time"
                        value={formatTime(editEnd)}
                        onchange={(e) => {
                          const [h, m] = e.currentTarget.value.split(':').map(Number);
                          editEnd = { hour: h, minute: m };
                        }}
                      />
                    </label>
                  {/if}
                </div>
                <div class="edit-actions">
                  <button class="save-btn" onclick={saveEditing}>Save</button>
                  <button class="cancel-btn" onclick={cancelEditing}>Cancel</button>
                </div>
              </div>
            </div>
          {:else}
            <div
              class="busy-item"
              class:completed
              class:floating={period.floating}
              style:background-color={!period.floating && !completed && period.color ? period.color : null}
            >
              <div class="period-info text-foreground">
                {#if isSelectedDayToday()}
                  <span class:strikethrough={completed}>
                    {#if period.title}<strong>{period.title}</strong> &mdash;
                    {/if}
                    {#if period.floating}
                      {formatDuration(period.duration ?? { hour: 0, minute: 0 })} (floating)
                    {:else}
                      {formatPeriodTime(period)}
                    {/if}
                  </span>
                {:else}
                  <span>
                    {#if period.title}<strong>{period.title}</strong> &mdash;
                    {/if}
                    {#if period.floating}
                      {formatDuration(period.duration ?? { hour: 0, minute: 0 })} (floating)
                    {:else}
                      {formatPeriodTime(period)}
                    {/if}
                  </span>
                {/if}
              </div>
              <ButtonGroup.Root>
                <Button variant="secondary" onclick={() => startEditing(index)}>Edit</Button>
                <Button variant="destructive" onclick={() => removeBusyPeriod(index)}>Remove</Button>
              </ButtonGroup.Root>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  {:else}
    <div class="disabled-message">
      <p>{DAY_LABELS[configStore.selectedDay]} is disabled. Enable it to configure time ranges and busy periods.</p>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'Segoe UI', system-ui, sans-serif;
    /*background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);*/
    min-height: 100vh;
    color: #e0e0e0;
  }

  main {
    width: 100%;
    max-width: 1400px;
    padding: 2rem;
    box-sizing: border-box;
  }

  h1 {
    font-weight: 300;
    font-size: 2rem;
    margin: 0;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }

  .day-selector {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    font-size: 1rem;
  }

  .toggle input {
    width: 18px;
    height: 18px;
    accent-color: #6366f1;
  }

  .time-inputs {
    display: flex;
    gap: 2rem;
    margin-top: 1rem;
    padding-top: 1rem;
  }

  .time-inputs label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .busy-input-row {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }

  .busy-input-row:last-child {
    margin-bottom: 0;
  }

  .busy-input-row label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .duration-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .duration-fields {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .duration-fields input[type='number'] {
    width: 50px;
    padding: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.2);
    color: #fff;
    font-size: 1rem;
    text-align: center;
  }

  .duration-fields input[type='number']:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .duration-fields span {
    color: #a0a0a0;
    font-size: 0.9rem;
  }

  .toggle-inline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .toggle-inline input {
    width: 16px;
    height: 16px;
    accent-color: #6366f1;
  }

  .color-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .color-input input[type='color'] {
    width: 40px;
    height: 32px;
    padding: 2px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.2);
    cursor: pointer;
  }

  .color-input input[type='color']::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  .color-input input[type='color']::-webkit-color-swatch {
    border: none;
    border-radius: 4px;
  }

  .add-btn {
    padding: 0.5rem 1rem;
    background: #6366f1;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s;
  }

  .add-btn:hover {
    background: #5558e3;
  }

  .busy-list {
    margin-top: 1rem;
    padding-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .busy-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: rgba(239, 68, 68, 0.2);
    border-radius: 6px;
    border: 1px solid rgba(239, 68, 68, 0.3);
    transition:
      background 0.2s,
      border-color 0.2s;
  }

  .busy-item.completed {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.3);
  }

  .busy-item.floating:not(.completed) {
    background: rgba(251, 191, 36, 0.2);
    border-color: rgba(251, 191, 36, 0.3);
  }

  .period-info {
    display: flex;
    align-items: center;
  }

  .strikethrough {
    text-decoration: line-through;
    opacity: 0.7;
  }

  .item-actions {
    display: flex;
    gap: 0.5rem;
  }

  .busy-item.editing {
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.4);
  }

  .edit-form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .edit-row {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .edit-row label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .edit-row input[type='text'] {
    padding: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.2);
    color: #fff;
    font-size: 1rem;
    min-width: 150px;
  }

  .edit-row input[type='text']::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .edit-row input[type='text']:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .edit-row input[type='time'] {
    padding: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.2);
    color: #fff;
    font-size: 1rem;
  }

  .edit-row input[type='time']:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .edit-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .save-btn {
    padding: 0.4rem 1rem;
    background: #22c55e;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.2s;
  }

  .save-btn:hover {
    background: #16a34a;
  }

  .cancel-btn {
    padding: 0.4rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    color: #e0e0e0;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.2s;
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .disabled-message {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 2rem;
    margin-bottom: 1.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
  }

  .disabled-message p {
    margin: 0;
    color: #a0a0a0;
    font-size: 1.1rem;
  }
</style>
