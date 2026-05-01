const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// MySQL connection config
const dbConfig = {
  host: process.env.DB_HOST || 'mysql-service',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD || 'apppass123',
  database: process.env.DB_NAME || 'appdb'
};

let pool;

// Initialize database connection
async function initDB() {
  try {
    pool = mysql.createPool(dbConfig);
    
    // Create table if not exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✓ Database connected and table created');
  } catch (error) {
    console.error('Database connection error:', error);
    setTimeout(initDB, 5000); // Retry after 5 seconds
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM users ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add new user
app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ success: false, error: 'Name and email are required' });
  }
  
  try {
    const [result] = await pool.execute(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [name, email]
    );
    
    res.json({ 
      success: true, 
      data: { id: result.insertId, name, email }
    });
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ Backend API running on port ${PORT}`);
  });
});
