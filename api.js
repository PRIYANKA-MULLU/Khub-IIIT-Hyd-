import axios from 'axios';

const API_URL = 'http://localhost:5001'; // Ensure this matches your server's address

export const login = async (email, password) => {
  const response = await axios.post(`${API_URL}/login`, { email, password });
  return response.data; // Token
};

export const getUserDetails = async (token) => {
  const response = await axios.get(`${API_URL}/user-details`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data; // User details
};
