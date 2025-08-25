module.exports = {
  BASE_URL: process.env.BASE_URL || (process.env.NODE_ENV === 'production' 
    ? 'https://your-app-name.herokuapp.com' // Update this with your actual domain
    : 'http://localhost:3000')
};