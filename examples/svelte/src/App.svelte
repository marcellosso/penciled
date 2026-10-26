<script>
import { annotate } from 'penciled';
import 'penciled/styles.css';

let showArticle = $state(true);

function annotations(node, options) {
  const instance = annotate(node, options);
  return { destroy: () => instance.destroy() };
}
</script>

<p>
  Toggle the article to unmount and remount it. Its annotations stay saved in this browser.
</p>
<button type="button" onclick={() => (showArticle = !showArticle)}>
  {showArticle ? 'Hide article' : 'Show article'}
</button>

{#if showArticle}
  <article use:annotations={{ documentId: 'svelte-example' }}>
    <h1>Read with a pencil in hand</h1>
    <p>
      Select a few words in this paragraph and a small toolbar appears. Pick a color to highlight
      them, or write a note. Click a highlight to change its color, edit its note or remove it.
    </p>
    <p>
      Your annotations are saved in this browser as you make them. Reload the page and they
      come back where you left them. The page's markup never changes: the browser paints the
      highlights with the CSS Custom Highlight API.
    </p>
  </article>
{/if}
