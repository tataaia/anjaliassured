/**
 * Tilt Water-Flow Effect — Standalone Physics Module
 * 
 * Simulates water-like text flow driven by device gyroscope tilt.
 * Text elements flow like water on a tilted surface, then gently
 * spring back to their original positions after 3-4 seconds of stillness.
 * 
 * REMOVAL: Delete tilt-effect.js and tilt-effect.css references from HTML.
 */
(function () {
    'use strict';

    // ─── CONFIGURATION ───────────────────────────────────────────────
    var CONFIG = {
        maxDisplacement: 38,         // Max pixels text can shift
        tiltSensitivity: 0.9,        // Sensitivity multiplier (0.1–1.5)
        springStiffness: 0.055,      // Spring constant during active tilt
        returnStiffness: 0.022,      // Softer spring when returning to origin
        damping: 0.87,               // Velocity damping (momentum retention)
        returnDamping: 0.91,         // Gentler damping during return
        stillnessThreshold: 0.04,    // Smoothed-delta threshold for "still"
        stillnessDelay: 3500,        // ms before text drifts home
        depthRange: [0.45, 1.45],    // Random depth per element (water layers)
        rotationFactor: 0.14,        // Subtle rotation from horizontal velocity
        smoothingFactor: 0.12,       // Tilt input low-pass filter strength
        gyroDetectTimeout: 2500,     // ms to wait for gyro before fallback
        tooltipDuration: 3000,       // Tooltip display time
        opacityDuringReturn: 0.86,   // Text opacity while flowing home
        waveStiffnessRange: [0.7, 1.35] // Per-element stiffness variation (wave propagation)
    };

    // Block-level text selectors (avoids double-movement of nested inlines)
    var TEXT_SELECTORS = 'h1, h2, h3, h4, h5, h6, p, li, blockquote';
    // Standalone interactive/badge elements
    var EXTRA_SELECTORS = '.btn-cta, .btn-secondary, .hero-badge, .filter-btn, .blog-tag, .blog-read-more, .stat-item, label';
    // Never tilt these parents
    var EXCLUDE_PARENTS = ['.tilt-toggle', '.tilt-tooltip', '#google_translate_element', '.skiptranslate', '.goog-te-banner-frame'];

    // ─── STATE ────────────────────────────────────────────────────────
    var isActive = false;
    var isGyroAvailable = false;
    var isMouseFallback = false;
    var animFrameId = null;
    var gyroCheckTimer = null;
    var toggleBtn = null;
    var tooltipEl = null;
    var tooltipTimer = null;

    // Tilt input
    var rawTilt = { gamma: 0, beta: 0 };
    var smoothTilt = { gamma: 0, beta: 0 };
    var initialBeta = null;
    var prevSmoothGamma = 0;
    var prevSmoothBeta = 0;

    // Stillness
    var lastSignificantChange = 0;
    var isReturning = false;

    // Per-element physics states
    var elementStates = [];

    // Mouse/touch fallback
    var windowCenter = { x: 0, y: 0 };
    var touchStart = null;

    // ─── UTILITIES ────────────────────────────────────────────────────
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function rand(lo, hi) { return lo + Math.random() * (hi - lo); }

    function isExcluded(el) {
        for (var i = 0; i < EXCLUDE_PARENTS.length; i++) {
            if (el.closest && el.closest(EXCLUDE_PARENTS[i])) return true;
        }
        return false;
    }

    // ─── DOM: TOGGLE BUTTON ───────────────────────────────────────────
    function createToggleButton() {
        toggleBtn = document.createElement('button');
        toggleBtn.className = 'tilt-toggle';
        toggleBtn.setAttribute('aria-label', 'Toggle tilt water effect');
        toggleBtn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">' +
                '<path d="M2 7c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>' +
                '<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>' +
                '<path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>' +
            '</svg>';
        toggleBtn.addEventListener('click', handleToggle);
        document.body.appendChild(toggleBtn);
    }

    function showTooltip(text) {
        if (tooltipTimer) clearTimeout(tooltipTimer);
        if (tooltipEl) tooltipEl.remove();

        tooltipEl = document.createElement('div');
        tooltipEl.className = 'tilt-tooltip';
        tooltipEl.textContent = text;
        document.body.appendChild(tooltipEl);

        requestAnimationFrame(function () {
            if (tooltipEl) tooltipEl.classList.add('show');
        });

        tooltipTimer = setTimeout(function () {
            if (tooltipEl) {
                tooltipEl.classList.remove('show');
                setTimeout(function () {
                    if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
                }, 300);
            }
        }, CONFIG.tooltipDuration);
    }

    // ─── DOM: COLLECT TEXT ELEMENTS ────────────────────────────────────
    function collectTextElements() {
        var sel = TEXT_SELECTORS + ', ' + EXTRA_SELECTORS;
        var els = document.querySelectorAll(sel);
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
        var pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 1);

        elementStates = [];

        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (isExcluded(el)) continue;
            if (!el.textContent || !el.textContent.trim()) continue;
            if (el.offsetParent === null && el.style.position !== 'fixed') continue;

            var rect = el.getBoundingClientRect();
            var elY = rect.top + scrollTop;
            var normalizedY = clamp(elY / pageHeight, 0, 1);

            // Water-layer depth (random) — affects displacement magnitude
            var depth = rand(CONFIG.depthRange[0], CONFIG.depthRange[1]);

            // Wave propagation — top elements respond faster, bottom slower
            var waveMult = lerp(CONFIG.waveStiffnessRange[1], CONFIG.waveStiffnessRange[0], normalizedY);

            el.classList.add('tilt-el');

            elementStates.push({
                el: el,
                depth: depth,
                waveMult: waveMult,
                posX: 0, posY: 0,
                velX: 0, velY: 0
            });
        }
    }

    // ─── DOM: RESET TRANSFORMS ────────────────────────────────────────
    function resetAllTransforms() {
        for (var i = 0; i < elementStates.length; i++) {
            var s = elementStates[i];
            s.el.style.transform = '';
            s.el.style.opacity = '';
            s.el.classList.remove('tilt-el');
        }
        elementStates = [];
    }

    // ─── DEVICE ORIENTATION ───────────────────────────────────────────
    function handleOrientation(e) {
        // Some devices fire the event with null values even if they lack a gyro
        if (e.gamma === null && e.beta === null) return;
        
        isGyroAvailable = true;
        if (initialBeta === null) initialBeta = e.beta || 0;
        rawTilt.gamma = e.gamma || 0;
        rawTilt.beta = e.beta || 0;
    }

    function requestGyroPermission() {
        return new Promise(function (resolve) {
            if (typeof DeviceOrientationEvent !== 'undefined' &&
                typeof DeviceOrientationEvent.requestPermission === 'function') {
                DeviceOrientationEvent.requestPermission()
                    .then(function (r) { resolve(r === 'granted'); })
                    .catch(function () { resolve(false); });
            } else {
                resolve(true);
            }
        });
    }

    // ─── MOUSE FALLBACK ──────────────────────────────────────────────
    function handleMouseMove(e) {
        rawTilt.gamma = ((e.clientX - windowCenter.x) / windowCenter.x) * 38;
        rawTilt.beta  = ((e.clientY - windowCenter.y) / windowCenter.y) * 28 + (initialBeta || 0);
    }

    function updateWindowCenter() {
        windowCenter.x = window.innerWidth / 2;
        windowCenter.y = window.innerHeight / 2;
    }

    // ─── TOUCH FALLBACK (old devices) ─────────────────────────────────
    function handleTouchStart(e) {
        if (e.touches.length === 1) {
            touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }

    function handleTouchMove(e) {
        if (!touchStart || e.touches.length !== 1) return;
        var dx = e.touches[0].clientX - touchStart.x;
        var dy = e.touches[0].clientY - touchStart.y;
        rawTilt.gamma = clamp(dx * 0.35, -38, 38);
        rawTilt.beta  = clamp(dy * 0.35, -28, 28) + (initialBeta || 0);
    }

    function handleTouchEnd() {
        touchStart = null;
        // Let text flow back naturally via stillness detection
        rawTilt.gamma = 0;
        rawTilt.beta  = initialBeta || 0;
    }

    // ─── PHYSICS LOOP ─────────────────────────────────────────────────
    function physicsLoop() {
        if (!isActive) return;

        // 1 ── Smooth the raw tilt (low-pass filter)
        smoothTilt.gamma = lerp(smoothTilt.gamma, rawTilt.gamma, CONFIG.smoothingFactor);
        smoothTilt.beta  = lerp(smoothTilt.beta,  rawTilt.beta,  CONFIG.smoothingFactor);

        // 2 ── Stillness detection
        var dg = Math.abs(smoothTilt.gamma - prevSmoothGamma);
        var db = Math.abs(smoothTilt.beta  - prevSmoothBeta);
        prevSmoothGamma = smoothTilt.gamma;
        prevSmoothBeta  = smoothTilt.beta;

        if (dg + db > CONFIG.stillnessThreshold) {
            lastSignificantChange = Date.now();
            if (isReturning) {
                isReturning = false;
                for (var r = 0; r < elementStates.length; r++) {
                    elementStates[r].el.style.opacity = '';
                }
            }
        } else if (!isReturning && Date.now() - lastSignificantChange > CONFIG.stillnessDelay) {
            isReturning = true;
            for (var o = 0; o < elementStates.length; o++) {
                elementStates[o].el.style.opacity = String(CONFIG.opacityDuringReturn);
            }
        }

        // 3 ── Effective tilt (relative to initial hold angle)
        var effGamma = smoothTilt.gamma;
        var effBeta  = smoothTilt.beta - (initialBeta || 0);

        // 4 ── Per-element physics
        var stiffBase = isReturning ? CONFIG.returnStiffness : CONFIG.springStiffness;
        var dampBase  = isReturning ? CONFIG.returnDamping   : CONFIG.damping;
        var allSettled = true;

        for (var i = 0; i < elementStates.length; i++) {
            var s = elementStates[i];

            // Target position — tilt angle mapped to displacement
            var tgtX, tgtY;
            if (isReturning) {
                tgtX = 0;
                tgtY = 0;
            } else {
                tgtX = (effGamma / 45) * CONFIG.maxDisplacement * s.depth * CONFIG.tiltSensitivity;
                tgtY = (effBeta  / 45) * CONFIG.maxDisplacement * s.depth * CONFIG.tiltSensitivity;
            }

            // Spring stiffness modulated by wave propagation factor
            var k = stiffBase * s.waveMult;

            // Spring force  →  semi-implicit Euler integration
            var fx = (tgtX - s.posX) * k;
            var fy = (tgtY - s.posY) * k;

            s.velX = (s.velX + fx) * dampBase;
            s.velY = (s.velY + fy) * dampBase;

            s.posX += s.velX;
            s.posY += s.velY;

            // Clamp
            s.posX = clamp(s.posX, -CONFIG.maxDisplacement, CONFIG.maxDisplacement);
            s.posY = clamp(s.posY, -CONFIG.maxDisplacement, CONFIG.maxDisplacement);

            // Subtle rotation from horizontal velocity (water swirl)
            var rot = clamp(s.velX * CONFIG.rotationFactor, -3, 3);

            // Apply GPU-accelerated transform
            s.el.style.transform = 'translate3d(' +
                s.posX.toFixed(2) + 'px,' +
                s.posY.toFixed(2) + 'px,0) rotate(' +
                rot.toFixed(2) + 'deg)';

            // Settled check
            var dist  = Math.sqrt(s.posX * s.posX + s.posY * s.posY);
            var speed = Math.sqrt(s.velX * s.velX + s.velY * s.velY);
            if (dist > 0.25 || speed > 0.08) allSettled = false;
        }

        // 5 ── All settled during return → snap to zero, restore opacity
        if (isReturning && allSettled) {
            for (var j = 0; j < elementStates.length; j++) {
                var st = elementStates[j];
                st.posX = 0; st.posY = 0;
                st.velX = 0; st.velY = 0;
                st.el.style.transform = 'translate3d(0,0,0)';
                st.el.style.opacity = '';
            }
            isReturning = false;
        }

        animFrameId = requestAnimationFrame(physicsLoop);
    }

    // ─── ACTIVATE / DEACTIVATE ────────────────────────────────────────
    function activate() {
        isActive = true;
        isReturning = false;
        initialBeta = null;
        lastSignificantChange = Date.now();
        smoothTilt = { gamma: 0, beta: 0 };
        rawTilt    = { gamma: 0, beta: 0 };
        prevSmoothGamma = 0;
        prevSmoothBeta  = 0;

        collectTextElements();
        if (elementStates.length === 0) {
            showTooltip('No text found on page');
            isActive = false;
            return;
        }

        requestGyroPermission().then(function (granted) {
            if (!isActive) return; // toggled off during async wait

            if (granted) {
                window.addEventListener('deviceorientation', handleOrientation, true);
                isGyroAvailable = false;

                gyroCheckTimer = setTimeout(function () {
                    if (!isGyroAvailable && isActive) enableFallback();
                }, CONFIG.gyroDetectTimeout);
            } else {
                enableFallback();
            }

            animFrameId = requestAnimationFrame(physicsLoop);
            toggleBtn.classList.add('active');
            showTooltip('\uD83C\uDF0A Tilt your device!');
        });
    }

    function enableFallback() {
        isMouseFallback = true;
        initialBeta = 0;
        updateWindowCenter();

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('resize', updateWindowCenter);
        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchmove',  handleTouchMove,  { passive: true });
        window.addEventListener('touchend',   handleTouchEnd);

        showTooltip('\uD83D\uDDB1\uFE0F Move mouse or drag to flow!');
    }

    function deactivate() {
        isActive = false;

        if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
        if (gyroCheckTimer) { clearTimeout(gyroCheckTimer); gyroCheckTimer = null; }

        window.removeEventListener('deviceorientation', handleOrientation, true);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('resize', updateWindowCenter);
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove',  handleTouchMove);
        window.removeEventListener('touchend',   handleTouchEnd);

        resetAllTransforms();

        isMouseFallback = false;
        isGyroAvailable = false;
        isReturning = false;
        initialBeta = null;
        rawTilt    = { gamma: 0, beta: 0 };
        smoothTilt = { gamma: 0, beta: 0 };

        toggleBtn.classList.remove('active');
        showTooltip('Effect disabled');
    }

    // ─── TOGGLE ───────────────────────────────────────────────────────
    function handleToggle() {
        if (isActive) deactivate();
        else activate();
    }

    // ─── INIT ─────────────────────────────────────────────────────────
    function init() {
        createToggleButton();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
