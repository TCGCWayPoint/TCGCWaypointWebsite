document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('feedback-form');
    if (form) {
      form.addEventListener('submit', async function(event) {
        event.preventDefault(); // Prevent default form submission
  
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const message = document.getElementById('feedback').value;
  
        try {
          const response = await fetch('/api/submit-feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, message })
          });
  
          const result = await response.json();
  
          if (response.ok) {
            alert(result.message);
            form.reset();
          } else {
            alert('Error: ' + result.message);
          }
        } catch (err) {
          console.error('Fetch error:', err);
          alert('An error occurred. Please try again.');
        }
      });
    }
  });
  