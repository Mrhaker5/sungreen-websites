// 1. Counters Animation
const counters = document.querySelectorAll('.counter');
let started = false;

function runCounters() {
    if (started) return;
    
    counters.forEach(counter => {
        const target = parseFloat(counter.getAttribute('data-target'));
        const isFloat = target % 1 !== 0; 
        let count = 0;
        const duration = 2000; 
        const interval = 20; 
        const steps = duration / interval;
        const increment = target / steps;

        const timer = setInterval(() => {
            count += increment;
            
            if (count >= target) {
                counter.textContent = isFloat ? target.toFixed(1) + "+" : target + "+";
                clearInterval(timer);
            } else {
                counter.textContent = isFloat ? count.toFixed(1) : Math.floor(count);
            }
        }, interval);
    });
    started = true;
}

// Trigger counters when scrolled into view
window.addEventListener('scroll', () => {
    const section = document.getElementById('impact');
    if(section) {
        const sectionPos = section.getBoundingClientRect().top;
        const screenPos = window.innerHeight / 1.3;
        if (sectionPos < screenPos) {
            runCounters();
        }
    }
});

// 2. Mobile Menu Toggle
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('nav-menu');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        
        // Animate hamburger lines
        const spans = hamburger.querySelectorAll('span');
        if(navMenu.classList.contains('active')) {
            spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
        } else {
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        }
    });
}

// Close mobile menu when a link is clicked
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        // Reset hamburger
        const spans = hamburger.querySelectorAll('span');
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
    });
});