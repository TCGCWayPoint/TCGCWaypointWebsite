const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();
const port = 3000; // Using your original port

// 1. CORS Configuration - Update this to match your needs
app.use(cors({
    origin: '*' // Allow all origins for testing
    // For production, specify exact origin like:
    // origin: 'http://192.168.1.114:5500'
}));

// 2. Static Files Middleware - CRITICAL FIX
app.use(express.static(__dirname)); // Serves ALL files in project root

// 3. Explicit Route for Your HTML File
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'tcgcWayPoint.html'));
});

// 4. Server Startup - Using your current IP
const HOST = '192.168.5.206'; // Use your actual IP
app.listen(port, HOST, () => {
    console.log(`Server running at:
    - Computer: http://localhost:${port}
    - Phone: http://${HOST}:${port}`);
});