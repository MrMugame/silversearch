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
        background: var(--progress-background-color);
        position: relative;
        width: 300px;
        height: 8px;
        margin: 1rem;
        border-radius: 4px;
        overflow: hidden;
    }

    .bar {
        background: var(--silversearch-progress-bar-color);
        position: absolute;
        height: 100%;
        left: 0px;
        border-radius: 4px;
        transition: width 0.3s ease;
    }

    @keyframes -global-slide {
        0% { left: -30%; }
        100% { left: 100%; }
    }
</style>
