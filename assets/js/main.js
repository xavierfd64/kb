/**
 * KRLBRYN — small page helpers (non-essential; page works with JS disabled).
 */
(function () {
  'use strict';

  var yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  var soonLinks = document.querySelectorAll('.is-soon');
  soonLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
    });
  });
})();
