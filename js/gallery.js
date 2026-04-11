(function () {
  'use strict';

  var lightbox = document.querySelector('.lightbox');
  if (!lightbox) return;

  var lightboxImg = lightbox.querySelector('.lightbox-img');
  var lightboxCaption = lightbox.querySelector('.lightbox-caption');
  var items = document.querySelectorAll('.gallery-item');
  var currentIndex = 0;

  items.forEach(function (item, index) {
    item.addEventListener('click', function () {
      currentIndex = index;
      showImage(index);
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  function showImage(index) {
    var item = items[index];
    var img = item.querySelector('img');
    var label = item.querySelector('.gallery-item-label');
    lightboxImg.src = img.dataset.full || img.dataset.src || img.src;
    lightboxCaption.textContent = label ? label.textContent : '';
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });

  function navigate(dir) {
    currentIndex = (currentIndex + dir + items.length) % items.length;
    showImage(currentIndex);
  }

  lightbox.querySelector('.lightbox-prev').addEventListener('click', function (e) {
    e.stopPropagation();
    navigate(-1);
  });

  lightbox.querySelector('.lightbox-next').addEventListener('click', function (e) {
    e.stopPropagation();
    navigate(1);
  });

  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });

  var touchStartX = 0;
  lightbox.addEventListener('touchstart', function (e) {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  lightbox.addEventListener('touchend', function (e) {
    var diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) {
      navigate(diff > 0 ? 1 : -1);
    }
  }, { passive: true });
})();
