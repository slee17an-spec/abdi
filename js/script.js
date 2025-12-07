fetch('assets/quotes.json')
  .then(response => response.json())
  .then(data => {
    const quoteElement = document.getElementById('daily-quote');
    const randomIndex = Math.floor(Math.random() * data.length);
    quoteElement.textContent = data[randomIndex];
  })
  .catch(error => {
    console.error('Error loading quotes:', error);
    document.getElementById('daily-quote').textContent = "Hati yang tenang adalah cermin jiwa.";
  });
