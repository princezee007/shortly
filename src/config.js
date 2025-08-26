module.exports = {
  BASE_URL: process.env.BASE_URL || (process.env.NODE_ENV === 'production' 
    ? 'https://your-domain.com' // Update this with your actual Hostinger domain
    : 'http://localhost:3000')
};