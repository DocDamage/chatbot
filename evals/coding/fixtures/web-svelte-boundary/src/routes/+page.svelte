<script lang="ts">
  export let loading = false;
</script>

{#if loading}<p>Loading…</p>{:else}<main><h1>Users</h1></main>{/if}
