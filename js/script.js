// Quote Harian
fetch('assets/quotes.json')
  .then(res => res.json())
  .then(data => {
    const quoteEl = document.getElementById('daily-quote');
    const randomIndex = Math.floor(Math.random() * data.length);
    quoteEl.textContent = data[randomIndex];

    // Share
    document.getElementById('share-whatsapp').onclick = () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(data[randomIndex])}`);
    }
    document.getElementById('share-twitter').onclick = () => {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(data[randomIndex])}`);
    }
  });

// Dark/Light Mode
const themeBtn = document.getElementById('theme-toggle');
themeBtn.onclick = () => document.body.classList.toggle('dark');

// Fade-in on scroll
const faders = document.querySelectorAll('.fade-in');
const appearOptions = { threshold: 0.2 };
const appearOnScroll = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => { if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}});
}, appearOptions);
faders.forEach(fader => appearOnScroll.observe(fader));

// Audio Toggle
const audio = document.getElementById('bg-audio');
const audioBtn = document.getElementById('audio-toggle');
audioBtn.onclick = () => { audio.paused ? audio.play() : audio.pause(); audioBtn.textContent = audio.paused ? '▶️ Audio' : '⏸️ Audio'; };

// Video Modal
const modal = document.getElementById('video-modal');
const modalVideo = document.getElementById('modal-video');
const closeBtn = document.querySelector('.close');
document.querySelectorAll('.video-item').forEach(item => {
  item.onclick = () => {
    modalVideo.src = item.dataset.video;
    modal.style.display = 'block';
  };
});
closeBtn.onclick = () => { modal.style.display = 'none'; modalVideo.src=''; };
window.onclick = e => { if(e.target==modal){modal.style.display='none'; modalVideo.src='';} };
