// Runs in the page; shared by the A1 regression tests and standalone measurement.
export function inspectOptions() {
  const issues = [];
  const viewport = document.documentElement.clientWidth;
  const docOverflow = document.documentElement.scrollWidth > viewport;
  if (docOverflow) issues.push("page scrolls horizontally");
  const rows = [...document.querySelectorAll(".studio-option-row")].map((row) => {
    const category = row.querySelector(".studio-option-label");
    const scroller = row.querySelector(".option-scroll");
    const box = scroller.getBoundingClientRect();
    const labels = [...row.querySelectorAll("label")];
    const name = row.querySelector("input").name;
    const checkText = (element, container = element) => {
      const bounds = container.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      for (const rect of range.getClientRects()) {
        if (rect.left < bounds.left - 0.5 || rect.right > bounds.right + 0.5 ||
            rect.top < bounds.top - 0.5 || rect.bottom > bounds.bottom + 0.5) {
          issues.push(`${name}: clipped text ${element.textContent}`);
        }
      }
    };
    const categoryBox = category.getBoundingClientRect();
    if (categoryBox.left < 0 || categoryBox.right > viewport || category.scrollWidth > category.clientWidth + 1) {
      issues.push(`${name}: category outside viewport or clipped`);
    }
    checkText(category);
    if (box.left < 0 || box.right > viewport + 0.5) issues.push(`${name}: scroller outside viewport`);
    if (!row.getClientRects().length) issues.push(`${name}: hidden row`);
    for (const label of labels) {
      const bounds = label.getBoundingClientRect();
      if (label.scrollWidth > label.clientWidth + 1) issues.push(`${name}: label overflows`);
      checkText(label.querySelector("span"), label);
      if (bounds.top < box.top || bounds.bottom > box.bottom) issues.push(`${name}: label clipped vertically`);
      if (label.querySelector("input").checked && (bounds.left < box.left - 0.5 || bounds.right > box.right + 0.5)) {
        issues.push(`${name}: checked choice outside scroll viewport`);
      }
      if (getComputedStyle(label).whiteSpace !== "nowrap") issues.push(`${name}: wrapping choice`);
    }
    return {
      name, clientWidth: scroller.clientWidth, scrollWidth: scroller.scrollWidth,
      scrollLeft: scroller.scrollLeft,
      stacked: categoryBox.bottom <= box.top,
      fadeStart: scroller.parentElement.dataset.fadeStart,
      fadeEnd: scroller.parentElement.dataset.fadeEnd,
    };
  });
  if (rows.length !== 5) issues.push(`expected 5 rows, got ${rows.length}`);
  return { docOverflow, rows, issues };
}
