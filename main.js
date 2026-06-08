document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile Menu Toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            hamburger.classList.toggle('active');
            
            // Hamburger animation
            const spans = hamburger.querySelectorAll('span');
            if (hamburger.classList.contains('active')) {
                spans[0].style.transform = 'rotate(45deg) translate(6px, 6px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translate(6px, -6px)';
            } else {
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
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

    // 4. Simulated Contact Form Submission
    const contactForm = document.getElementById('advisorContactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = document.getElementById('name').value;
            const phone = document.getElementById('phone').value;
            const email = document.getElementById('email').value;
            const plan = document.getElementById('plan').value;
            const message = document.getElementById('message').value;

            // Simple validation
            if (!name || !phone) {
                alert('Please fill out your Name and Phone number.');
                return;
            }

            // Create a custom success alert message
            const formContainer = contactForm.parentElement;
            const originalContent = formContainer.innerHTML;

            formContainer.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--primary);">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 64px; height: 64px; color: var(--accent); margin: 0 auto 1.5rem;">
                        <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd" />
                    </svg>
                    <h3 style="margin-bottom: 1rem; font-size: 1.75rem;">Thank You, ${name}!</h3>
                    <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Your query has been submitted successfully. Anjali Devi will get back to you shortly at ${phone} or ${email}.</p>
                    <button id="resetFormBtn" class="btn-cta">Submit Another Query</button>
                </div>
            `;

            document.getElementById('resetFormBtn').addEventListener('click', () => {
                formContainer.innerHTML = originalContent;
                // Re-bind the submit listener
                document.location.reload();
            });
        });
    }
});
