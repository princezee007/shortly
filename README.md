# 🔗 Shortly - Free URL Shortener with Analytics

A fast, free, and ad-supported URL shortener with comprehensive analytics, QR code generation, and advanced features. Built with Node.js, Express, and MongoDB.

## ✨ Features

### 🔗 Core URL Shortening
- **Instant URL Shortening**: Convert long URLs to short, memorable links
- **Custom Aliases**: Create branded short links with custom aliases
- **Bulk Shortening**: Upload CSV files or paste multiple URLs
- **QR Code Generation**: Automatic QR codes for every shortened URL
- **Link Expiration**: Set optional expiry dates for temporary links
- **Password Protection**: Secure sensitive links with passwords

### 📊 Advanced Analytics
- **Detailed Click Tracking**: Total clicks, recent activity, and trends
- **Geographic Data**: Track clicks by country and region
- **Device Analytics**: Monitor desktop, mobile, and tablet usage
- **Referrer Tracking**: See where your traffic comes from
- **7-Day Charts**: Visual analytics with daily click graphs
- **Real-time Updates**: Live analytics dashboard

### 💰 Monetization Features
- **Ad Integration**: Strategic ad placements for revenue
- **Interstitial Ads**: 3-second delay with skip option
- **Banner Advertisements**: Homepage and sidebar ad spaces
- **AdSense Ready**: Easy integration with Google AdSense
- **Non-intrusive**: User-friendly ad experience

### 🔒 Security & Performance
- **Rate Limiting**: Prevent abuse with intelligent rate limiting
- **Input Validation**: Comprehensive URL and data validation
- **Security Headers**: Helmet.js for enhanced security
- **CORS Support**: Cross-origin resource sharing
- **Error Handling**: Graceful error management
- **Performance Optimized**: Fast redirects and minimal latency

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/shortly.git
   cd shortly
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI and other settings
   ```

4. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## 📁 Project Structure

```
shortly/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── .env                   # Environment configuration
├── README.md              # Project documentation
└── public/                # Frontend files
    ├── index.html         # Main homepage
    ├── app.js             # Frontend JavaScript
    ├── 404.html           # Error page
    └── password.html      # Password protection page
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|----------|
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/shortly` |
| `JWT_SECRET` | JWT signing secret | Required |
| `BASE_URL` | Base URL for short links | `http://localhost:3000` |
| `ENABLE_ADS` | Enable ad integration | `true` |
| `AD_INTERSTITIAL_DELAY` | Ad delay in seconds | `3` |
| `MAX_BULK_URLS` | Max URLs per bulk operation | `100` |

### MongoDB Setup

#### Local MongoDB
```bash
# Install MongoDB Community Edition
# Start MongoDB service
mongod --dbpath /path/to/data/directory
```

#### MongoDB Atlas (Cloud)
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Get connection string
4. Update `MONGODB_URI` in `.env`

## 🌐 API Endpoints

### URL Shortening
- `POST /api/shorten` - Create short URL
- `POST /api/bulk-shorten` - Bulk URL shortening
- `POST /api/verify-password` - Verify password for protected URLs

### Analytics
- `GET /api/analytics/:shortCode` - Get URL analytics

### Redirects
- `GET /:shortCode` - Redirect to original URL

## 📊 Analytics Dashboard

The analytics dashboard provides comprehensive insights:

- **Total Clicks**: Lifetime click count
- **Recent Activity**: Last 7 days performance
- **Geographic Distribution**: Clicks by country
- **Device Breakdown**: Desktop vs Mobile vs Tablet
- **Referrer Analysis**: Traffic sources
- **Daily Trends**: Click patterns over time

## 💰 Monetization Strategy

### Ad Placements
1. **Homepage Banner**: 728x90 leaderboard ad
2. **Sidebar Ads**: 300x250 medium rectangle
3. **Interstitial Ads**: Full-screen with 3-second timer
4. **Mobile Ads**: Responsive ad units

### Revenue Optimization
- **AdSense Integration**: Easy Google AdSense setup
- **Direct Sponsors**: Custom ad placement options
- **A/B Testing**: Optimize ad performance
- **User Experience**: Balance ads with usability

## 🔒 Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Sanitization**: Prevent XSS and injection attacks
- **Password Hashing**: Secure password storage (upgrade to bcrypt recommended)
- **HTTPS Ready**: SSL/TLS support
- **Security Headers**: Comprehensive security headers via Helmet.js

## 🚀 Deployment

### Vercel (Frontend)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Railway (Backend)
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway deploy
```

### Heroku
```bash
# Install Heroku CLI
# Login to Heroku
heroku login

# Create app
heroku create shortly-app

# Set environment variables
heroku config:set MONGODB_URI=your-mongodb-uri
heroku config:set JWT_SECRET=your-jwt-secret

# Deploy
git push heroku main
```

### Docker
```dockerfile
# Dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📈 Performance Optimization

- **Database Indexing**: Optimized MongoDB indexes
- **Caching**: Redis caching for frequent lookups
- **CDN**: Static asset delivery via CDN
- **Compression**: Gzip compression for responses
- **Minification**: Minified CSS and JavaScript

## 🔮 Future Enhancements

### Planned Features
- [ ] **API Access**: RESTful API with authentication
- [ ] **User Accounts**: Registration and dashboard
- [ ] **Team Features**: Collaborative link management
- [ ] **Advanced Analytics**: Conversion tracking, A/B testing
- [ ] **Custom Domains**: Branded short domains
- [ ] **Webhook Integration**: Real-time notifications
- [ ] **Mobile App**: iOS and Android applications

### Technical Improvements
- [ ] **Redis Caching**: Performance optimization
- [ ] **Microservices**: Scalable architecture
- [ ] **GraphQL API**: Modern API interface
- [ ] **Real-time Analytics**: WebSocket-based updates
- [ ] **Machine Learning**: Click prediction and optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **QR Code API**: QR Server for QR code generation
- **GeoIP**: MaxMind GeoLite2 for geographic data
- **Icons**: Emoji icons for beautiful UI
- **Inspiration**: Bitly, TinyURL, and other URL shorteners

## 📞 Support

- **Documentation**: Check this README and inline comments
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join GitHub Discussions for questions
- **Email**: contact@shortly.link (replace with your email)

---

**Made with ❤️ by the Shortly Team**

*Shorten URLs. Track Performance. Earn Revenue.*