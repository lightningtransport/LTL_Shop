(function () {
  var video = document.getElementById('demo-video');
  var toggle = document.getElementById('video-toggle');
  var restart = document.getElementById('video-restart');
  var overlay = document.getElementById('play-overlay');

  function sync() {
    var paused = video.paused;
    toggle.querySelector('span').textContent = paused ? 'Play' : 'Pause';
    toggle.querySelector('use').setAttribute('href', paused ? '#i-play' : '#i-pause');
    overlay.hidden = !paused;
  }

  function play() {
    var p = video.play();
    if (p && p.catch) p.catch(sync);
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    video.removeAttribute('autoplay');
    video.pause();
  } else {
    play(); // some browsers skip autoplay until asked again
  }

  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);
  // Only the visitor's own Pause keeps it stopped; browsers that pause it
  // (tab hidden, scrolled away, resize) get it going again when it's back in view.
  var userPaused = reduceMotion;
  toggle.addEventListener('click', function () {
    if (video.paused) { userPaused = false; play(); } else { userPaused = true; video.pause(); }
  });
  overlay.addEventListener('click', function () { userPaused = false; play(); });
  restart.addEventListener('click', function () { userPaused = false; video.currentTime = 0; play(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      if (e.isIntersecting && video.paused && !userPaused) play();
    }, { threshold: 0.25 }).observe(video);
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && video.paused && !userPaused) play();
  });
  sync();

  // Demo button: URL comes from config.js
  var url = (window.LANDING && window.LANDING.demoUrl || '').trim();
  var cta = document.getElementById('demo-cta');
  var hint = document.getElementById('demo-hint');
  if (url) {
    cta.href = url;
  } else {
    cta.textContent = 'Demo link coming soon';
    cta.setAttribute('aria-disabled', 'true');
    cta.removeAttribute('href');
    cta.classList.add('is-disabled');
    hint.textContent = 'The demo opens here shortly. Your access code will work as soon as it does.';
  }
})();
