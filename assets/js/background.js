/**
 * KRLBRYN — subtle cursor-reactive background.
 * Single canvas, requestAnimationFrame, no DOM churn per frame.
 * Disabled entirely for prefers-reduced-motion and rendered static on touch devices.
 */
(function () {
  'use strict';

  var canvas = document.getElementById('bg-canvas');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;

  var width = 0;
  var height = 0;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  var pointer = { x: -9999, y: -9999, active: false };
  var targetPointer = { x: -9999, y: -9999 };

  var nodes = [];
  var rafId = null;
  var lastFrame = 0;
  var resizeTimeout = null;

  var RED = '139, 0, 0';
  var LINE_ALPHA = 0.06;
  var LINE_ALPHA_NEAR = 0.16;
  var NODE_ALPHA = 0.28;
  var LINK_DIST = 150;
  var CURSOR_RADIUS = 170;
  var MAX_DISPLACEMENT = 6;

  function densityForWidth(w) {
    if (w < 640) return 55;
    if (w < 1024) return 80;
    return 110;
  }

  function setup() {
    var rect = canvas.parentElement.getBoundingClientRect();
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildNodes();
  }

  function buildNodes() {
    var count = densityForWidth(width);
    nodes = [];
    var cols = Math.ceil(Math.sqrt(count * (width / height)));
    var rows = Math.ceil(count / cols);
    var cellW = width / cols;
    var cellH = height / rows;

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var baseX = c * cellW + cellW / 2;
        var baseY = r * cellH + cellH / 2;
        nodes.push({
          bx: baseX + (Math.random() - 0.5) * cellW * 0.5,
          by: baseY + (Math.random() - 0.5) * cellH * 0.5,
          x: 0,
          y: 0,
          phase: Math.random() * Math.PI * 2
        });
      }
    }
  }

  function onPointerMove(e) {
    targetPointer.x = e.clientX;
    targetPointer.y = e.clientY;
    pointer.active = true;
  }

  function onPointerLeave() {
    pointer.active = false;
    targetPointer.x = -9999;
    targetPointer.y = -9999;
  }

  function drawStatic() {
    // No animation: draw one calm, faint grid so the page still has
    // the intended background texture with JS disabled or motion reduced.
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(' + RED + ', ' + LINE_ALPHA + ')';
    ctx.lineWidth = 1;

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      ctx.fillStyle = 'rgba(' + RED + ', ' + NODE_ALPHA * 0.6 + ')';
      ctx.beginPath();
      ctx.arc(n.bx, n.by, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(t) {
    rafId = requestAnimationFrame(frame);

    // Throttle to ~30fps: cheap and plenty smooth for a subtle effect.
    if (t - lastFrame < 33) return;
    lastFrame = t;

    // Ease the pointer toward its target for gentle, non-jittery motion.
    pointer.x += (targetPointer.x - pointer.x) * 0.08;
    pointer.y += (targetPointer.y - pointer.y) * 0.08;

    ctx.clearRect(0, 0, width, height);

    var time = t * 0.00025;

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];

      // Extremely subtle idle drift.
      var driftX = Math.sin(time + n.phase) * 1.2;
      var driftY = Math.cos(time * 0.8 + n.phase) * 1.2;

      var dx = n.bx - pointer.x;
      var dy = n.by - pointer.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      var pushX = 0;
      var pushY = 0;

      if (dist < CURSOR_RADIUS) {
        var strength = (1 - dist / CURSOR_RADIUS) * MAX_DISPLACEMENT;
        var nd = dist || 1;
        pushX = (dx / nd) * strength;
        pushY = (dy / nd) * strength;
      }

      n.x = n.bx + driftX + pushX;
      n.y = n.by + driftY + pushY;
    }

    // Links between nearby nodes.
    ctx.lineWidth = 1;
    for (var a = 0; a < nodes.length; a++) {
      for (var b = a + 1; b < nodes.length; b++) {
        var na = nodes[a];
        var nb = nodes[b];
        var ddx = na.x - nb.x;
        var ddy = na.y - nb.y;
        var d2 = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d2 < LINK_DIST) {
          var midDist = Math.min(
            Math.hypot(na.x - pointer.x, na.y - pointer.y),
            Math.hypot(nb.x - pointer.x, nb.y - pointer.y)
          );
          var near = midDist < CURSOR_RADIUS;
          var alpha = (near ? LINE_ALPHA_NEAR : LINE_ALPHA) * (1 - d2 / LINK_DIST);
          ctx.strokeStyle = 'rgba(' + RED + ', ' + alpha.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(na.x, na.y);
          ctx.lineTo(nb.x, nb.y);
          ctx.stroke();
        }
      }
    }

    // Nodes.
    for (var k = 0; k < nodes.length; k++) {
      var node = nodes[k];
      var nDist = Math.hypot(node.x - pointer.x, node.y - pointer.y);
      var nearNode = nDist < CURSOR_RADIUS;
      var nodeAlpha = nearNode ? NODE_ALPHA * (1.4 - nDist / CURSOR_RADIUS) : NODE_ALPHA * 0.5;
      ctx.fillStyle = 'rgba(' + RED + ', ' + Math.min(nodeAlpha, 0.4).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(node.x, node.y, nearNode ? 1.8 : 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft cursor glow — very restrained, no large following circle.
    if (pointer.active) {
      var glow = ctx.createRadialGradient(
        pointer.x, pointer.y, 0,
        pointer.x, pointer.y, CURSOR_RADIUS
      );
      glow.addColorStop(0, 'rgba(' + RED + ', 0.05)');
      glow.addColorStop(1, 'rgba(' + RED + ', 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, CURSOR_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function start() {
    setup();

    if (reduceMotion) {
      drawStatic();
      return;
    }

    if (!isTouch) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerleave', onPointerLeave, { passive: true });
      window.addEventListener('blur', onPointerLeave);
    }

    rafId = requestAnimationFrame(frame);
  }

  window.addEventListener('resize', function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      setup();
      if (reduceMotion) drawStatic();
    }, 150);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!document.hidden && !reduceMotion && !rafId) {
      rafId = requestAnimationFrame(frame);
    }
  });

  start();
})();
