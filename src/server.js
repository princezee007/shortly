const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const path = require('path');
const config = require('./config');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "https://www.googletagmanager.com", "'unsafe-inline'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'"],
      upgradeInsecureRequests: [],
      // Allow navigation to any URL for redirects
      navigateTo: null
    },
  },
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
// Trust proxy for accurate IPs behind reverse proxies/CDNs
app.set('trust proxy', 1);

// Dynamic base URL detection middleware
app.use((req, res, next) => {
  req.BASE_URL = `${req.protocol}://${req.get('host')}`;
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// MongoDB connection with error handling
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shortly', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).catch(err => {
  console.warn('MongoDB connection failed:', err.message);
  console.log('Running in demo mode without database functionality');
});

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.warn('MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('Disconnected from MongoDB');
});

// Global variable to track database availability
let dbAvailable = false;
mongoose.connection.on('connected', () => {
  dbAvailable = true;
});
mongoose.connection.on('error', () => {
  dbAvailable = false;
});
mongoose.connection.on('disconnected', () => {
  dbAvailable = false;
});

// URL Schema
const urlSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: true
  },
  shortCode: {
    type: String,
    required: true,
    unique: true
  },
  customAlias: {
    type: String,
    unique: true,
    sparse: true
  },

  expiryDate: {
    type: Date,
    default: null
  },
  clicks: {
    type: Number,
    default: 0
  },
  analytics: [{
    timestamp: { type: Date, default: Date.now },
    ip: String,
    userAgent: String,
    referrer: String,
    country: String,
    device: String,
    browser: String
  }],
  metaTitle: String,
  metaDescription: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Url = mongoose.model('Url', urlSchema);

// Helper functions
const generateShortCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const getDeviceType = (userAgent) => {
  if (/mobile/i.test(userAgent)) return 'Mobile';
  if (/tablet/i.test(userAgent)) return 'Tablet';
  return 'Desktop';
};

// Record analytics helper (shared by routes)
const recordAnalytics = async (req, urlDoc) => {
  try {
    const geoip = require('geoip-lite');
    const useragent = require('useragent');
    const ip = (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '').toString();
    const geo = ip ? geoip.lookup(ip) : null;
    const agent = useragent.parse(req.headers['user-agent'] || '');
    urlDoc.analytics.push({
      ip,
      userAgent: req.headers['user-agent'] || '',
      referrer: req.headers.referer || req.headers.referrer || 'Direct',
      country: geo ? geo.country : 'Unknown',
      device: getDeviceType(req.headers['user-agent'] || ''),
      browser: agent && agent.family ? agent.family : 'Unknown'
    });
    urlDoc.clicks += 1;
    await urlDoc.save();
  } catch (err) {
    console.warn('Analytics record failed:', err?.message || err);
  }
};

// Routes

// Serve homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API: Shorten URL
app.post('/api/shorten', async (req, res) => {
  try {
    const { url, customAlias, expiresAt, metaTitle, metaDescription } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL - more permissive validation
    const urlRegex = /^https?:\/\/.+\..+/i;
    if (!urlRegex.test(url)) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Check if database is available
    if (!dbAvailable) {
      // Demo mode - return mock response
      const shortCode = customAlias || generateShortCode();
      return res.json({
        shortUrl: `${req.BASE_URL}/${shortCode}`,
        originalUrl: url,
        shortCode: shortCode,
        message: 'Demo mode - URL shortening requires database connection'
      });
    }

    let shortCode = customAlias || generateShortCode();
    
    // Check if custom alias already exists
    if (customAlias) {
      const existing = await Url.findOne({ $or: [{ shortCode: customAlias }, { customAlias }] });
      if (existing) {
        return res.status(400).json({ error: 'Custom alias already exists' });
      }
    }

    // Ensure unique short code
    while (await Url.findOne({ shortCode })) {
      shortCode = generateShortCode();
    }



    const newUrl = new Url({
      originalUrl: url,
      shortCode,
      customAlias: customAlias && customAlias.trim() ? customAlias.trim() : undefined,

      expiryDate: expiresAt ? new Date(expiresAt) : null,
      metaTitle,
      metaDescription
    });

    await newUrl.save();

    res.json({
      shortUrl: `${req.BASE_URL}/${shortCode}`,
      shortCode,
      originalUrl: url
    });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Bulk shorten URLs
app.post('/api/bulk-shorten', async (req, res) => {
  try {
    const { urls } = req.body;
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'URLs array is required' });
    }

    if (urls.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 URLs allowed per batch' });
    }

    // Check if database is available
    if (!dbAvailable) {
      // Demo mode - return mock responses
      const results = urls.slice(0, 5).map((urlData, index) => {
        const shortCode = generateShortCode();
        return {
          originalUrl: urlData.url || urlData,
          shortUrl: `${req.BASE_URL}/${shortCode}`,
          shortCode,
          message: 'Demo mode - Bulk shortening requires database connection'
        };
      });
      return res.json({ 
        results,
        message: 'Demo mode - Only first 5 URLs processed without database connection'
      });
    }

    const results = [];
    
    for (const urlData of urls) {
      try {
        const { url } = urlData;
        
        if (!url) continue;
        
        // More permissive URL validation
        const urlRegex = /^https?:\/\/.+\..+/i;
        if (!urlRegex.test(url)) continue;

        let shortCode = generateShortCode();
        while (await Url.findOne({ shortCode })) {
          shortCode = generateShortCode();
        }

        const newUrl = new Url({
          originalUrl: url,
          shortCode
        });

        await newUrl.save();

        results.push({
          originalUrl: url,
          shortUrl: `${req.BASE_URL}/${shortCode}`,
          shortCode
        });
      } catch (error) {
        console.error('Error processing URL:', error);
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Error bulk shortening URLs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Bulk upload file (CSV/TXT)
try {
  const multer = require('multer');
  const { parse } = require('csv-parse/sync');
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB
  });

  app.post('/api/bulk-upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const originalName = req.file.originalname || '';
      const mime = req.file.mimetype || '';
      const isCsv = /csv/i.test(mime) || /\.csv$/i.test(originalName);
      const isTxt = /plain/i.test(mime) || /text/i.test(mime) || /\.(txt|log)$/i.test(originalName);

      if (!isCsv && !isTxt) {
        return res.status(400).json({ error: 'Unsupported file type. Please upload CSV or TXT.' });
      }

      const content = req.file.buffer.toString('utf8');
      let rawUrls = [];

      if (isCsv) {
        try {
          const records = parse(content, {
            bom: true,
            columns: false,
            skip_empty_lines: true,
            relax_column_count: true,
            trim: true
          });
          rawUrls = records.map(row => Array.isArray(row) ? String(row[0] || '').trim() : '').filter(Boolean);
        } catch (err) {
          console.warn('CSV parse failed, falling back to line split:', err?.message);
          rawUrls = content.split(/\r?\n/).map(l => l.split(',')[0]).map(s => s.trim()).filter(Boolean);
        }
      } else {
        rawUrls = content.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      }

      // Normalize and validate URLs
      const urlRegex = /^https?:\/\/.+\..+/i;
      let urls = rawUrls
        .map(u => (u.startsWith('http://') || u.startsWith('https://')) ? u : `https://${u}`)
        .filter(u => urlRegex.test(u))
        .slice(0, 100)
        .map(url => ({ url }));

      if (urls.length === 0) {
        return res.status(400).json({ error: 'No valid URLs found in file' });
      }

      // Process using existing bulk logic style
      if (!dbAvailable) {
        const results = urls.slice(0, 5).map((urlData) => {
          const shortCode = generateShortCode();
          return {
            originalUrl: urlData.url,
            shortUrl: `${req.BASE_URL}/${shortCode}`,
            shortCode,
            message: 'Demo mode - Bulk upload requires database connection'
          };
        });
        return res.json({
          results,
          message: 'Demo mode - Only first 5 URLs processed without database connection'
        });
      }

      const results = [];
      for (const urlData of urls) {
        try {
          const url = urlData.url;
          let shortCode = generateShortCode();
          while (await Url.findOne({ shortCode })) {
            shortCode = generateShortCode();
          }
          const newUrl = new Url({ originalUrl: url, shortCode });
          await newUrl.save();
          results.push({
            originalUrl: url,
            shortUrl: `${req.protocol}://${req.get('host')}/${shortCode}`,
            shortCode
          });
        } catch (err) {
          console.warn('Error processing URL in bulk upload:', err?.message || err);
        }
      }

      res.json({ results });
    } catch (error) {
      console.error('Bulk upload error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
} catch (e) {
  console.warn('Bulk upload feature unavailable (missing dependencies):', e?.message || e);
}



// API: Get analytics
app.get('/api/analytics/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;
    
    // Check if database is available
    if (!dbAvailable) {
      return res.json({
        totalClicks: 42,
        last7Days: 15,
        countries: { 'US': 20, 'UK': 12, 'CA': 10 },
        devices: { 'Desktop': 25, 'Mobile': 15, 'Tablet': 2 },
        referrers: { 'Direct': 30, 'Google': 8, 'Twitter': 4 },
        dailyClicks: {
          '2024-01-01': 5,
          '2024-01-02': 8,
          '2024-01-03': 12,
          '2024-01-04': 6,
          '2024-01-05': 9,
          '2024-01-06': 7,
          '2024-01-07': 3
        },
        message: 'Demo data - Analytics requires database connection'
      });
    }
    
    const url = await Url.findOne({ shortCode });
    
    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }

    // Calculate analytics
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    
    const recentAnalytics = url.analytics.filter(a => a.timestamp >= last7Days);
    
    const countries = {};
    const devices = {};
    const browsers = {};
    const referrers = {};
    const dailyClicks = {};
    
    recentAnalytics.forEach(a => {
      // Countries
      countries[a.country] = (countries[a.country] || 0) + 1;
      
      // Devices
      devices[a.device] = (devices[a.device] || 0) + 1;
      // Browsers
      const browser = a.browser || 'Unknown';
      browsers[browser] = (browsers[browser] || 0) + 1;
      
      // Referrers
      const ref = a.referrer || 'Direct';
      referrers[ref] = (referrers[ref] || 0) + 1;
      
      // Daily clicks
      const day = a.timestamp.toISOString().split('T')[0];
      dailyClicks[day] = (dailyClicks[day] || 0) + 1;
    });

    res.json({
      totalClicks: url.clicks,
      recentClicks: recentAnalytics.length,
      countries,
      devices,
      browsers,
      referrers,
      dailyClicks,
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      createdAt: url.createdAt,
      expiryDate: url.expiryDate
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Redirect handler with ad interstitial
app.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;
    
    // Check if database is available
    if (!dbAvailable) {
      // Demo mode - redirect to a demo page or show message
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Shortly - Demo Mode</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .demo-message { color: #ff9800; font-size: 18px; margin: 20px 0; }
            .btn { background: #667eea; color: white; padding: 12px 24px; border: none; border-radius: 5px; text-decoration: none; display: inline-block; margin: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔗 Shortly Demo Mode</h1>
            <div class="demo-message">
              ⚠️ This is a demo environment. URL redirection requires database connection.
            </div>
            <p>Short code: <strong>${shortCode}</strong></p>
            <p>In a production environment, this would redirect you to the original URL.</p>
            <a href="/" class="btn">🏠 Back to Homepage</a>
          </div>
        </body>
        </html>
      `);
    }
    
    const url = await Url.findOne({ shortCode });
    
    if (!url) {
      return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }

    // Check if expired
    if (url.expiryDate && new Date() > url.expiryDate) {
      return res.status(410).send('This link has expired');
    }



    // Track analytics
    await recordAnalytics(req, url);

    // Show interstitial ad page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>iShortly - Redirecting...</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="monetag" content="35a1b3d5c8f9e2a4b6d8f1a3c5e7b9d2">
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            --cyber-blue: #00d4ff;
            --cyber-purple: #8b5cf6;
            --cyber-pink: #ff6b9d;
            --cyber-orange: #ff8c42;
            --cyber-yellow: #ffd23f;
            --cyber-green: #4ade80;
            --cyber-red: #ff4757;
            --dark-bg: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
            --glass-bg: rgba(255, 255, 255, 0.08);
            --glass-border: rgba(255, 255, 255, 0.15);
            --text-primary: #ffffff;
            --text-secondary: rgba(255, 255, 255, 0.7);
            --link-color: #00d4ff;
            --link-hover: #ff6b9d;
            --shadow-glow: 0 0 30px rgba(0, 212, 255, 0.4);
          }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', sans-serif;
            background: var(--dark-bg);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow-x: hidden;
          }
          
          .bg-animation {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -2;
            background: 
              radial-gradient(circle at 20% 80%, rgba(0, 212, 255, 0.12) 0%, transparent 60%),
              radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.12) 0%, transparent 60%),
              radial-gradient(circle at 40% 40%, rgba(255, 107, 157, 0.12) 0%, transparent 60%),
              radial-gradient(circle at 60% 70%, rgba(255, 140, 66, 0.08) 0%, transparent 50%);
            animation: bg-shift 15s ease-in-out infinite;
          }
          
          @keyframes bg-shift {
            0%, 100% { transform: scale(1) rotate(0deg); }
            50% { transform: scale(1.1) rotate(2deg); }
          }
          
          .bg-animation::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
              linear-gradient(45deg, transparent 24%, rgba(74, 222, 128, 0.08) 25%, rgba(74, 222, 128, 0.08) 26%, transparent 27%, transparent 74%, rgba(74, 222, 128, 0.08) 75%, rgba(74, 222, 128, 0.08) 76%, transparent 77%, transparent),
              linear-gradient(-45deg, transparent 24%, rgba(168, 85, 247, 0.08) 25%, rgba(168, 85, 247, 0.08) 26%, transparent 27%, transparent 74%, rgba(168, 85, 247, 0.08) 75%, rgba(168, 85, 247, 0.08) 76%, transparent 77%, transparent);
            background-size: 50px 50px;
            animation: grid-move 20s linear infinite;
          }
          
          @keyframes grid-move {
            0% { transform: translate(0, 0); }
            100% { transform: translate(50px, 50px); }
          }
          
          .glass {
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border);
            border-radius: 20px;
          }
          
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px;
            text-align: center;
          }
          
          .logo {
            font-family: 'Orbitron', monospace;
            font-size: 2.5rem;
            font-weight: 900;
            background: var(--primary-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 30px;
            text-shadow: var(--shadow-glow);
          }
          
          .ad-banner {
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border);
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            position: relative;
            overflow: hidden;
          }
          
          .ad-banner::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.1), transparent);
            animation: shimmer 3s infinite;
          }
          
          @keyframes shimmer {
            0% { left: -100%; }
            100% { left: 100%; }
          }
          
          .ad-banner h3 {
            color: var(--cyber-blue);
            font-size: 1.5rem;
            margin-bottom: 15px;
            font-weight: 700;
          }
          
          .ad-banner p {
            color: var(--text-secondary);
            margin-bottom: 20px;
          }
          
          .ad-space {
            background: linear-gradient(45deg, rgba(0, 212, 255, 0.1), rgba(139, 92, 246, 0.1));
            border: 2px dashed var(--cyber-blue);
            border-radius: 10px;
            padding: 40px;
            margin: 15px 0;
            color: var(--text-secondary);
            font-family: 'Orbitron', monospace;
            position: relative;
          }
          
          .countdown {
            font-size: 2rem;
            font-weight: 700;
            color: var(--cyber-blue);
            margin: 30px 0;
            text-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
            font-family: 'Orbitron', monospace;
          }
          
          .countdown #timer {
            color: var(--cyber-pink);
            font-size: 2.5rem;
            animation: pulse 1s infinite;
          }
          
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          
          .redirect-info {
            color: var(--text-secondary);
            margin: 20px 0;
          }
          
          .redirect-info p {
            margin: 10px 0;
          }
          
          .redirect-url {
            color: var(--cyber-blue);
            font-weight: 600;
            word-break: break-all;
            background: rgba(0, 212, 255, 0.1);
            padding: 10px;
            border-radius: 8px;
            margin: 15px 0;
          }
          
          .skip-link {
            display: inline-block;
            background: linear-gradient(135deg, var(--cyber-pink), var(--cyber-purple));
            color: white;
            padding: 12px 30px;
            border-radius: 25px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 20px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(255, 107, 157, 0.3);
          }
          
          .skip-link:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(255, 107, 157, 0.5);
            background: linear-gradient(135deg, var(--cyber-purple), var(--cyber-pink));
          }
        </style>
      </head>
      <body>
        <div class="bg-animation"></div>
        <div class="container glass">
          <div class="logo">🔗 iShortly</div>
          <div class="ad-banner">
            <h3>📢 Advertisement</h3>
            <p>Support free URL shortening by viewing this ad</p>
            <div class="ad-space">
              <!-- PropellerAds Banner Ad -->
              <script type="text/javascript">
                atOptions = {
                  'key' : 'your-propellerads-key-here',
                  'format' : 'iframe',
                  'height' : 90,
                  'width' : 728,
                  'params' : {}
                };
                document.write('<scr' + 'ipt type="text/javascript" src="http' + (location.protocol === 'https:' ? 's' : '') + '://www.profitabledisplaynetwork.com/your-propellerads-key-here/invoke.js"></scr' + 'ipt>');
              </script>
              <noscript>PropellerAds Banner - 728x90</noscript>
            </div>
          </div>
          <div class="countdown">Redirecting in <span id="timer">3</span> seconds...</div>
          <div class="redirect-info">
            <p>You will be redirected to:</p>
            <div class="redirect-url">${url.originalUrl}</div>
            <a href="${url.originalUrl}" id="skipLink" class="skip-link">Skip Ad & Continue</a>
          </div>
        </div>
        <script>
          let countdown = 3;
          const timer = document.getElementById('timer');
          const skipLink = document.getElementById('skipLink');
          
          const interval = setInterval(() => {
            countdown--;
            timer.textContent = countdown;
            
            if (countdown <= 0) {
              clearInterval(interval);
              window.location.href = '${url.originalUrl}';
            }
          }, 1000);
          
          skipLink.addEventListener('click', () => {
            clearInterval(interval);
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error redirecting:', error);
    res.status(500).send('Internal server error');
  }
});

// API: Generate QR Code (PNG)
app.get('/api/qr', async (req, res) => {
  try {
    const QRCode = require('qrcode');
    const data = req.query.data || '';
    if (!data) {
      return res.status(400).json({ error: 'Missing data parameter' });
    }
    const size = Math.min(parseInt(req.query.size || '200', 10), 1000);
    const color = (req.query.color || '000000').replace(/[^0-9a-f]/gi, '').slice(0, 6) || '000000';
    const bg = (req.query.bg || 'ffffff').replace(/[^0-9a-f]/gi, '').slice(0, 6) || 'ffffff';
    const margin = Math.max(0, Math.min(parseInt(req.query.margin || '1', 10), 10));

    const scale = Math.max(1, Math.round(size / 50));
    const buffer = await QRCode.toBuffer(data, {
      type: 'png',
      scale,
      margin,
      color: {
        dark: `#${color}`,
        light: `#${bg}`
      }
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buffer);
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// API: Export URLs as CSV (accepts results or shortCodes in body)
app.post('/api/export-urls', async (req, res) => {
  try {
    const { results, shortCodes } = req.body || {};

    let rows = [];

    if (Array.isArray(results) && results.length > 0) {
      // For bulk results, we need to fetch additional data from database if available
      if (dbAvailable && mongoose.connection.readyState === 1) {
        try {
          const shortCodesList = results.map(r => r.shortCode).filter(Boolean);
          const docs = await Url.find({ shortCode: { $in: shortCodesList } });
          const docMap = new Map(docs.map(d => [d.shortCode, d]));
          
          rows = results.map((r) => {
            const doc = docMap.get(r.shortCode);
            return {
              originalUrl: r.originalUrl || '',
              shortUrl: r.shortUrl || '',
              shortCode: r.shortCode || '',
              creationDate: doc ? doc.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              clickCount: doc ? doc.clicks : 0
            };
          });
        } catch (dbError) {
          console.warn('Database query failed, using results data only:', dbError.message);
          rows = results.map((r) => ({
            originalUrl: r.originalUrl || '',
            shortUrl: r.shortUrl || '',
            shortCode: r.shortCode || '',
            creationDate: new Date().toISOString().split('T')[0],
            clickCount: 0
          }));
        }
      } else {
        rows = results.map((r) => ({
          originalUrl: r.originalUrl || '',
          shortUrl: r.shortUrl || '',
          shortCode: r.shortCode || '',
          creationDate: new Date().toISOString().split('T')[0],
          clickCount: 0
        }));
      }
    } else if (Array.isArray(shortCodes) && shortCodes.length > 0) {
      if (!dbAvailable || mongoose.connection.readyState !== 1) {
        return res.status(400).json({ error: 'Database not available; provide results array instead' });
      }
      try {
        const docs = await Url.find({ shortCode: { $in: shortCodes } });
        rows = docs.map((d) => ({
          originalUrl: d.originalUrl,
          shortUrl: `${req.protocol}://${req.get('host')}/${d.shortCode}`,
          shortCode: d.shortCode,
          creationDate: d.createdAt.toISOString().split('T')[0],
          clickCount: d.clicks
        }));
      } catch (dbError) {
        console.error('Database query failed for shortCodes:', dbError.message);
        return res.status(500).json({ error: 'Database query failed' });
      }
    } else {
      return res.status(400).json({ error: 'Provide results array or shortCodes array' });
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No data to export' });
    }

    const header = 'Original URL,Short URL,Short Code,Creation Date,Click Count\n';
    const escapeCsv = (v) => String(v || '').replace(/"/g, '""');
    const csvBody = rows.map(r => `"${escapeCsv(r.originalUrl)}","${escapeCsv(r.shortUrl)}","${escapeCsv(r.shortCode)}","${escapeCsv(r.creationDate)}","${escapeCsv(r.clickCount)}"`).join('\n');
    const csvContent = header + csvBody + '\n';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="shortly_export_${Date.now()}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('CSV export error:', error);
    return res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Shortly server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the application`);
});

module.exports = app;