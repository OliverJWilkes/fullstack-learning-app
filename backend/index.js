const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Mock data
const mockUsers = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com' }
];

const mockPosts = [
  { id: 1, userId: 1, title: 'Learning React', content: 'React is great!' },
  { id: 2, userId: 2, title: 'Node.js Tips', content: 'Express makes it easy.' },
  { id: 3, userId: 1, title: 'Full Stack Dev', content: 'Frontend and backend together.' }
];

// Routes
app.get('/api/users', (req, res) => {
  res.json(mockUsers);
});

app.get('/api/users/:id', (req, res) => {
  const user = mockUsers.find(u => u.id === parseInt(req.params.id));
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.get('/api/posts', (req, res) => {
  res.json(mockPosts);
});

app.post('/api/users', (req, res) => {
  const newUser = {
    id: mockUsers.length + 1,
    name: req.body.name,
    email: req.body.email
  };
  mockUsers.push(newUser);
  res.status(201).json(newUser);
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});