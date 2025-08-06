// Test server setup without database
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'MREDEO Backend is running!',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Test server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
});
