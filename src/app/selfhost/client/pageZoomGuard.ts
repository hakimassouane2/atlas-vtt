/**
 * Keeps the browser from zooming the page: a trackpad pinch arrives as a wheel event with
 * `ctrlKey` (Safari also sends `gesture*` events), and wherever no one cancels it (over the
 * toolbar or the initiative order, or while the canvas pauses its wheel during a gesture) the
 * browser scales the whole page. Cancelling only its default leaves the event to the canvas,
 * which still zooms the map with it.
 */
export function guardPageZoom(): void {
  window.addEventListener('wheel', (event) => {
    if (event.ctrlKey) event.preventDefault();
  }, { passive: false });
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    window.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  }
}
