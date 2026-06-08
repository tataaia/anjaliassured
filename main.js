document.addEventListener('DOMContentLoaded', () => {
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

    // 4. Secure Form Redirection to WhatsApp (Protects Email & Phone Privacy)
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

            // Format message for WhatsApp
            const textMessage = `Hello Anjali Devi, I have submitted a callback request on your website.%0A%0A` +
                                `*Name:* ${encodeURIComponent(name)}%0A` +
                                `*Phone:* ${encodeURIComponent(phone)}%0A` +
                                `*Email:* ${encodeURIComponent(email || 'Not Provided')}%0A` +
                                `*Interested Plan:* ${encodeURIComponent(planText)}%0A` +
                                `*Message:* ${encodeURIComponent(message || 'None')}`;

            // Success feedback state in UI
            const formContainer = contactForm.parentElement;
            formContainer.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--primary);">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 64px; height: 64px; color: var(--accent); margin: 0 auto 1.5rem;">
                        <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd" />
                    </svg>
                    <h3 style="margin-bottom: 1rem; font-size: 1.75rem;">Request Submitted!</h3>
                    <p style="color: var(--text-muted); margin-bottom: 1.5rem;">We are opening WhatsApp to securely deliver your message to Anjali Devi. Click the button below if it doesn't open automatically.</p>
                    <a href="https://wa.me/910000000000?text=${textMessage}" target="_blank" rel="noopener noreferrer" class="btn-cta" style="margin-bottom: 1rem;">Open WhatsApp Chat</a>
                    <br>
                    <button id="resetFormBtn" class="btn-secondary" style="margin-top: 1rem;">Back to form</button>
                </div>
            `;

            // Auto redirect to WhatsApp
            window.open(`https://wa.me/910000000000?text=${textMessage}`, '_blank');

            document.getElementById('resetFormBtn').addEventListener('click', () => {
                document.location.reload();
            });
        });
    }
});
