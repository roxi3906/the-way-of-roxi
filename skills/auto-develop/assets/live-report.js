(() => {
  const status = document.querySelector('.live-status');
  const revision = document.querySelector('meta[name="report-revision"]')?.content;
  if (!status || !revision) return;
  const storageKey = `report-scroll:${location.pathname}`;
  try {
    const position = JSON.parse(sessionStorage.getItem(storageKey));
    sessionStorage.removeItem(storageKey);
    if (position) requestAnimationFrame(() => requestAnimationFrame(() => scrollTo(position.x, position.y)));
  } catch {}
  const events = new EventSource('/events');
  events.onmessage = event => {
    const update = JSON.parse(event.data);
    status.textContent = update.error ? status.dataset.error : status.dataset.ready;
    if (update.revision && update.revision !== revision) {
      try { sessionStorage.setItem(storageKey, JSON.stringify({ x: scrollX, y: scrollY })); } catch {}
      location.reload();
    }
  };
  events.onerror = () => { status.textContent = status.dataset.disconnected; };
})();
