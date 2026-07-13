(() => {
  import('./app.js').catch((error) => {
    console.error('Bisikan Sufi gagal dimuat:', error);
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = 'Aplikasi gagal dimuat. Muat ulang halaman.';
      toast.classList.add('show');
    }
  });
})();
