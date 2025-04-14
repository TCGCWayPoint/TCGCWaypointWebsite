// Select the form element inside an element with class 'feedback-form' and attach an event listener for the 'submit' event
// The event listener is an asynchronous function to handle the form submission
document.querySelector('.feedback-form form').addEventListener('submit', async function(event) {
    // Prevent the default form submission behavior, which would otherwise cause a page reload
    event.preventDefault();
    
    // Get the value of the input element with ID 'name' (the user's name) from the form
    const name = document.getElementById('name').value;

    // Get the value of the input element with ID 'email' (the user's email) from the form
    const email = document.getElementById('email').value;

    // Get the value of the textarea element with ID 'feedback' (the user's feedback message) from the form
    const message = document.getElementById('feedback').value;

    // Use a try-catch block to handle potential errors during the fetch request
    try {
        // Send a POST request to the back-end server at 'http://localhost:5000/feedback'
        // The fetch API is used to make an HTTP request
        const response = await fetch('http://localhost:5000/feedback', {
            // Specify the HTTP method as POST to send data to the server
            method: 'POST',
            // Set the request headers, indicating that the body contains JSON data
            headers: { 'Content-Type': 'application/json' },
            // Convert the form data (name, email, message) into a JSON string and include it in the request body
            body: JSON.stringify({ name, email, message })
        });

        // Parse the response from the server as JSON to get the result
        const result = await response.json();

        // Check if the response status is OK (status 200-299), indicating a successful request
        if (response.ok) {
            // Display a success message from the server (e.g., "Feedback submitted successfully!")
            alert(result.message);

            // Clear the 'name' input field by setting its value to an empty string
            document.getElementById('name').value = '';

            // Clear the 'email' input field by setting its value to an empty string
            document.getElementById('email').value = '';

            // Clear the 'feedback' textarea field by setting its value to an empty string
            document.getElementById('feedback').value = '';
        } else {
            // If the response is not OK, display an error message returned by the server
            alert('Error: ' + result.message);
        }
    } catch (err) {
        // Log any fetch-related errors (e.g., network issues, server not running) to the console for debugging
        console.error('Fetch error:', err);

        // Display a generic error message to the user if the request fails
        alert('An error occurred. Please try again.');
    }
});