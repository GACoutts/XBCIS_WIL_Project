import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Mock user data
const mockUser = {
  username: "admin",
  password: "password123"
};

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (username === mockUser.username && password === mockUser.password) {
    return res.json({ username: mockUser.username });
  } else {
    return res.status(401).json({ message: "Invalid username or password" });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Backend running on :) http://localhost:${PORT}`);
});
