<script lang="ts">
  import { page } from '$app/state';
  import { ModeWatcher } from 'mode-watcher';
  import { locales, localizeHref } from '$lib/paraglide/runtime';
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';

  let { children } = $props();
</script>

<svelte:head>
  <title>DayBar</title>
  <meta name="description" content="A simple day planner app to help toddlers visualize time" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="og:title" content="DayBar" />
  <meta name="og:description" content="A simple day planner app to help toddlers visualize time" />
  <meta name="og:image" content="https://daybar.exp.apparentvisuals.dev/icon-192.png" />
  <meta name="og:url" content="https://daybar.exp.apparentvisuals.dev" />
  <link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher />
{@render children()}
<div style="display:none">
  {#each locales as locale (locale)}
    <a href={localizeHref(page.url.pathname, { locale })}>
      {locale}
    </a>
  {/each}
</div>
