module.exports = {
  BASE_URL: process.env.NODE_ENV === 'production'
    ? process.env.BASE_URL || 'https://yourdomain.com'
    : process.env.BASE_URL || 'http://localhost:3001'
};