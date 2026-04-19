/* ============================================
   SPEAKFLOW - UTILITIES MODULE
   Version: 1.0.0
   Common utility functions and helpers for the entire application
   ============================================ */

// ============================================
// STRING UTILITIES
// ============================================

const StringUtils = {
    /**
     * Capitalizes the first letter of a string
     * @param {string} str - Input string
     * @returns {string} Capitalized string
     */
    capitalize(str) {
        if (!str || typeof str !== 'string') return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },

    /**
     * Capitalizes the first letter of each word in a string
     * @param {string} str - Input string
     * @returns {string} Title case string
     */
    titleCase(str) {
        if (!str || typeof str !== 'string') return '';
        return str.toLowerCase().split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    },

    /**
     * Truncates a string to a specified length
     * @param {string} str - Input string
     * @param {number} length - Maximum length
     * @param {string} suffix - Suffix to add (default '...')
     * @returns {string} Truncated string
     */
    truncate(str, length = 50, suffix = '...') {
        if (!str || typeof str !== 'string') return '';
        if (str.length <= length) return str;
        return str.substring(0, length - suffix.length) + suffix;
    },

    /**
     * Slugifies a string for URLs
     * @param {string} str - Input string
     * @returns {string} Slugified string
     */
    slugify(str) {
        if (!str || typeof str !== 'string') return '';
        return str
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    },

    /**
     * Removes HTML tags from a string
     * @param {string} str - Input string with HTML
     * @returns {string} Plain text string
     */
    stripHtml(str) {
        if (!str || typeof str !== 'string') return '';
        return str.replace(/<[^>]*>/g, '');
    },

    /**
     * Escapes HTML special characters
     * @param {string} str - Input string
     * @returns {string} Escaped string
     */
    escapeHtml(str) {
        if (!str || typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Unescapes HTML entities
     * @param {string} str - Input string with HTML entities
     * @returns {string} Unescaped string
     */
    unescapeHtml(str) {
        if (!str || typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.innerHTML = str;
        return div.textContent;
    },

    /**
     * Counts words in a string
     * @param {string} str - Input string
     * @returns {number} Word count
     */
    wordCount(str) {
        if (!str || typeof str !== 'string') return 0;
        return str.trim().split(/\s+/).length;
    },

    /**
     * Generates a random string
     * @param {number} length - Length of the random string
     * @returns {string} Random string
     */
    randomString(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
};

// ============================================
// NUMBER UTILITIES
// ============================================

const NumberUtils = {
    /**
     * Formats a number with commas
     * @param {number} num - Input number
     * @returns {string} Formatted number
     */
    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    /**
     * Formats a number as currency
     * @param {number} amount - Amount
     * @param {string} currency - Currency code (default 'USD')
     * @returns {string} Formatted currency
     */
    formatCurrency(amount, currency = 'USD') {
        const symbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' };
        const symbol = symbols[currency] || '$';
        return `${symbol}${amount.toFixed(2)}`;
    },

    /**
     * Formats a number as percentage
     * @param {number} value - Value (0-1 or 0-100)
     * @param {boolean} isDecimal - Whether value is decimal (0-1)
     * @returns {string} Formatted percentage
     */
    formatPercentage(value, isDecimal = true) {
        const percentage = isDecimal ? value * 100 : value;
        return `${percentage.toFixed(1)}%`;
    },

    /**
     * Clamps a number between min and max
     * @param {number} num - Input number
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped number
     */
    clamp(num, min, max) {
        return Math.min(Math.max(num, min), max);
    },

    /**
     * Maps a number from one range to another
     * @param {number} value - Input value
     * @param {number} fromLow - Source range low
     * @param {number} fromHigh - Source range high
     * @param {number} toLow - Target range low
     * @param {number} toHigh - Target range high
     * @returns {number} Mapped value
     */
    mapRange(value, fromLow, fromHigh, toLow, toHigh) {
        return toLow + (value - fromLow) * (toHigh - toLow) / (fromHigh - fromLow);
    },

    /**
     * Generates a random integer between min and max
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random integer
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Calculates the average of an array of numbers
     * @param {number[]} arr - Array of numbers
     * @returns {number} Average
     */
    average(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    },

    /**
     * Formats file size in bytes to human readable
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Converts seconds to MM:SS format
     * @param {number} seconds - Total seconds
     * @returns {string} Formatted time
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
};

// ============================================
// DATE UTILITIES
// ============================================

const DateUtils = {
    /**
     * Formats a date to a readable string
     * @param {Date|string} date - Input date
     * @param {string} format - Format (default 'MMM DD, YYYY')
     * @returns {string} Formatted date
     */
    formatDate(date, format = 'MMM DD, YYYY') {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Invalid date';
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const replacements = {
            'YYYY': d.getFullYear(),
            'YY': d.getFullYear().toString().slice(-2),
            'MMM': months[d.getMonth()],
            'MM': String(d.getMonth() + 1).padStart(2, '0'),
            'DD': String(d.getDate()).padStart(2, '0'),
            'HH': String(d.getHours()).padStart(2, '0'),
            'mm': String(d.getMinutes()).padStart(2, '0'),
            'ss': String(d.getSeconds()).padStart(2, '0')
        };
        
        let result = format;
        for (const [key, value] of Object.entries(replacements)) {
            result = result.replace(key, value);
        }
        return result;
    },

    /**
     * Returns a relative time string (e.g., "2 hours ago")
     * @param {Date|string} date - Input date
     * @returns {string} Relative time string
     */
    timeAgo(date) {
        const now = new Date();
        const past = new Date(date);
        const seconds = Math.floor((now - past) / 1000);
        
        const intervals = [
            { label: 'year', seconds: 31536000 },
            { label: 'month', seconds: 2592000 },
            { label: 'week', seconds: 604800 },
            { label: 'day', seconds: 86400 },
            { label: 'hour', seconds: 3600 },
            { label: 'minute', seconds: 60 },
            { label: 'second', seconds: 1 }
        ];
        
        for (const interval of intervals) {
            const count = Math.floor(seconds / interval.seconds);
            if (count >= 1) {
                return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`;
            }
        }
        return 'just now';
    },

    /**
     * Checks if a date is today
     * @param {Date|string} date - Input date
     * @returns {boolean} True if today
     */
    isToday(date) {
        const d = new Date(date);
        const today = new Date();
        return d.toDateString() === today.toDateString();
    },

    /**
     * Checks if a date is this week
     * @param {Date|string} date - Input date
     * @returns {boolean} True if this week
     */
    isThisWeek(date) {
        const d = new Date(date);
        const now = new Date();
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return d >= weekStart && d <= weekEnd;
    },

    /**
     * Returns start of day
     * @param {Date} date - Input date
     * @returns {Date} Start of day
     */
    startOfDay(date = new Date()) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    },

    /**
     * Returns end of day
     * @param {Date} date - Input date
     * @returns {Date} End of day
     */
    endOfDay(date = new Date()) {
        const d = new Date(date);
        d.setHours(23, 59, 59, 999);
        return d;
    },

    /**
     * Gets the difference in days between two dates
     * @param {Date|string} date1 - First date
     * @param {Date|string} date2 - Second date
     * @returns {number} Difference in days
     */
    daysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    /**
     * Adds days to a date
     * @param {Date} date - Input date
     * @param {number} days - Number of days to add
     * @returns {Date} New date
     */
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }
};

// ============================================
// ARRAY UTILITIES
// ============================================

const ArrayUtils = {
    /**
     * Groups array items by a key
     * @param {Array} arr - Input array
     * @param {string|Function} key - Key to group by
     * @returns {Object} Grouped object
     */
    groupBy(arr, key) {
        return arr.reduce((result, item) => {
            const groupKey = typeof key === 'function' ? key(item) : item[key];
            if (!result[groupKey]) result[groupKey] = [];
            result[groupKey].push(item);
            return result;
        }, {});
    },

    /**
     * Removes duplicate items from an array
     * @param {Array} arr - Input array
     * @param {string|Function} key - Key to check uniqueness (optional)
     * @returns {Array} Unique array
     */
    unique(arr, key = null) {
        if (!key) return [...new Set(arr)];
        
        const seen = new Set();
        return arr.filter(item => {
            const value = typeof key === 'function' ? key(item) : item[key];
            if (seen.has(value)) return false;
            seen.add(value);
            return true;
        });
    },

    /**
     * Shuffles an array (Fisher-Yates)
     * @param {Array} arr - Input array
     * @returns {Array} Shuffled array
     */
    shuffle(arr) {
        const array = [...arr];
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    /**
     * Chunks an array into smaller arrays
     * @param {Array} arr - Input array
     * @param {number} size - Chunk size
     * @returns {Array[]} Chunked array
     */
    chunk(arr, size) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    },

    /**
     * Gets random items from an array
     * @param {Array} arr - Input array
     * @param {number} count - Number of items to get
     * @returns {Array} Random items
     */
    random(arr, count = 1) {
        const shuffled = this.shuffle(arr);
        return count === 1 ? shuffled[0] : shuffled.slice(0, count);
    },

    /**
     * Sorts an array by a key
     * @param {Array} arr - Input array
     * @param {string|Function} key - Sort key
     * @param {string} order - 'asc' or 'desc'
     * @returns {Array} Sorted array
     */
    sortBy(arr, key, order = 'asc') {
        const sorted = [...arr].sort((a, b) => {
            const aVal = typeof key === 'function' ? key(a) : a[key];
            const bVal = typeof key === 'function' ? key(b) : b[key];
            if (aVal < bVal) return order === 'asc' ? -1 : 1;
            if (aVal > bVal) return order === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    },

    /**
     * Flattens nested arrays
     * @param {Array} arr - Input array
     * @param {number} depth - Depth to flatten
     * @returns {Array} Flattened array
     */
    flatten(arr, depth = Infinity) {
        return arr.flat(depth);
    },

    /**
     * Intersection of multiple arrays
     * @param {...Array} arrays - Arrays to intersect
     * @returns {Array} Intersection
     */
    intersection(...arrays) {
        if (arrays.length === 0) return [];
        return arrays.reduce((a, b) => a.filter(c => b.includes(c)));
    },

    /**
     * Difference between arrays
     * @param {Array} arr1 - First array
     * @param {Array} arr2 - Second array
     * @returns {Array} Difference
     */
    difference(arr1, arr2) {
        return arr1.filter(x => !arr2.includes(x));
    }
};

// ============================================
// OBJECT UTILITIES
// ============================================

const ObjectUtils = {
    /**
     * Deep clones an object
     * @param {Object} obj - Object to clone
     * @returns {Object} Cloned object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Merges multiple objects deeply
     * @param {...Object} objects - Objects to merge
     * @returns {Object} Merged object
     */
    deepMerge(...objects) {
        const result = {};
        for (const obj of objects) {
            for (const key in obj) {
                if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                    result[key] = this.deepMerge(result[key] || {}, obj[key]);
                } else {
                    result[key] = obj[key];
                }
            }
        }
        return result;
    },

    /**
     * Picks specific keys from an object
     * @param {Object} obj - Source object
     * @param {string[]} keys - Keys to pick
     * @returns {Object} Picked object
     */
    pick(obj, keys) {
        const result = {};
        for (const key of keys) {
            if (obj && key in obj) result[key] = obj[key];
        }
        return result;
    },

    /**
     * Omits specific keys from an object
     * @param {Object} obj - Source object
     * @param {string[]} keys - Keys to omit
     * @returns {Object} Object without omitted keys
     */
    omit(obj, keys) {
        const result = { ...obj };
        for (const key of keys) {
            delete result[key];
        }
        return result;
    },

    /**
     * Checks if object is empty
     * @param {Object} obj - Object to check
     * @returns {boolean} True if empty
     */
    isEmpty(obj) {
        return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
    },

    /**
     * Gets nested object value using dot notation
     * @param {Object} obj - Source object
     * @param {string} path - Dot notation path
     * @param {*} defaultValue - Default value if not found
     * @returns {*} Value at path
     */
    get(obj, path, defaultValue = undefined) {
        const keys = path.split('.');
        let result = obj;
        for (const key of keys) {
            if (result && typeof result === 'object' && key in result) {
                result = result[key];
            } else {
                return defaultValue;
            }
        }
        return result;
    },

    /**
     * Sets nested object value using dot notation
     * @param {Object} obj - Source object
     * @param {string} path - Dot notation path
     * @param {*} value - Value to set
     * @returns {Object} Updated object
     */
    set(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        return obj;
    }
};

// ============================================
// BROWSER UTILITIES
// ============================================

const BrowserUtils = {
    /**
     * Gets browser information
     * @returns {Object} Browser info
     */
    getBrowserInfo() {
        const ua = navigator.userAgent;
        const browsers = {
            Chrome: /Chrome/i,
            Firefox: /Firefox/i,
            Safari: /Safari/i,
            Edge: /Edge/i,
            Opera: /Opera/i
        };
        
        for (const [name, pattern] of Object.entries(browsers)) {
            if (pattern.test(ua)) {
                return { name, version: this.getVersion(ua, name) };
            }
        }
        return { name: 'Unknown', version: null };
    },

    getVersion(ua, browser) {
        const patterns = {
            Chrome: /Chrome\/(\d+)/,
            Firefox: /Firefox\/(\d+)/,
            Safari: /Version\/(\d+)/,
            Edge: /Edge\/(\d+)/,
            Opera: /OPR\/(\d+)/
        };
        const match = ua.match(patterns[browser]);
        return match ? parseInt(match[1]) : null;
    },

    /**
     * Checks if device is mobile
     * @returns {boolean} True if mobile
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    /**
     * Checks if device is iOS
     * @returns {boolean} True if iOS
     */
    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    },

    /**
     * Checks if device is Android
     * @returns {boolean} True if Android
     */
    isAndroid() {
        return /Android/i.test(navigator.userAgent);
    },

    /**
     * Gets viewport dimensions
     * @returns {Object} Width and height
     */
    getViewport() {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    },

    /**
     * Copies text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} Success status
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            return false;
        }
    },

    /**
     * Downloads a file
     * @param {string} content - File content
     * @param {string} filename - File name
     * @param {string} type - MIME type
     */
    downloadFile(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    /**
     * Gets URL parameters
     * @returns {Object} URL parameters
     */
    getUrlParams() {
        const params = {};
        const searchParams = new URLSearchParams(window.location.search);
        for (const [key, value] of searchParams) {
            params[key] = value;
        }
        return params;
    },

    /**
     * Sets URL parameters without reload
     * @param {Object} params - Parameters to set
     * @param {boolean} replace - Whether to replace history
     */
    setUrlParams(params, replace = false) {
        const url = new URL(window.location.href);
        for (const [key, value] of Object.entries(params)) {
            if (value === null || value === undefined) {
                url.searchParams.delete(key);
            } else {
                url.searchParams.set(key, value);
            }
        }
        if (replace) {
            window.history.replaceState({}, '', url);
        } else {
            window.history.pushState({}, '', url);
        }
    }
};

// ============================================
// VALIDATION UTILITIES
// ============================================

const ValidationUtils = {
    /**
     * Validates email format
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    isEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    /**
     * Validates phone number
     * @param {string} phone - Phone number to validate
     * @returns {boolean} True if valid
     */
    isPhone(phone) {
        const re = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}[-\s\.]?[0-9]{1,5}$/;
        return re.test(phone);
    },

    /**
     * Validates URL
     * @param {string} url - URL to validate
     * @returns {boolean} True if valid
     */
    isUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Validates password strength
     * @param {string} password - Password to validate
     * @returns {Object} Strength info
     */
    checkPasswordStrength(password) {
        let score = 0;
        const feedback = [];
        
        if (password.length >= 8) score++;
        else feedback.push('At least 8 characters');
        
        if (/[A-Z]/.test(password)) score++;
        else feedback.push('Include uppercase letters');
        
        if (/[a-z]/.test(password)) score++;
        else feedback.push('Include lowercase letters');
        
        if (/[0-9]/.test(password)) score++;
        else feedback.push('Include numbers');
        
        if (/[^A-Za-z0-9]/.test(password)) score++;
        else feedback.push('Include special characters');
        
        const strength = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][score];
        
        return { score, strength, feedback };
    },

    /**
     * Validates if value is empty
     * @param {*} value - Value to check
     * @returns {boolean} True if empty
     */
    isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    },

    /**
     * Validates if value is a number
     * @param {*} value - Value to check
     * @returns {boolean} True if number
     */
    isNumber(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    }
};

// ============================================
// STORAGE UTILITIES
// ============================================

const StorageUtils = {
    /**
     * Sets item in localStorage with expiration
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @param {number} ttl - Time to live in milliseconds
     */
    setWithExpiry(key, value, ttl) {
        const item = {
            value,
            expiry: Date.now() + ttl
        };
        localStorage.setItem(key, JSON.stringify(item));
    },

    /**
     * Gets item from localStorage with expiration check
     * @param {string} key - Storage key
     * @returns {*} Stored value or null if expired
     */
    getWithExpiry(key) {
        const itemStr = localStorage.getItem(key);
        if (!itemStr) return null;
        
        const item = JSON.parse(itemStr);
        if (Date.now() > item.expiry) {
            localStorage.removeItem(key);
            return null;
        }
        return item.value;
    },

    /**
     * Gets storage size in bytes
     * @returns {number} Storage size
     */
    getSize() {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            total += (key.length + value.length) * 2;
        }
        return total;
    },

    /**
     * Clears all items matching a pattern
     * @param {RegExp} pattern - Pattern to match
     */
    clearMatching(pattern) {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (pattern.test(key)) {
                keys.push(key);
            }
        }
        keys.forEach(key => localStorage.removeItem(key));
    }
};

// ============================================
// EXPORTS
// ============================================

// Combine all utilities
const Utils = {
    String: StringUtils,
    Number: NumberUtils,
    Date: DateUtils,
    Array: ArrayUtils,
    Object: ObjectUtils,
    Browser: BrowserUtils,
    Validation: ValidationUtils,
    Storage: StorageUtils,
    
    // Common helpers
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },
    
    getDeviceInfo() {
        return {
            browser: BrowserUtils.getBrowserInfo(),
            isMobile: BrowserUtils.isMobile(),
            isIOS: BrowserUtils.isIOS(),
            isAndroid: BrowserUtils.isAndroid(),
            viewport: BrowserUtils.getViewport(),
            language: navigator.language,
            online: navigator.onLine
        };
    }
};

// Global exports
window.SpeakFlow = window.SpeakFlow || {};
window.SpeakFlow.Utils = Utils;

// Module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}

// ============================================
// AUTO-INITIALIZATION
// ============================================

console.log('Utils module loaded');
