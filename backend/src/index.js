const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Dogwash backend is healthy' });
});

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
