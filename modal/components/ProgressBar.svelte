<script lang="ts">
    let { progress }: { progress: null | number } = $props();
</script>

<div class="container">
    <div
        class="bar"
        style:width={progress === null ? "30%" : `${progress}%`}
        style:animation={progress === null ? "slide 1s linear infinite" : "none"}
    ></div>
</div>

<style>
    .container {
        position: relative;
        width: 300px;
        max-width: 100%;
        height: 4px;
        overflow: hidden;
        background-color: var(--progress-background-color);
        border-radius: var(--ui-radius-pill);
    }

    .bar {
        position: absolute;
        left: 0;
        height: 100%;
        background-color: var(--progress-index-color);
        border-radius: var(--ui-radius-pill);
        transition: width 150ms ease;
    }

    @keyframes -global-slide {
        0% { left: -30%; }
        100% { left: 100%; }
    }
</style>
