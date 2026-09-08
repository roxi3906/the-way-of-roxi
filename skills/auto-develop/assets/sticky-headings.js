(() => {
  const headings = [...document.querySelectorAll('.chapter-heading, .block-heading')].map(heading => {
    const anchor = document.createElement('span');
    anchor.className = 'sticky-anchor';
    heading.before(anchor);
    return { heading, anchor };
  });
  const outline = document.querySelector('.decision-outline');
  const links = outline ? [...outline.querySelectorAll('a')] : [];
  const decisions = links.map(link => document.getElementById(link.hash.slice(1)));
  let previous = -1;
  let scheduled = false;
  const update = () => {
    scheduled = false;
    const states = headings.map(({ heading, anchor }) => {
      const top = parseFloat(getComputedStyle(heading).top);
      return anchor.getBoundingClientRect().top < top - 0.5 &&
        Math.abs(heading.getBoundingClientRect().top - top) < 0.5;
    });
    const chapterTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chapter-height'));
    let current = -1;
    decisions.forEach((decision, index) => {
      const rect = decision.getBoundingClientRect();
      if (rect.top <= chapterTop + 16 && rect.bottom > chapterTop) current = index;
    });
    headings.forEach(({ heading }, index) => heading.classList.toggle('is-stuck', states[index]));
    links.forEach((link, index) => {
      if (index === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    if (current >= 0 && current !== previous && getComputedStyle(outline).position === 'sticky') {
      const list = outline.querySelector('ol');
      const bounds = list.getBoundingClientRect();
      const active = links[current].getBoundingClientRect();
      if (active.top < bounds.top) list.scrollTop += active.top - bounds.top;
      else if (active.bottom > bounds.bottom) list.scrollTop += active.bottom - bounds.bottom;
    }
    previous = current;
  };
  const schedule = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  new ResizeObserver(schedule).observe(document.querySelector('.page'));
  schedule();
})();
