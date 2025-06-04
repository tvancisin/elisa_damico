<!-- CirclePoint.svelte -->
<script>
    import { tweened } from "svelte/motion";
    import { cubicOut } from "svelte/easing";
    import { onMount } from "svelte";

    export let x;
    export let y;
    export let r = 3;
    export let fill = "steelblue";
    export let fillOpacity = 0.5;

    const duration = 500;

    const cx = tweened(x, { duration, easing: cubicOut });
    const cy = tweened(y, { duration, easing: cubicOut });

    // Ensure initial mount sets tween base correctly
    onMount(() => {
        cx.set(x);
        cy.set(y);
    });

    // Update when props change
    $: cx.set(x);
    $: cy.set(y);
</script>

<circle cx={$cx} cy={$cy} {r} {fill} fill-opacity={fillOpacity}  />
