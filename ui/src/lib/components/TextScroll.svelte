<script lang="ts">
  import { type Snippet, untrack } from 'svelte';

  interface IProps {
    children: Snippet<[]>;
    class?: string;
    style?: string;
    // content: string;
  }
  const { children, class: className = '', style = '' }: IProps = $props();

  const SCROLL_STATE = {
    INACTIVE: 'INACTIVE',
    STAY_LEFT: 'STAY_LEFT',
    SCROLL: 'SCROLL',
    STAY_RIGHT: 'STAY_RIGHT',
  };

  let wrapperRef: HTMLSpanElement | null = $state(null);
  let contentRef: HTMLSpanElement | null = $state(null);

  let outerWidth = $state(0);
  let textWidth = $state(0);
  let scrollState = $state(SCROLL_STATE.INACTIVE);

  $effect(
    /// resets scrolling state to LEFT if the inner content changes
    () => {
      void textWidth; // force dependency
      if (untrack(() => scrollState) !== SCROLL_STATE.STAY_LEFT) {
        scrollState = SCROLL_STATE.STAY_LEFT;
      }
    }
);
  $effect(
    /// begin scrolling once inner text is wider than container
    () => {
      if (outerWidth > textWidth) {
        scrollState = SCROLL_STATE.INACTIVE;
      } else if (untrack(() => scrollState) === SCROLL_STATE.INACTIVE) {
        scrollState = SCROLL_STATE.STAY_LEFT;
      }
    }
  );

  $effect(
    /// advance scroll states (right -> left, left -> animate) by timeout
    () => {
      if (scrollState === SCROLL_STATE.STAY_LEFT) {
        let timeout = setTimeout(() => {
          scrollState = SCROLL_STATE.SCROLL;
        }, 1500);
        return () => clearTimeout(timeout);
      }

      if (scrollState === SCROLL_STATE.STAY_RIGHT) {
        let timeout = setTimeout(() => {
          scrollState = SCROLL_STATE.STAY_LEFT;
        }, 1500);
        return () => clearTimeout(timeout);
      }
    }
  );
  /// advance scroll state by animation (animate -> right)
  const handleAnimationEnd = () => {
    scrollState = SCROLL_STATE.STAY_RIGHT;
  };

  let widthVar = $derived.by(() => {
    if (scrollState === SCROLL_STATE.INACTIVE) {
      return undefined;
    }
    return -(textWidth - outerWidth) + 'px';
  });
  let scrollDuration = $derived.by(() => {
    if (scrollState === SCROLL_STATE.INACTIVE) {
      return undefined;
    }
    let diff = textWidth - outerWidth;
    return (diff / 100 * 1.5) + 's';
  });
</script>


<span
  class={`wrapper ${className}`}
  {style}
  style:--scroll-width={widthVar}
  style:--scroll-duration={scrollDuration}
  bind:clientWidth={outerWidth}
  >
  <span
    class="content"
    class:-animate={scrollState === SCROLL_STATE.SCROLL}
    class:-end={scrollState === SCROLL_STATE.STAY_RIGHT}
    bind:clientWidth={textWidth}
    onanimationend={handleAnimationEnd}
  >
    {@render children()}
  </span>
</span>

<style>
  .wrapper {
    display: inline-block;
    position: relative;
    height: 1lh;
    overflow-x: hidden;
  }
  .content {
    position: absolute;
  }
  .content.-animate {
    animation: var(--scroll-duration) linear 0s scroll;
  }
  .content.-end {
    left: var(--scroll-width);
  }
  @keyframes scroll {
    from { left: 0; }
    to { left: var(--scroll-width); }
  }
</style>
