/* Slow constellation, the same marble field as vognis.com. */

(function () {
  const COLORS = ["#C5A059", "#1A3A8F", "#8F1A1A"];
  let points = [];
  let ctx;
  let canvas;
  let running = false;
  let focus = null;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function seed() {
    const count = Math.round((canvas.width * canvas.height) / 28000);
    points = Array.from({ length: Math.max(28, Math.min(count, 90)) }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
  }

  function frame() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dim = document.body.classList.contains("in-map") ? 0.45 : 1;
    for (const p of points) {
      p.x += p.vx;
      p.y += p.vy;
      if (focus) {
        p.x += (focus.x - p.x) * 0.004;
        p.y += (focus.y - p.y) * 0.004;
      }
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    }
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i];
        const b = points[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 150) {
          ctx.strokeStyle = `rgba(170, 170, 170, ${(1 - dist / 150) * 0.45 * dim})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    for (const p of points) {
      ctx.fillStyle = p.c;
      ctx.globalAlpha = 0.85 * dim;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }

  function start() {
    canvas = document.getElementById("constellation");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    resize();
    seed();
    window.addEventListener("resize", () => { resize(); seed(); });
    running = true;
    requestAnimationFrame(frame);
  }

  window.constellationFocus = function (x, y) { focus = x == null ? null : { x, y }; };
  document.addEventListener("DOMContentLoaded", start);
})();
