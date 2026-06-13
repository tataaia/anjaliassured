document.addEventListener('DOMContentLoaded', () => {
    // 0. Language Switcher Logic (Google Translate integration)
    const langBtns = document.querySelectorAll('.lang-btn');
    
    // Read the googtrans cookie to determine the current language
    function getTranslationCookie() {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; googtrans=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // Set translation cookie and trigger page-wide translation reload
    function setLanguage(lang) {
        // Formats: /en/en, /en/hi
        const cookieValue = `/en/${lang}`;
        
        // Write the cookie across the whole domain
        document.cookie = `googtrans=${cookieValue}; path=/;`;
        document.cookie = `googtrans=${cookieValue}; path=/; domain=.github.io;`;
        document.cookie = `googtrans=${cookieValue}; path=/; domain=${window.location.hostname};`;
        
        // Update active class state on the buttons
        langBtns.forEach(btn => {
            if (btn.getAttribute('data-lang') === lang) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Fire Google Translate API dynamically if loaded, or reload the page to apply
        const googleCombo = document.querySelector('select.goog-te-combo');
        if (googleCombo) {
            googleCombo.value = lang;
            googleCombo.dispatchEvent(new Event('change'));
        } else {
            // Fallback: Reload page to let the browser pick up the cookie
            window.location.reload();
        }
    }

    // Check active language on load and sync switcher UI
    const currentLangCookie = getTranslationCookie();
    let activeLang = 'en';
    if (currentLangCookie) {
        const parts = currentLangCookie.split('/');
        activeLang = parts[parts.length - 1] || 'en';
    }

    langBtns.forEach(btn => {
        const lang = btn.getAttribute('data-lang');
        if (lang === activeLang) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            setLanguage(lang);
        });
    });

    // 1. Mobile Menu Toggle & Close on click
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    function closeMobileMenu() {
        if (navLinks.classList.contains('active')) {
            navLinks.classList.remove('active');
            hamburger.classList.remove('active');
            
            const spans = hamburger.querySelectorAll('span');
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        }
    }

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            hamburger.classList.toggle('active');
            
            // Hamburger animation to create X mark
            const spans = hamburger.querySelectorAll('span');
            if (hamburger.classList.contains('active')) {
                spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
            } else {
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });

        // Close mobile menu automatically when any link inside it is clicked
        const menuLinks = navLinks.querySelectorAll('a');
        menuLinks.forEach(link => {
            link.addEventListener('click', () => {
                closeMobileMenu();
            });
        });
    }

    // 2. Active Page Highlighting
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-links a');
    navItems.forEach(link => {
        const href = link.getAttribute('href');
        if (currentPath.includes(href) && href !== 'index.html') {
            link.classList.add('active');
        } else if (href === 'index.html' && (currentPath.endsWith('/') || currentPath.endsWith('index.html') || currentPath === '')) {
            link.classList.add('active');
        }
    });

    // 3. Blog Category Filter
    const filterButtons = document.querySelectorAll('.filter-btn');
    const blogCards = document.querySelectorAll('.blog-card');

    if (filterButtons.length > 0 && blogCards.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from other buttons
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                const filterValue = button.getAttribute('data-filter');

                blogCards.forEach(card => {
                    const category = card.getAttribute('data-category');
                    if (filterValue === 'all' || category === filterValue) {
                        card.style.display = 'flex';
                        // Trigger fade in animation
                        card.style.opacity = '0';
                        setTimeout(() => {
                            card.style.opacity = '1';
                            card.style.transition = 'opacity 0.4s ease';
                        }, 50);
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });
    }

    // 4. Secure AJAX Form Submission to FormSubmit.co (Protects Email & Phone Privacy)
    const contactForm = document.getElementById('advisorContactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = document.getElementById('name').value;
            const phone = document.getElementById('phone').value;
            const email = document.getElementById('email').value;
            const plan = document.getElementById('plan').value;
            const message = document.getElementById('message').value;

            if (!name || !phone) {
                alert('Please fill out your Name and Phone number.');
                return;
            }

            // Map plan values to reader-friendly text
            let planText = "General Consultation";
            if (plan === "term-insurance") planText = "Pure Term Protection Plan";
            else if (plan === "savings-wealth") planText = "Guaranteed Savings & Wealth";
            else if (plan === "retirement-plan") planText = "Retirement & Pension Plan";
            else if (plan === "child-future") planText = "Child Education Plan";

            // FormSubmit Endpoint using the secure hash token provided by FormSubmit.co
            const formToken = "4cc09cdcead4659c325e2d9935853130"; 
            const submitEndpoint = `https://formsubmit.co/ajax/${formToken}`;

            // Show a loading/submitting state
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = "Submitting Request...";

            // Send form data asynchronously in the background
            fetch(submitEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    _subject: `New Lead: Callback Request from ${name}`,
                    Name: name,
                    Phone: phone,
                    Email: email || "Not Provided",
                    "Interested Plan": planText,
                    Message: message || "None"
                })
            })
            .then(response => {
                // Display premium green tick checkmark success state
                const formContainer = contactForm.parentElement;
                formContainer.innerHTML = `
                    <div style="text-align: center; padding: 3rem 1.5rem; color: var(--primary);">
                        <svg class="success-checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                            <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                            <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                        </svg>
                        <h3 style="margin-bottom: 1rem; font-size: 1.75rem;">Request Submitted!</h3>
                        <p style="color: var(--text-muted); margin-bottom: 2rem; max-width: 450px; margin-left: auto; margin-right: auto;">
                            Your callback request has been sent successfully. We will review your application and contact you shortly.
                        </p>
                        <button id="resetFormBtn" class="btn-secondary">Submit Another Request</button>
                    </div>
                `;

                document.getElementById('resetFormBtn').addEventListener('click', () => {
                    document.location.reload();
                });
            })
            .catch(error => {
                console.error("Submission failed:", error);
                alert("Something went wrong. Please check your internet connection and try again.");
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            });
        });
    }

    // 5. Floating Action Button Scroll Visibility Behavior
    const floatingCta = document.querySelector('.floating-cta');
    if (floatingCta) {
        const checkScroll = () => {
            // Check if we are on contact page and the contact form/wrapper is visible
            const contactSection = document.getElementById('contact') || document.getElementById('advisorContactForm');
            if (contactSection) {
                const rect = contactSection.getBoundingClientRect();
                // Hide if contact section is visible in the viewport
                if (rect.top < window.innerHeight - 100) {
                    floatingCta.classList.add('hidden');
                    return;
                }
            }

            // Also hide if close to the footer at the bottom of the page
            const documentHeight = document.documentElement.scrollHeight;
            const scrollPosition = window.innerHeight + window.scrollY;
            if (documentHeight - scrollPosition < 300) {
                floatingCta.classList.add('hidden');
            } else {
                floatingCta.classList.remove('hidden');
            }
        };

        window.addEventListener('scroll', checkScroll, { passive: true });
        window.addEventListener('resize', checkScroll);
        // Run once initially
        checkScroll();
    }
});
