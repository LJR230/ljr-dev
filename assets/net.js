/* Animated node-network background for the home page. Pure decoration:
   the canvas sits behind all content, ignores pointer events, and is
   skipped entirely under prefers-reduced-motion. */
(() => {
  const canvas = document.getElementById('bg-net');
  if (!canvas || !canvas.getContext) return;

  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const LINK_DIST = 150;
  const MOUSE_GLOW = 220;
  const MOUSE_PUSH = 180;

  function start() {
    const ctx = canvas.getContext('2d');
    const mouse = { x: -9999, y: -9999 };
    let nodes = [];
    let w = 0;
    let h = 0;
    let raf = null;
    let scrollVel = 0;
    let lastScrollY = window.scrollY;

    function targetCount() {
      return Math.min(90, Math.floor(window.innerWidth / 16));
    }

    function makeNode() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 1 + Math.random() * 1.6,
        depth: 0.3 + Math.random() * 0.7,
      };
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Keep existing nodes on resize; only add or trim to the new target.
      const n = targetCount();
      while (nodes.length < n) nodes.push(makeNode());
      nodes.length = n;
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      scrollVel *= 0.92;

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        n.y -= scrollVel * n.depth;

        const dx = n.x - mouse.x;
        const dy = n.y - mouse.y;
        const d = Math.hypot(dx, dy);
        if (d < MOUSE_PUSH && d > 0.001) {
          const f = ((MOUSE_PUSH - d) / MOUSE_PUSH) * 0.6;
          n.x += (dx / d) * f;
          n.y += (dy / d) * f;
        }

        if (n.x < -20) n.x = w + 20;
        else if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20;
        else if (n.y > h + 20) n.y = -20;
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK_DIST * LINK_DIST) continue;
          const d = Math.sqrt(d2);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const near = Math.hypot(mx - mouse.x, my - mouse.y) < MOUSE_GLOW;
          const o = (1 - d / LINK_DIST) * (near ? 0.22 : 0.1);
          ctx.strokeStyle = near
            ? 'rgba(74,222,128,' + o + ')'
            : 'rgba(155,161,168,' + o + ')';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const n of nodes) {
        const near = Math.hypot(n.x - mouse.x, n.y - mouse.y) < MOUSE_GLOW;
        ctx.fillStyle = near
          ? 'rgba(74,222,128,0.75)'
          : 'rgba(155,161,168,' + (0.18 + n.depth * 0.25) + ')';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    const onMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onMouseOut = (e) => {
      if (!e.relatedTarget) {
        mouse.x = -9999;
        mouse.y = -9999;
      }
    };
    const onScroll = () => {
      const y = window.scrollY;
      scrollVel += (y - lastScrollY) * 0.05;
      lastScrollY = y;
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseout', onMouseOut);
    window.addEventListener('scroll', onScroll, { passive: true });
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseout', onMouseOut);
      window.removeEventListener('scroll', onScroll);
      ctx.clearRect(0, 0, w, h);
      nodes = [];
    };
  }

  let cleanup = null;
  function apply() {
    if (media.matches) {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    } else if (!cleanup) {
      cleanup = start();
    }
  }
  media.addEventListener('change', apply);
  apply();
})();
