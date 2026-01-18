// main.js - UI Logic & Animations

document.addEventListener('DOMContentLoaded', () => {
    console.log("🎨 UI System Initialized (Main.js)");

    // 1. Efek Smooth Scroll untuk link navigasi
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // 2. Animasi Fade-In saat Scroll (Biar website terlihat mahal)
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Animasi cuma sekali
            }
        });
    }, observerOptions);

    // Terapkan animasi ke semua Card
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.style.opacity = "0";
        card.style.transform = "translateY(20px)";
        card.style.transition = "opacity 0.6s ease-out, transform 0.6s ease-out";
        observer.observe(card);
    });

    // Helper class untuk animasi (otomatis ditambahkan JS)
    const style = document.createElement('style');
    style.innerHTML = `
        .card.visible {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);

    // 3. Mobile Menu Toggle (Persiapan jika nanti pakai hamburger menu)
    // main.js - Sederhana buat menghambat orang awam
document.addEventListener('contextmenu', event => event.preventDefault()); // Matikan Klik Kanan
document.onkeydown = function(e) {
    if(e.keyCode == 123) return false; // Matikan F12
    if(e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) return false; // Matikan Ctrl+Shift+I
};

    // Cek apakah ada tombol menu, jika tidak ada, skip errornya
    const menuToggle = document.querySelector('.menu-toggle');
    const navUl = document.querySelector('nav ul');

    if (menuToggle && navUl) {
        menuToggle.addEventListener('click', () => {
            navUl.classList.toggle('active');
        });
    }
});
