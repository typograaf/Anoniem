/**
 * Keeps the images ahead of the scroll.
 *
 * `loading="lazy"` alone starts a fetch about one and a half screens out, which
 * with full-viewport scroll-snap sections is not enough: land on a section
 * before its photograph arrives and you get the black backdrop, then a pop.
 * Worse, once Swiper lays a slider out its second and third slides sit off to
 * the side, so a purely vertical observer never reaches them and the autoplay
 * flashes black too.
 *
 * Two tiers, because bandwidth is finite and only one slide per section is ever
 * on screen:
 *
 *   far  - four screens out, fetch the first slide of each section. This is the
 *          one you will actually land on, so it must never queue behind another
 *          section's autoplay frames. A section can hold fifteen images.
 *   near - one screen out, fetch that section's remaining slides, which the
 *          autoplay reaches five seconds later at the earliest.
 *
 * Nothing here runs until the load event, so first paint is untouched: on the
 * work page it leaves the initial load at 986 KB and fills in from there.
 */
(function () {
  var FAR = '400% 0px'
  var NEAR = '100% 0px'

  var warmed = new WeakSet()

  function warm(img) {
    if (!img || warmed.has(img)) return
    warmed.add(img)
    if (img.loading === 'lazy') img.loading = 'eager'
    // Decode now so there is nothing left to do when it is scrolled into view.
    if (img.decode) img.decode().catch(function () {})
  }

  function observe(targets, rootMargin, root, pick) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return
          pick(entry.target)
          io.unobserve(entry.target)
        })
      },
      { root: root || null, rootMargin: rootMargin },
    )
    for (var i = 0; i < targets.length; i++) io.observe(targets[i])
  }

  function start() {
    var sections = document.querySelectorAll('.slider-main_component')
    var root = document.querySelector('[n-parent]')

    if (!('IntersectionObserver' in window)) return

    if (!sections.length) {
      // The other pages have a handful of standalone images and no sliders.
      var loose = document.querySelectorAll('img[loading="lazy"]')
      if (loose.length) observe(loose, FAR, null, warm)
      return
    }

    observe(sections, FAR, root, function (section) {
      warm(section.querySelector('img.image-3'))
    })

    observe(sections, NEAR, root, function (section) {
      var imgs = section.querySelectorAll('img.image-3')
      for (var i = 0; i < imgs.length; i++) warm(imgs[i])
    })
  }

  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start)
})()
