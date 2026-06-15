/**
 * 016-custom-cursor-filter-4 implementation
 * Self-contained dynamic SVG displacement filter cursor.
 */

(function() {
  // Only execute in browser environment
  if (typeof window === 'undefined') return;

  document.addEventListener("DOMContentLoaded", () => {
    // 1. Create and inject SVG cursor element
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "custom-cursor");
    svg.setAttribute("width", "90");
    svg.setAttribute("height", "90");
    svg.setAttribute("viewBox", "0 0 90 90");
    
    svg.innerHTML = `
      <defs>
        <filter id="cursor-filter" x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0" numOctaves="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <circle class="custom-cursor__circle" cx="45" cy="45" r="7" filter="url(#cursor-filter)" />
    `;
    document.body.appendChild(svg);

    const circle = svg.querySelector('.custom-cursor__circle');
    const feTurbulence = svg.querySelector('feTurbulence');
    const displacementMap = svg.querySelector('feDisplacementMap');

    // 2. Add Styles dynamically
    const style = document.createElement('style');
    style.textContent = `
      .custom-cursor {
        position: fixed;
        top: 0;
        left: 0;
        width: 90px;
        height: 90px;
        margin-top: -45px;
        margin-left: -45px;
        pointer-events: none;
        z-index: 999999;
        mix-blend-mode: difference;
        transform: translate3d(-100px, -100px, 0);
        will-change: transform;
        transition: opacity 0.3s ease;
        opacity: 0;
      }
      .custom-cursor__circle {
        fill: #ffffff;
        transition: r 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      /* Hide default cursor on desktop screens to enhance look */
      @media (pointer: fine) {
        a, button, [role="button"], .menu-button, .lang-btn, .hamburger, [data-menu-toggle] {
          cursor: pointer;
        }
      }
    `;
    document.head.appendChild(style);

    // 3. Coordinate variables
    let mouse = { x: -100, y: -100 };
    let cursorX = -100;
    let cursorY = -100;
    let visible = false;

    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (!visible) {
        visible = true;
        svg.style.opacity = '1';
      }
    });

    // 4. Hover states variables
    let targetScale = 0;
    let currentScale = 0;
    let targetTurbulence = 0;
    let currentTurbulence = 0;

    // Listeners helper
    const setupListeners = () => {
      const links = document.querySelectorAll('a, button, [role="button"], .menu-button, .lang-btn, .hamburger, [data-menu-toggle], .menu-close-btn');
      links.forEach(el => {
        if (el.dataset.hasCursorListener) return;
        el.dataset.hasCursorListener = "true";

        el.addEventListener('mouseenter', () => {
          targetScale = 38;
          targetTurbulence = 0.08;
          circle.setAttribute('r', '24');
        });
        el.addEventListener('mouseleave', () => {
          targetScale = 0;
          targetTurbulence = 0;
          circle.setAttribute('r', '7');
        });
      });
    };

    // Initial setup
    setupListeners();

    // Re-check for new dynamic elements periodically (like when menu opens)
    const observer = new MutationObserver(() => {
      setupListeners();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 5. requestAnimationFrame render loop
    const render = () => {
      // Position interpolation
      cursorX += (mouse.x - cursorX) * 0.15;
      cursorY += (mouse.y - cursorY) * 0.15;
      svg.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;

      // Filter attributes interpolation
      currentScale += (targetScale - currentScale) * 0.1;
      currentTurbulence += (targetTurbulence - currentTurbulence) * 0.1;

      displacementMap.setAttribute('scale', currentScale);
      feTurbulence.setAttribute('baseFrequency', currentTurbulence);

      requestAnimationFrame(render);
    };
    render();
  });
})();
