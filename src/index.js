require('dotenv').config();
const { initApp } = require('./app');

const startServer = async () => {
  try {
    const app = await initApp();
    const port = process.env.PORT || 3000;

    app.listen(port, () => {
      console.log(`🚀 Server is running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer(); 