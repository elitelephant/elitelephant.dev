// Cuts the headline's second line out of the front's paper, so the page and its bubbles show through its letters.
// CSS can't mask one element by another's text, so the letters are drawn on a canvas where the browser laid them out,
// and that canvas masks the paper (.front[data-cut]::before in app/globals.css). The line keeps its text, turned
// transparent, for screen readers, selection and search. Returns a function that undoes it.
export function cutOut(face: HTMLElement, line: HTMLElement) {
  const card = face.closest<HTMLElement>(".card");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!card || !ctx) return () => {};
  let frame = 0;
  let stopped = false;
  let drawn = 0; // masks started
  let shown = 0; // the mask in place, by the order it was started in
  let url = "";

  const draw = () => {
    // Measured flat, since the card's turn and tilt would skew the letters' boxes.
    const transform = card.style.transform;
    card.style.transform = "none";
    const box = face.getBoundingClientRect();
    const style = getComputedStyle(line);
    const range = document.createRange();
    const letters: { ch: string; rect: DOMRect }[] = [];
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      for (let i = 0; i < text.length; i++) {
        if (text[i] === " ") continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getClientRects()[0];
        if (rect) letters.push({ ch: text[i], rect });
      }
    }
    card.style.transform = transform;

    // Letter by letter at the browser's own positions, so kerning and letter spacing match without the canvas
    // having to reproduce them.
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, box.width, box.height);
    ctx.globalCompositeOperation = "destination-out";
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.textBaseline = "alphabetic";
    for (const { ch, rect } of letters) {
      const m = ctx.measureText(ch);
      // A letter's box spans the font's ascent and descent, so the baseline sits the ascent below its top.
      const baseline = rect.top - box.top + (rect.height - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
      ctx.fillText(ch, rect.left - box.left, baseline);
    }
    // Encoded and decoded off the frame, so a resize doesn't stall on it (tens of ms on a slow phone). The mask in place
    // stays until the new one can paint at once, so the paper never shows without one.
    const id = ++drawn;
    canvas.toBlob(async (blob) => {
      if (!blob || stopped) return;
      const next = URL.createObjectURL(blob);
      const img = new Image();
      img.src = next;
      // One that can't be decoded ahead still goes in, and loads as it paints.
      await img.decode().catch(() => {});
      // A mask started later may have gone in while this one decoded.
      if (stopped || id < shown) return URL.revokeObjectURL(next);
      shown = id;
      face.style.setProperty("--cut", `url(${next})`);
      face.dataset.cut = "";
      if (url) URL.revokeObjectURL(url);
      url = next;
    });
  };
  // Drawn again whenever the card or the line changes size (the window, the text size), and once the font is in.
  const later = () => {
    if (stopped) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  };
  const watch = new ResizeObserver(later);
  watch.observe(face);
  watch.observe(line);
  document.fonts.ready.then(later);
  document.fonts.addEventListener("loadingdone", later);

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    watch.disconnect();
    document.fonts.removeEventListener("loadingdone", later);
    delete face.dataset.cut;
    face.style.removeProperty("--cut");
    if (url) URL.revokeObjectURL(url);
  };
}
