// Shortly - Frontend JavaScript
// Browser Compatibility Enhancements

// Polyfill for fetch API (IE11 and older browsers)
if (!window.fetch) {
    window.fetch = function(url, options) {
        return new Promise(function(resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open(options.method || 'GET', url);
            
            if (options.headers) {
                Object.keys(options.headers).forEach(function(key) {
                    xhr.setRequestHeader(key, options.headers[key]);
                });
            }
            
            xhr.onload = function() {
                resolve({
                    ok: xhr.status >= 200 && xhr.status < 300,
                    status: xhr.status,
                    json: function() {
                        return Promise.resolve(JSON.parse(xhr.responseText));
                    },
                    text: function() {
                        return Promise.resolve(xhr.responseText);
                    }
                });
            };
            
            xhr.onerror = function() {
                reject(new Error('Network error'));
            };
            
            xhr.send(options.body || null);
        });
    };
}

// Polyfill for Promise (IE11 and older)
if (!window.Promise) {
    window.Promise = function(executor) {
        var self = this;
        self.state = 'pending';
        self.value = undefined;
        self.handlers = [];
        
        function resolve(result) {
            if (self.state === 'pending') {
                self.state = 'fulfilled';
                self.value = result;
                self.handlers.forEach(handle);
                self.handlers = null;
            }
        }
        
        function reject(error) {
            if (self.state === 'pending') {
                self.state = 'rejected';
                self.value = error;
                self.handlers.forEach(handle);
                self.handlers = null;
            }
        }
        
        function handle(handler) {
            if (self.state === 'pending') {
                self.handlers.push(handler);
            } else {
                if (self.state === 'fulfilled' && typeof handler.onFulfilled === 'function') {
                    handler.onFulfilled(self.value);
                }
                if (self.state === 'rejected' && typeof handler.onRejected === 'function') {
                    handler.onRejected(self.value);
                }
            }
        }
        
        this.then = function(onFulfilled, onRejected) {
            return new Promise(function(resolve, reject) {
                handle({
                    onFulfilled: function(result) {
                        if (onFulfilled) {
                            try {
                                resolve(onFulfilled(result));
                            } catch (ex) {
                                reject(ex);
                            }
                        } else {
                            resolve(result);
                        }
                    },
                    onRejected: function(error) {
                        if (onRejected) {
                            try {
                                resolve(onRejected(error));
                            } catch (ex) {
                                reject(ex);
                            }
                        } else {
                            reject(error);
                        }
                    }
                });
            });
        };
        
        this.catch = function(onRejected) {
            return this.then(null, onRejected);
        };
        
        executor(resolve, reject);
    };
    
    Promise.resolve = function(value) {
        return new Promise(function(resolve) {
            resolve(value);
        });
    };
    
    Promise.reject = function(error) {
        return new Promise(function(resolve, reject) {
            reject(error);
        });
    };
}

// Polyfill for Promise.prototype.finally (not supported in IE)
if (window.Promise && !Promise.prototype.finally) {
    Promise.prototype.finally = function(callback) {
        var constructor = this.constructor;
        return this.then(
            function(value) {
                return constructor.resolve(callback()).then(function() {
                    return value;
                });
            },
            function(reason) {
                return constructor.resolve(callback()).then(function() {
                    throw reason;
                });
            }
        );
    };
}

// Global variables
var currentShortUrl = '';
var analyticsRefreshTimer = null;
var analyticsRefreshEndAt = 0;
var bulkCsvObjectUrl = null;

// DOM Elements
var shortenForm = document.getElementById('shortenForm');
var loading = document.getElementById('loading');
var result = document.getElementById('result');
var qrCode = document.getElementById('qrCode');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Set minimum date to today for expiry date
    var today = new Date().toISOString().split('T')[0];
    var expiresAtElement = document.getElementById('expiresAt');
    if (expiresAtElement) {
        expiresAtElement.setAttribute('min', today);
    }
    
    // Add form submit handler
    if (shortenForm) {
        shortenForm.addEventListener('submit', handleShortenForm);
    }
    
    // Add smooth scrolling for navigation (with fallback for older browsers)
    var anchors = document.querySelectorAll('a[href^="#"]');
    for (var i = 0; i < anchors.length; i++) {
        anchors[i].addEventListener('click', function (e) {
            e.preventDefault();
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                // Check if smooth scrolling is supported
                if ('scrollBehavior' in document.documentElement.style) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                } else {
                    // Fallback for older browsers
                    target.scrollIntoView();
                }
            }
        });
    }
    
    // Add event delegation for all button and element clicks
    document.addEventListener('click', function(e) {
        var element = e.target;
        
        // Polyfill for closest() method (not supported in IE)
        while (element && element !== document) {
            if (element.getAttribute && element.getAttribute('data-action')) {
                break;
            }
            element = element.parentNode;
        }
        
        if (!element || !element.getAttribute || !element.getAttribute('data-action')) return;
        
        var action = element.getAttribute('data-action');
        
        switch(action) {
            case 'copy':
                copyToClipboard(element.getAttribute('data-url'));
                break;
            case 'generate-qr':
                if (element.getAttribute('data-url')) {
                    generateQR(element.getAttribute('data-url'));
                } else {
                    generateQR();
                }
                break;
            case 'view-analytics':
                viewAnalytics(element.getAttribute('data-code'));
                break;
            case 'download-csv':
                downloadSingleCSV(element.getAttribute('data-original'), element.getAttribute('data-short'), element.getAttribute('data-code'));
                break;
            case 'download-qr':
                downloadQR(element.getAttribute('data-qr-url'), element.getAttribute('data-original-url'));
                break;
            case 'download-bulk-qr':
                downloadBulkQRCanvas(element);
                break;
            case 'generate-bulk-qr':
                generateBulkQR(element.getAttribute('data-url'), element);
                break;
            case 'download-bulk-csv':
                downloadBulkCSV();
                break;
            case 'toggle-mobile-menu':
                toggleMobileMenu();
                break;
            case 'close-mobile-menu':
                closeMobileMenu();
                break;
            case 'start-shortening':
                const shortenerSection = document.getElementById('shortener');
                if (shortenerSection) {
                    shortenerSection.scrollIntoView({behavior: 'smooth', block: 'start'});
                }
                break;
            case 'get-analytics':
                getAnalytics();
                break;
            case 'trigger-file-upload':
                document.getElementById('csvFile').click();
                break;
            case 'bulk-shorten':
                bulkShorten();
                break;
            case 'test-csv-download':
                testCSVDownload();
                break;
        }
    });
    
    // Add file upload change listener
    const csvFileInput = document.getElementById('csvFile');
    if (csvFileInput) {
        csvFileInput.addEventListener('change', handleFileUpload);
    }
    
    // Note: Drag and drop functionality is now handled in the DOMContentLoaded event below
});

// Mobile menu functions
function toggleMobileMenu() {
    const mobileNav = document.getElementById('mobileNav');
    mobileNav.classList.toggle('active');
}

function closeMobileMenu() {
    const mobileNav = document.getElementById('mobileNav');
    mobileNav.classList.remove('active');
}

// Handle URL shortening form submission
function handleShortenForm(e) {
    e.preventDefault();
    
    var originalUrl = document.getElementById('url').value.trim();
    var customAlias = document.getElementById('customAlias').value;
    var expiresAt = document.getElementById('expiresAt').value;

    
    // Normalize and validate URL
    if (!originalUrl) {
        showResult('Please enter a URL to shorten', 'error');
        return;
    }
    
    originalUrl = normalizeUrl(originalUrl);
    
    if (!isValidUrl(originalUrl)) {
        showResult('Please enter a valid URL (e.g., example.com or https://example.com)', 'error');
        return;
    }
    
    // Show loading
    loading.style.display = 'block';
    result.style.display = 'none';
    qrCode.innerHTML = '';
    
    fetch('/api/shorten', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            url: originalUrl,
            customAlias: customAlias,
            expiresAt: expiresAt
        })
    })
    .then(function(response) {
        return response.json().then(function(data) {
            return { response: response, data: data };
        });
    })
    .then(function(result) {
        var response = result.response;
        var data = result.data;
        
        if (response.ok) {
            currentShortUrl = data.shortUrl;
            var message = '<h3>✅ URL Shortened Successfully!</h3>' +
                '<p><strong>Short URL:</strong> <a href="' + data.shortUrl + '" target="_blank" class="short-url">' + data.shortUrl + '</a></p>' +
                '<p><strong>Original URL:</strong> ' + data.originalUrl + '</p>' +
                '<p><strong>Short Code:</strong> ' + data.shortCode + '</p>';
            
            if (data.message) {
                message += '<p style="color: #ff9800; font-style: italic;">ℹ️ ' + data.message + '</p>';
            }
            
            message += '<div style="margin-top: 1rem;">' +
                '<button data-action="copy" data-url="' + data.shortUrl + '" class="btn">📋 Copy Link</button>' +
                '<button data-action="generate-qr" data-url="' + data.shortUrl + '" class="btn btn-secondary">📱 QR Code</button>' +
                '<button data-action="view-analytics" data-code="' + data.shortCode + '" class="btn btn-secondary">📊 Analytics</button>' +
                '<button data-action="download-csv" data-original="' + data.originalUrl + '" data-short="' + data.shortUrl + '" data-code="' + data.shortCode + '" class="btn btn-secondary">💾 Download CSV</button>' +
                '</div>';
            
            showResult(message, 'success');
            
            // Automatically generate QR code
            setTimeout(function() {
                generateQR(data.shortUrl);
            }, 500);
        } else {
            showResult(data.error || 'An error occurred while shortening the URL', 'error');
        }
    })
    .catch(function(error) {
        console.error('Error:', error);
        showResult('Network error. Please try again.', 'error');
    })
    .finally(function() {
        loading.style.display = 'none';
    });
}

// Validate URL format with improved browser compatibility
function isValidUrl(string) {
    // Add protocol if missing
    if (!string.startsWith('http://') && !string.startsWith('https://')) {
        string = 'https://' + string;
    }
    
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        // Fallback for browsers that don't support URL constructor
        const pattern = new RegExp('^(https?:\/\/)?'+ // protocol
            '((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|'+ // domain name
            '((\d{1,3}\.){3}\d{1,3}))'+ // OR ip (v4) address
            '(\:\d+)?(\/[-a-z\d%_.~+]*)*'+ // port and path
            '(\?[;&a-z\d%_.~+=-]*)?'+ // query string
            '(\#[-a-z\d_]*)?$','i'); // fragment locator
        return pattern.test(string);
    }
}

// Auto-fix URL format
function normalizeUrl(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return 'https://' + url;
    }
    return url;
}

// Show result message
function showResult(message, type = 'success') {
    result.innerHTML = message;
    result.className = `result ${type === 'error' ? 'error' : ''}`;
    result.style.display = 'block';
    
    // Scroll to result
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Copy to clipboard with improved browser compatibility
function copyToClipboard(text) {
    // Check if Clipboard API is available
    if (navigator.clipboard && window.isSecureContext) {
        // Use modern Clipboard API
        navigator.clipboard.writeText(text)
            .then(() => {
                showNotification('✅ Copied to clipboard!');
            })
            .catch(err => {
                console.error('Clipboard API error:', err);
                fallbackCopyToClipboard(text);
            });
    } else {
        // Use fallback method for older browsers or non-secure contexts
        fallbackCopyToClipboard(text);
    }
}

// Fallback copy method for older browsers
function fallbackCopyToClipboard(text) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // Make the textarea out of viewport
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        
        // Check if the browser supports selection
        if (document.body.createTextRange) {
            // IE
            const range = document.body.createTextRange();
            range.moveToElementText(textArea);
            range.select();
            document.execCommand('copy');
        } else if (window.getSelection && document.createRange) {
            // Non-IE browsers
            textArea.select();
            document.execCommand('copy');
        }
        
        document.body.removeChild(textArea);
        showNotification('✅ Copied to clipboard!');
    } catch (err) {
        console.error('Fallback clipboard error:', err);
        showNotification('❌ Unable to copy to clipboard. Please copy manually.');
    }
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 1rem 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Generate QR Code
function generateQR(url = currentShortUrl) {
    if (!url) {
        const inputEl = document.getElementById('url');
        const inputUrl = inputEl ? inputEl.value.trim() : '';
        if (inputUrl) {
            url = normalizeUrl(inputUrl);
        } else {
            showNotification('❌ No URL to generate QR code for');
            return;
        }
    }
    
    console.log('Generating QR code for URL:', url);
    
    // Read options
    const sizeInput = document.getElementById('qrSize');
    const colorInput = document.getElementById('qrColor');
    const bgInput = document.getElementById('qrBg');
    const size = sizeInput ? Math.max(100, Math.min(parseInt(sizeInput.value || '200', 10), 1000)) : 200;
    const colorHex = colorInput ? (colorInput.value || '#000000').replace('#','') : '000000';
    const bgHex = bgInput ? (bgInput.value || '#ffffff').replace('#','') : 'ffffff';
    
    // Use backend QR API for reliability and CORS-safe downloads
    const qrUrl = `/api/qr?size=${size}&color=${encodeURIComponent(colorHex)}&bg=${encodeURIComponent(bgHex)}&data=${encodeURIComponent(url)}`;
    
    qrCode.innerHTML = `
        <div class="qr-display-card">
            <div class="qr-header">
                <h3>📱 QR Code Generated</h3>
                <div class="qr-status">✨ Ready to Scan</div>
            </div>
            <div class="qr-image-wrapper">
                <div class="qr-glow-effect"></div>
                <img src="${qrUrl}" alt="QR Code for ${url}" class="qr-image" 
                     data-qr-url="${qrUrl}" data-original-url="${url}">
                <div class="qr-scan-overlay">
                    <div class="scan-line"></div>
                </div>
            </div>
            <div class="qr-info">
                <p class="qr-description">Scan with your phone to open the link</p>
                <div class="qr-url-preview">${url.length > 40 ? url.substring(0, 40) + '...' : url}</div>
            </div>
            <div class="qr-actions">
                <button data-action="download-qr" data-qr-url="${qrUrl}" data-original-url="${url}" class="btn qr-download-btn">
                    💾 Download QR
                </button>
                <button data-action="copy" data-url="${url}" class="btn btn-secondary qr-copy-btn">
                    📋 Copy URL
                </button>
            </div>
        </div>
    `;
    
    // Add event listeners for the QR image
    const qrImg = qrCode.querySelector('img');
    qrImg.addEventListener('load', () => {
        console.log('QR code loaded successfully');
    });
    qrImg.addEventListener('error', () => {
        console.error('Failed to load QR code');
        qrImg.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm9yIGxvYWRpbmcgUVIgY29kZTwvdGV4dD48L3N2Zz4';
    });
    
    qrCode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    showNotification('📱 QR Code generated successfully!');
}

// Download QR code from URL
function downloadQR(qrUrl, originalUrl) {
    try {
        const link = document.createElement('a');
        link.href = qrUrl;
        link.download = `qrcode-${Date.now()}.png`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (document.body.contains(link)) {
                document.body.removeChild(link);
            }
        }, 1000);
        showNotification('💾 QR code download started!');
    } catch (error) {
        console.error('QR download error:', error);
        showNotification('❌ Failed to download QR code');
    }
}

// Download QR code from canvas
// Universal download handler with fallback support
function triggerDownload(content, filename, mimeType) {
    try {
        let blob;
        if (content instanceof Blob) {
            blob = content;
        } else {
            blob = new Blob([content], { type: mimeType });
        }
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        
        // Force download
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
            if (document.body.contains(a)) {
                document.body.removeChild(a);
            }
            URL.revokeObjectURL(url);
        }, 1000);
        
        console.log('Download triggered:', filename);
        return true;
    } catch (error) {
        console.error('Download failed:', error);
        
        // Fallback: try data URL method
        try {
            let dataUrl;
            if (content instanceof Blob) {
                const reader = new FileReader();
                reader.onload = function() {
                    const a = document.createElement('a');
                    a.href = reader.result;
                    a.download = filename;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        if (document.body.contains(a)) {
                            document.body.removeChild(a);
                        }
                    }, 1000);
                };
                reader.readAsDataURL(content);
            } else {
                dataUrl = 'data:' + mimeType + ';charset=utf-8,' + encodeURIComponent(content);
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    if (document.body.contains(a)) {
                        document.body.removeChild(a);
                    }
                }, 1000);
            }
            console.log('Fallback download triggered:', filename);
            return true;
        } catch (fallbackError) {
            console.error('Fallback download also failed:', fallbackError);
            return false;
        }
    }
}

function downloadQRCanvas() {
    console.log('downloadQRCanvas called');
    
    if (!window.currentQRCanvas) {
        console.log('No currentQRCanvas found');
        showNotification('❌ No QR code to download');
        return;
    }
    
    console.log('QR Canvas found, attempting download...');
    
    try {
        // Try blob method first
        window.currentQRCanvas.toBlob((blob) => {
            if (blob) {
                console.log('Blob created successfully');
                const success = triggerDownload(blob, `qrcode-${Date.now()}.png`, 'image/png');
                if (success) {
                    showNotification('💾 QR code downloaded!');
                } else {
                    console.log('Blob download failed, trying data URL fallback');
                    downloadQRFallback();
                }
            } else {
                console.log('Blob creation failed, trying data URL fallback');
                downloadQRFallback();
            }
        }, 'image/png');
    } catch (error) {
        console.error('QR download error:', error);
        downloadQRFallback();
    }
}

function downloadQRFallback() {
    try {
        console.log('Using QR fallback download method');
        const dataURL = window.currentQRCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `qrcode-${Date.now()}.png`;
        link.href = dataURL;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (document.body.contains(link)) {
                document.body.removeChild(link);
            }
        }, 1000);
        showNotification('💾 QR code downloaded!');
        console.log('QR fallback download completed');
    } catch (error) {
        console.error('QR fallback download failed:', error);
        showNotification('❌ Failed to download QR code');
    }
}

// Generate QR code for bulk results (inline display)
function generateBulkQR(url, buttonElement) {
    if (!url) {
        showNotification('❌ No URL to generate QR code for');
        return;
    }
    
    // Find the row containing this button
    const row = buttonElement.closest('tr');
    if (!row) {
        showNotification('❌ Could not find table row');
        return;
    }
    
    // Check if QR code already exists
    let qrRow = row.nextElementSibling;
    if (qrRow && qrRow.classList.contains('qr-row')) {
        // Toggle existing QR code
        qrRow.style.display = qrRow.style.display === 'none' ? 'table-row' : 'none';
        return;
    }
    
    // Create new row for QR code
    qrRow = document.createElement('tr');
    qrRow.classList.add('qr-row');
    qrRow.innerHTML = `
        <td colspan="3" style="padding: 1rem; text-align: center; background: #f8f9fa; border: 1px solid #ddd;">
            <div class="qr-container">
                <p>Generating QR code...</p>
            </div>
        </td>
    `;
    
    // Insert after current row
    row.parentNode.insertBefore(qrRow, row.nextSibling);
    
    const qrContainer = qrRow.querySelector('.qr-container');
    
    // Create canvas for QR code
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 150;
    
    // Use backend QR API for consistency with main QR generation
    const qrUrl = `/api/qr?size=150&color=000000&bg=ffffff&data=${encodeURIComponent(url)}`;
    
    // Update container with enhanced QR display
    qrContainer.innerHTML = `
        <div class="bulk-qr-display">
            <div class="bulk-qr-wrapper">
                <img src="${qrUrl}" alt="QR Code for ${url}" class="bulk-qr-image"
                     data-qr-url="${qrUrl}" data-original-url="${url}">
                <div class="bulk-qr-overlay">
                    <div class="bulk-scan-line"></div>
                </div>
            </div>
            <button data-action="download-bulk-qr" data-qr-url="${qrUrl}" data-original-url="${url}" class="btn bulk-qr-btn">💾 Download</button>
        </div>
    `;
    
    showNotification('📱 QR code generated!');
    
    // Handle image load error
    const img = qrContainer.querySelector('img');
    img.onerror = function() {
        console.error('Failed to load QR code from backend API');
        qrContainer.innerHTML = '<p style="color: #e74c3c;">❌ Failed to generate QR code</p>';
    };
}

// Download QR code from bulk results
function downloadBulkQRCanvas(buttonElement) {
    console.log('downloadBulkQRCanvas called', buttonElement);
    
    const qrUrl = buttonElement.dataset.qrUrl;
    const originalUrl = buttonElement.dataset.originalUrl;
    
    if (!qrUrl) {
        console.log('No QR URL found on button element');
        showNotification('❌ No QR code URL found');
        return;
    }
    
    console.log('Bulk QR URL found, attempting download...', qrUrl);
    
    // Use the same download approach as the main QR function
    downloadQR(qrUrl, originalUrl);
}

function downloadBulkQRFallback(canvas) {
    try {
        console.log('Using bulk QR fallback download method');
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `qrcode-bulk-${Date.now()}.png`;
        link.href = dataURL;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (document.body.contains(link)) {
                document.body.removeChild(link);
            }
        }, 1000);
        showNotification('💾 QR code downloaded!');
        console.log('Bulk QR fallback download completed');
    } catch (error) {
        console.error('Bulk QR fallback download failed:', error);
        showNotification('❌ Failed to download QR code');
    }
}

// Get Analytics
async function getAnalytics(shortCode = null) {
    let code = shortCode || document.getElementById('analyticsCode').value;
    if (!code && currentShortUrl) {
        try {
            const u = new URL(currentShortUrl);
            code = u.pathname.replace(/^\//, '');
            document.getElementById('analyticsCode').value = code;
        } catch (_) {}
    }
    
    if (!code) {
        showNotification('❌ Please enter a short code');
        return;
    }
    
    console.log('Fetching analytics for code:', code);
    
    try {
        const response = await fetch(`/api/analytics/${code}`);
        console.log('Analytics response status:', response.status);
        const data = await response.json();
        console.log('Analytics data received:', data);
        
        if (response.ok) {
            displayAnalytics(data);
            showNotification('📊 Analytics loaded successfully!');
            // Auto-refresh for 60 seconds every 10s
            if (analyticsRefreshTimer) clearInterval(analyticsRefreshTimer);
            analyticsRefreshEndAt = Date.now() + 60000;
            analyticsRefreshTimer = setInterval(() => {
                if (Date.now() > analyticsRefreshEndAt) {
                    clearInterval(analyticsRefreshTimer);
                    return;
                }
                fetch(`/api/analytics/${code}`)
                    .then(r => r.json())
                    .then(d => displayAnalytics(d))
                    .catch(err => console.warn('Auto-refresh analytics failed:', err));
            }, 10000);
        } else {
            console.error('Analytics error response:', data);
            showNotification(`❌ ${data.error || 'Failed to fetch analytics'}`);
        }
    } catch (error) {
        console.error('Analytics fetch error:', error);
        showNotification('❌ Error fetching analytics - check console for details');
    }
}

// Display Analytics
function displayAnalytics(data) {
    const statsGrid = document.getElementById('statsGrid');
    const analyticsResults = document.getElementById('analyticsResults');
    const analyticsResult = document.getElementById('analyticsResult');
    
    // Create stats cards
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${data.totalClicks}</div>
            <div>Total Clicks</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${data.last7Days || data.recentClicks || 0}</div>
            <div>Last 7 Days</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${Object.keys(data.countries).length}</div>
            <div>Countries</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${Object.keys(data.devices).length}</div>
            <div>Device Types</div>
        </div>
    `;
    
    // Create detailed breakdown
    const chartsDiv = document.getElementById('analyticsCharts');
    chartsDiv.innerHTML = `
        <div style="margin-top: 2rem;">
            <h3>📍 Top Countries</h3>
            ${createBarChart(data.countries, 'Countries')}
            
            <h3>📱 Device Types</h3>
            ${createBarChart(data.devices, 'Devices')}
            
            ${data.browsers ? `<h3>🌐 Browsers</h3>${createBarChart(data.browsers, 'Browsers')}` : ''}
            
            <h3>🔗 Referrers</h3>
            ${createBarChart(data.referrers, 'Referrers')}
            
            <h3>📅 Daily Clicks (Last 7 Days)</h3>
            ${createLineChart(data.dailyClicks)}
            
            <div style="margin-top: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                <h4>📋 URL Details</h4>
                ${data.originalUrl ? `<p><strong>Original URL:</strong> <a href="${data.originalUrl}" target="_blank">${data.originalUrl}</a></p>` : ''}
                ${data.shortCode ? `<p><strong>Short Code:</strong> ${data.shortCode}</p>` : ''}
                ${data.createdAt ? `<p><strong>Created:</strong> ${new Date(data.createdAt).toLocaleDateString()}</p>` : ''}
                ${data.message ? `<p style="color: #ff9800; font-style: italic;">ℹ️ ${data.message}</p>` : ''}
            </div>
        </div>
    `;
    
    analyticsResults.style.display = 'block';
    if (analyticsResult) analyticsResult.style.display = 'block';
    analyticsResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Create simple bar chart
function createBarChart(data, label) {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxValue = Math.max(...entries.map(e => e[1]));
    
    return `
        <div style="margin: 1rem 0;">
            ${entries.map(([key, value]) => `
                <div style="display: flex; align-items: center; margin: 0.5rem 0;">
                    <div style="width: 120px; font-size: 0.9rem;">${key}</div>
                    <div style="flex: 1; background: #e9ecef; border-radius: 4px; margin: 0 1rem; height: 20px; position: relative;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100%; width: ${(value / maxValue) * 100}%; border-radius: 4px;"></div>
                    </div>
                    <div style="width: 40px; text-align: right; font-weight: bold;">${value}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// Create simple line chart
function createLineChart(data) {
    const entries = Object.entries(data).sort((a, b) => new Date(a[0]) - new Date(b[0]));
    const maxValue = Math.max(...entries.map(e => e[1]));
    
    return `
        <div style="margin: 1rem 0;">
            ${entries.map(([date, clicks]) => `
                <div style="display: flex; align-items: center; margin: 0.5rem 0;">
                    <div style="width: 100px; font-size: 0.9rem;">${new Date(date).toLocaleDateString()}</div>
                    <div style="flex: 1; background: #e9ecef; border-radius: 4px; margin: 0 1rem; height: 20px; position: relative;">
                        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); height: 100%; width: ${maxValue > 0 ? (clicks / maxValue) * 100 : 0}%; border-radius: 4px;"></div>
                    </div>
                    <div style="width: 40px; text-align: right; font-weight: bold;">${clicks}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// View Analytics (shortcut)
function viewAnalytics(shortCode) {
    document.getElementById('analyticsCode').value = shortCode;
    getAnalytics(shortCode);
    
    // Scroll to analytics section
    document.getElementById('analytics').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Handle file upload for bulk shortening
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['text/plain', 'text/csv', 'application/csv'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
        showNotification('❌ Please upload a CSV or TXT file');
        return;
    }
    
    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
        showNotification('❌ File too large. Maximum size is 1MB');
        return;
    }
    
    // Upload to server for parsing and processing; also populate textarea for visibility
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            document.getElementById('bulkUrls').value = content;
            document.getElementById('uploadText').textContent = `📁 ${file.name} loaded`;
        } catch (err) {
            console.warn('Preview load failed:', err);
        }
    };
    reader.readAsText(file);

    uploadFileToServer(file)
        .then(data => {
            const bulkResult = document.getElementById('bulkResult');
            if (!data || !Array.isArray(data.results)) {
                showNotification('❌ Upload processed but no results returned');
                return;
            }
            const results = data.results;
            let html = `
                <h3>✅ Bulk Shortening Complete!</h3>
                <p>Successfully shortened ${results.length} URLs:</p>`;
            if (data.message) {
                html += `<p style="color: #ff9800; font-style: italic;">ℹ️ ${data.message}</p>`;
            }
            html += `
                <div class="table-container">
                    <div style="max-height: 300px; overflow-y: auto; margin: 1rem 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: linear-gradient(135deg, var(--cyber-blue), var(--cyber-purple)); color: white;">
                                <th style="padding: 0.8rem; border: 1px solid var(--cyber-blue); font-family: 'Orbitron', monospace; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 0 10px currentColor;">🌐 Original URL</th>
                                <th style="padding: 0.8rem; border: 1px solid var(--cyber-blue); font-family: 'Orbitron', monospace; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 0 10px currentColor;">🔗 Short URL</th>
                                <th style="padding: 0.8rem; border: 1px solid var(--cyber-blue); font-family: 'Orbitron', monospace; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 0 10px currentColor;">⚡ Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            results.forEach((result, index) => {
                html += `
                    <tr style="transition: all 0.3s ease;" onmouseover="this.style.background='rgba(0, 212, 255, 0.1)'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 0.8rem; border: 1px solid rgba(0, 212, 255, 0.3); word-break: break-all; max-width: 200px; color: var(--text-secondary);">
                            <a href="${result.originalUrl}" target="_blank" style="color: var(--cyber-green); text-decoration: none;">${result.originalUrl.substring(0, 50)}${result.originalUrl.length > 50 ? '...' : ''}</a>
                        </td>
                        <td style="padding: 0.8rem; border: 1px solid rgba(0, 212, 255, 0.3);">
                            <a href="${result.shortUrl}" target="_blank" class="short-url">${result.shortUrl}</a>
                            ${result.message ? `<br><small style="color: var(--cyber-orange);">${result.message}</small>` : ''}
                        </td>
                        <td style="padding: 0.8rem; border: 1px solid rgba(0, 212, 255, 0.3); text-align: center;">
                            <button data-action="copy" data-url="${result.shortUrl}" class="action-btn copy" style="margin: 0.2rem;">📋</button>
                            <button data-action="generate-bulk-qr" data-url="${result.shortUrl}" class="action-btn analytics" style="margin: 0.2rem;">📱</button>
                        </td>
                    </tr>
                `;
            });
            html += `
                        </tbody>
                    </table>
                    </div>
                </div>
                <button type="button" data-action="download-bulk-csv" class="btn">💾 Download CSV</button>
            `;
            
            // Store results globally for CSV download
            window.bulkResults = results;
            bulkResult.innerHTML = html;
            bulkResult.className = 'result';
            bulkResult.style.display = 'block';
            bulkResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            showNotification(`✅ Successfully shortened ${results.length} URLs!`);
        })
        .catch(err => {
            console.error('Server upload failed:', err);
            showNotification(`❌ ${err?.error || 'Server upload failed'}`);
        });
}

// Add drag and drop functionality
document.addEventListener('DOMContentLoaded', function() {
    const fileUploadArea = document.getElementById('fileUploadArea');
    
    if (fileUploadArea) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });
        
        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, unhighlight, false);
        });
        
        // Handle dropped files
        fileUploadArea.addEventListener('drop', handleDrop, false);
    }
    
    // Setup download event listeners
    setupDownloadEventListeners();
    
    // Bulk URL textarea is now ready without line numbers
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight(e) {
        fileUploadArea.classList.add('drag-over');
    }
    
    function unhighlight(e) {
        fileUploadArea.classList.remove('drag-over');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            const csvFile = document.getElementById('csvFile');
            csvFile.files = files;
            handleFileUpload({ target: { files: files } });
        }
    }
});



// Setup download event listeners
function setupDownloadEventListeners() {
    // QR Code download buttons (delegated event handling)
    document.addEventListener('click', function(e) {
        if (e.target.matches('.qr-download, .qr-download *')) {
            e.preventDefault();
            const button = e.target.closest('.qr-download') || e.target;
            const canvas = button.closest('.qr-container')?.querySelector('canvas');
            if (canvas) {
                downloadQRFromCanvas(canvas);
            }
        }
    });
    
    // Bulk download buttons
    const bulkDownloadBtn = document.getElementById('bulkDownloadBtn');
    if (bulkDownloadBtn) {
        bulkDownloadBtn.addEventListener('click', function() {
            if (window.bulkResults && window.bulkResults.length > 0) {
                downloadBulkUrls(window.bulkResults, 'txt');
            } else {
                showNotification('❌ No bulk results available for download');
            }
        });
    }
}

// Enhanced QR download function for any canvas
function downloadQRFromCanvas(canvas) {
    if (!canvas) {
        showNotification('❌ No QR code to download');
        return;
    }
    
    try {
        canvas.toBlob((blob) => {
            if (blob) {
                const success = triggerDownload(blob, `qrcode-${Date.now()}.png`, 'image/png');
                if (success) {
                    showNotification('💾 QR code downloaded!');
                } else {
                    // Fallback to data URL
                    const link = document.createElement('a');
                    link.download = `qrcode-${Date.now()}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showNotification('💾 QR code downloaded (fallback)!');
                }
            } else {
                throw new Error('Failed to create blob from canvas');
            }
        }, 'image/png');
    } catch (error) {
        console.error('QR download error:', error);
        showNotification('❌ Failed to download QR code');
    }
}

// Bulk URL shortening
async function bulkShorten() {
    const bulkUrls = document.getElementById('bulkUrls').value;
    const bulkResult = document.getElementById('bulkResult');
    
    if (!bulkUrls.trim()) {
        showNotification('❌ Please enter URLs or upload a file');
        return;
    }
    
    const urls = bulkUrls.split('\n')
        .map(url => url.trim())
        .filter(url => url && isValidUrl(url))
        .map(url => ({ url: normalizeUrl(url) }));
    
    console.log('Bulk shortening URLs:', urls);
    
    if (urls.length === 0) {
        showNotification('❌ No valid URLs found');
        return;
    }
    
    if (urls.length > 100) {
        showNotification('❌ Maximum 100 URLs allowed per batch');
        return;
    }
    
    try {
        bulkResult.innerHTML = '<div class="loading"><div class="spinner"></div><p>Processing URLs...</p></div>';
        bulkResult.style.display = 'block';
        
        const requestData = { urls };
        console.log('Sending bulk request:', requestData);
        
        const response = await fetch('/api/bulk-shorten', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        console.log('Bulk response status:', response.status);
        const data = await response.json();
        console.log('Bulk response data:', data);
        
        if (response.ok) {
            const results = data.results;
            let html = `
                <h3>✅ Bulk Shortening Complete!</h3>
                <p>Successfully shortened ${results.length} URLs:</p>`;
            
            if (data.message) {
                html += `<p style="color: #ff9800; font-style: italic;">ℹ️ ${data.message}</p>`;
            }
            
            html += `
                <div class="table-container">
                    <div style="max-height: 300px; overflow-y: auto; margin: 1rem 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 0.5rem; border: 1px solid #ddd;">Original URL</th>
                                <th style="padding: 0.5rem; border: 1px solid #ddd;">Short URL</th>
                                <th style="padding: 0.5rem; border: 1px solid #ddd;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            results.forEach(result => {
                html += `
                    <tr>
                        <td style="padding: 0.5rem; border: 1px solid #ddd; word-break: break-all; max-width: 200px;">
                            <a href="${result.originalUrl}" target="_blank">${result.originalUrl.substring(0, 50)}${result.originalUrl.length > 50 ? '...' : ''}</a>
                        </td>
                        <td style="padding: 0.5rem; border: 1px solid #ddd;">
                            <a href="${result.shortUrl}" target="_blank" class="short-url">${result.shortUrl}</a>
                            ${result.message ? `<br><small style="color: #ff9800;">${result.message}</small>` : ''}
                        </td>
                        <td style="padding: 0.5rem; border: 1px solid #ddd;">
                            <button data-action="copy" data-url="${result.shortUrl}" class="btn" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">📋</button>
                            <button data-action="generate-bulk-qr" data-url="${result.shortUrl}" class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">📱</button>
                        </td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                    </div>
                </div>
                <button type="button" data-action="download-bulk-csv" class="btn">💾 Download CSV</button>
            `;
            
            // Store results globally for CSV download
            window.bulkResults = results;
            
            bulkResult.innerHTML = html;
            bulkResult.className = 'result';
            showNotification(`✅ Successfully shortened ${results.length} URLs!`);
        } else {
            console.error('Bulk shortening error:', data);
            bulkResult.innerHTML = `<h3>❌ Error</h3><p>${data.error || 'Failed to shorten URLs'}</p>`;
            bulkResult.className = 'result error';
        }
    } catch (error) {
        console.error('Bulk shortening fetch error:', error);
        bulkResult.innerHTML = '<h3>❌ Network Error</h3><p>Please try again - check console for details.</p>';
        bulkResult.className = 'result error';
    }
    
    bulkResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Server-side file upload with progress
async function uploadFileToServer(file) {
    return new Promise((resolve, reject) => {
        const progress = document.getElementById('uploadProgress');
        const status = document.getElementById('uploadStatus');
        progress.style.display = 'block';
        status.textContent = 'Uploading...';

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/bulk-upload');
        xhr.responseType = 'json';
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                status.textContent = `Uploading... ${percent}%`;
            }
        };
        xhr.onload = () => {
            progress.style.display = 'none';
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
            } else {
                reject(xhr.response || { error: 'Upload failed' });
            }
        };
        xhr.onerror = () => {
            progress.style.display = 'none';
            reject({ error: 'Network error during upload' });
        };
        const form = new FormData();
        form.append('file', file);
        xhr.send(form);
    });
}

// Download CSV of bulk results using backend endpoint
async function downloadCSV(results) {
    console.log('downloadCSV called with results:', results);
    
    // Show loading indicator
    showNotification('📊 Preparing CSV download...');
    
    try {
        const response = await fetch('/api/export-urls', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ results: results })
        });
        
        console.log('CSV export response status:', response.status);
        if (!response.ok) {
            throw new Error(`Export failed: ${response.status} ${response.statusText}`);
        }
        
        const blob = await response.blob();
        console.log('CSV blob received, size:', blob.size);
        
        const success = triggerDownload(blob, `shortly-export-${Date.now()}.csv`, 'text/csv');
        if (success) {
            showNotification('💾 CSV downloaded successfully!');
        } else {
            console.log('Blob download failed, trying fallback');
            downloadCSVFallback(results);
        }
    } catch (error) {
        console.error('CSV download error:', error);
        showNotification('⚠️ Server export failed, using fallback method...');
        // Try fallback method with client-side CSV generation
        downloadCSVFallback(results);
    }
}

// Test CSV download function
function testCSVDownload() {
    console.log('Testing CSV download...');
    const testResults = [{
        originalUrl: 'https://example.com',
        shortUrl: 'http://localhost:3000/test123',
        shortCode: 'test123',
        createdAt: new Date().toISOString(),
        clickCount: 0
    }];
    
    downloadCSVFallback(testResults);
}

// Download CSV for bulk results (uses globally stored results)
async function downloadBulkCSV() {
    console.log('downloadBulkCSV called');
    console.log('window.bulkResults:', window.bulkResults);
    
    if (!window.bulkResults || !Array.isArray(window.bulkResults)) {
        console.log('No bulk results available');
        showNotification('❌ No bulk results available for download');
        return;
    }
    
    console.log('Downloading CSV for', window.bulkResults.length, 'bulk results');
    
    // Try client-side download first (more reliable)
    try {
        downloadCSVFallback(window.bulkResults);
    } catch (error) {
        console.error('Client-side download failed, trying server:', error);
        // Fallback to server download
        try {
            await downloadCSV(window.bulkResults);
        } catch (serverError) {
            console.error('Server download also failed:', serverError);
            showNotification('❌ CSV download failed. Please try again.');
        }
    }
}

// Download CSV for a single URL result
async function downloadSingleCSV(originalUrl, shortUrl, shortCode) {
    console.log('downloadSingleCSV called with:', { originalUrl, shortUrl, shortCode });
    
    const singleResult = [{
        originalUrl: originalUrl,
        shortUrl: shortUrl,
        shortCode: shortCode,
        createdAt: new Date().toISOString(),
        clickCount: 0
    }];
    
    console.log('Downloading CSV for single result:', singleResult);
    try {
        await downloadCSV(singleResult);
    } catch (error) {
        console.error('Single CSV download failed, trying client-side:', error);
        downloadCSVFallback(singleResult);
    }
}

// Fallback CSV download using client-side generation
function downloadCSVFallback(results) {
    try {
        // Generate CSV content with proper escaping
        const csvContent = 'Original URL,Short URL,Short Code,Creation Date,Click Count\n' + 
            results.map(r => {
                const originalUrl = (r.originalUrl || '').replace(/"/g, '""');
                const shortUrl = (r.shortUrl || '').replace(/"/g, '""');
                const shortCode = (r.shortCode || '').replace(/"/g, '""');
                const creationDate = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '';
                const clickCount = r.clicks || 0;
                return `"${originalUrl}","${shortUrl}","${shortCode}","${creationDate}","${clickCount}"`;
            }).join('\n');
        
        // Try universal download handler first
        const success = triggerDownload(csvContent, `shortly-export-${Date.now()}.csv`, 'text/csv');
        
        if (success) {
            showNotification('💾 CSV downloaded (client-side)!');
        } else {
            // Final fallback using data URL
            const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `shortly-export-${Date.now()}.csv`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showNotification('💾 CSV download started (data URL)!');
        }
    } catch (error) {
        console.error('Fallback CSV download error:', error);
        showNotification('❌ CSV download failed. Please check browser settings.');
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Download bulk URLs as text file
function downloadBulkUrls(results, format = 'txt') {
    try {
        let content, mimeType, extension;
        
        if (format === 'txt') {
            content = results.map(r => `${r.originalUrl} -> ${r.shortUrl}`).join('\n');
            mimeType = 'text/plain';
            extension = 'txt';
        } else if (format === 'json') {
            content = JSON.stringify(results, null, 2);
            mimeType = 'application/json';
            extension = 'json';
        }
        
        const success = triggerDownload(content, `shortly-bulk-${Date.now()}.${extension}`, mimeType);
        
        if (success) {
            showNotification(`💾 Bulk URLs downloaded as ${extension.toUpperCase()}!`);
        } else {
            // Fallback using data URL
            const dataUrl = `data:${mimeType};charset=utf-8,` + encodeURIComponent(content);
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `shortly-bulk-${Date.now()}.${extension}`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showNotification(`💾 Bulk URLs downloaded (fallback)!`);
        }
    } catch (error) {
        console.error('Bulk download error:', error);
        showNotification('❌ Bulk download failed');
    }
}

// Prepare static CSV link for a rendered results table
function prepareBulkCsvLink(results) {
    try {
        if (bulkCsvObjectUrl) {
            URL.revokeObjectURL(bulkCsvObjectUrl);
            bulkCsvObjectUrl = null;
        }
        const csvContent = 'Original URL,Short URL,Short Code,Creation Date,Click Count\n' + 
            results.map(r => {
                const originalUrl = (r.originalUrl || '').replace(/"/g, '""');
                const shortUrl = (r.shortUrl || '').replace(/"/g, '""');
                const shortCode = (r.shortCode || '').replace(/"/g, '""');
                const creationDate = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '';
                const clickCount = r.clicks || 0;
                return `"${originalUrl}","${shortUrl}","${shortCode}","${creationDate}","${clickCount}"`;
            }).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        bulkCsvObjectUrl = URL.createObjectURL(blob);
        const a = document.getElementById('downloadCsvBtn');
        if (a) {
            a.href = bulkCsvObjectUrl;
            a.download = `shortly-bulk-${Date.now()}.csv`;
        }
    } catch (err) {
        console.warn('prepareBulkCsvLink failed, falling back to click handler:', err);
        const a = document.getElementById('downloadCsvBtn');
        if (a) {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                downloadBulkCSV();
            });
        }
    }
}