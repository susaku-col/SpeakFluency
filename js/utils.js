// ============================================
// SpeakFlow Utility Functions
// Common Utilities & Helper Functions
// ============================================

// ============================================
// DOM Utilities
// ============================================

/**
 * Get element by selector with error handling
 * @param {string} selector - CSS selector
 * @returns {HTMLElement|null}
 */
const getElement = (selector) => {
    return document.querySelector(selector);
};

/**
 * Get all elements by selector
 * @param {string} selector - CSS selector
 * @returns {NodeList}
 */
const getElements = (selector) => {
    return document.querySelectorAll(selector);
};

/**
 * Create element with attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object} attributes - Element attributes
 * @param {Array|string} children - Child elements or text
 * @returns {HTMLElement}
 */
const createElement = (tag, attributes = {}, children = []) => {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'dataset') {
            Object.entries(value).forEach(([dataKey, dataValue]) => {
                element.dataset[dataKey] = dataValue;
            });
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else {
            element.setAttribute(key, value);
        }
    });
    
    const addChildren = (items) => {
        if (typeof items === 'string') {
            element.appendChild(document.createTextNode(items));
        } else if (Array.isArray(items)) {
            items.forEach(child => addChildren(child));
        } else if (items instanceof HTMLElement) {
            element.appendChild(items);
        }
    };
    
    addChildren(children);
    
    return element;
};

/**
 * Toggle element visibility
 * @param {HTMLElement} element - Target element
 * @param {boolean} show - Show or hide
 */
const toggleVisibility = (element, show) => {
    if (element) {
        element.style.display = show ? '' : 'none';
    }
};

/**
 * Add class to element with timeout
 * @param {HTMLElement} element - Target element
 * @param {string} className - Class to add
 * @param {number} timeout - Remove after timeout (ms)
 */
const addClassWithTimeout = (element, className, timeout = 1000) => {
    if (!element) return;
    element.classList.add(className);
    setTimeout(() => {
        element.classList.remove(className);
    }, timeout);
};

/**
 * Smooth scroll to element
 * @param {HTMLElement|string} target - Target element or selector
 * @param {Object} options - Scroll options
 */
const scrollToElement = (target, options = {}) => {
    const element = typeof target === 'string' ? getElement(target) : target;
    if (!element) return;
    
    element.scrollIntoView({
        behavior: 'smooth',
        block: options.block || 'start',
        inline: options.inline || 'nearest'
    });
};

// ============================================
// String Utilities
// ============================================

/**
 * Capitalize first letter of string
 * @param {string} str - Input string
 * @returns {string}
 */
const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Truncate string to length
 * @param {string} str - Input string
 * @param {number} length - Maximum length
 * @param {string} suffix - Suffix to add
 * @returns {string}
 */
const truncate = (str, length = 50, suffix = '...') => {
    if (!str) return '';
    if (str.length <= length) return str;
    return str.substring(0, length - suffix.length) + suffix;
};

/**
 * Slugify string for URLs
 * @param {string} str - Input string
 * @returns {string}
 */
const slugify = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

/**
 * Escape HTML special characters
 * @param {string} str - Input string
 * @returns {string}
 */
const escapeHtml = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * Unescape HTML entities
 * @param {string} str - Input string
 * @returns {string}
 */
const unescapeHtml = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.innerHTML = str;
    return div.textContent;
};

/**
 * Generate random string
 * @param {number} length - String length
 * @returns {string}
 */
const randomString = (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// ============================================
// Number & Math Utilities
// ============================================

/**
 * Format number with K/M/B suffix
 * @param {number} num - Input number
 * @param {number} decimals - Decimal places
 * @returns {string}
 */
const formatNumber = (num, decimals = 1) => {
    if (num === null || num === undefined) return '0';
    
    const absNum = Math.abs(num);
    if (absNum >= 1e9) {
        return (num / 1e9).toFixed(decimals) + 'B';
    }
    if (absNum >= 1e6) {
        return (num / 1e6).toFixed(decimals) + 'M';
    }
    if (absNum >= 1e3) {
        return (num / 1e3).toFixed(decimals) + 'K';
    }
    return num.toString();
};

/**
 * Format percentage
 * @param {number} value - Value (0-100)
 * @param {number} decimals - Decimal places
 * @returns {string}
 */
const formatPercentage = (value, decimals = 0) => {
    return `${value.toFixed(decimals)}%`;
};

/**
 * Clamp number between min and max
 * @param {number} num - Input number
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number}
 */
const clamp = (num, min, max) => {
    return Math.min(Math.max(num, min), max);
};

/**
 * Get random number between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number}
 */
const random = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Calculate percentage
 * @param {number} value - Current value
 * @param {number} total - Total value
 * @returns {number}
 */
const calculatePercentage = (value, total) => {
    if (total === 0) return 0;
    return (value / total) * 100;
};

// ============================================
// Date & Time Utilities
// ============================================

/**
 * Format date
 * @param {Date|string|number} date - Input date
 * @param {string} format - Format type ('short', 'long', 'relative', 'time')
 * @returns {string}
 */
const formatDate = (date, format = 'short') => {
    const d = new Date(date);
    
    if (isNaN(d.getTime())) return 'Invalid date';
    
    switch (format) {
        case 'short':
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        case 'long':
            return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        case 'relative':
            return getRelativeTime(d);
        case 'time':
            return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        case 'datetime':
            return d.toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        default:
            return d.toLocaleDateString();
    }
};

/**
 * Get relative time string (e.g., "2 hours ago")
 * @param {Date} date - Input date
 * @returns {string}
 */
const getRelativeTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
    return `${years} year${years > 1 ? 's' : ''} ago`;
};

/**
 * Check if date is today
 * @param {Date|string} date - Input date
 * @returns {boolean}
 */
const isToday = (date) => {
    const d = new Date(date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
};

/**
 * Get days between two dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number}
 */
const daysBetween = (startDate, endDate) => {
    const diff = new Date(endDate) - new Date(startDate);
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ============================================
// Array & Object Utilities
// ============================================

/**
 * Group array by key
 * @param {Array} array - Input array
 * @param {string|Function} key - Key to group by
 * @returns {Object}
 */
const groupBy = (array, key) => {
    return array.reduce((result, item) => {
        const groupKey = typeof key === 'function' ? key(item) : item[key];
        if (!result[groupKey]) {
            result[groupKey] = [];
        }
        result[groupKey].push(item);
        return result;
    }, {});
};

/**
 * Sort array by key
 * @param {Array} array - Input array
 * @param {string} key - Key to sort by
 * @param {string} order - Sort order ('asc' or 'desc')
 * @returns {Array}
 */
const sortBy = (array, key, order = 'asc') => {
    const sorted = [...array].sort((a, b) => {
        let aVal = a[key];
        let bVal = b[key];
        
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
        return 0;
    });
    
    return sorted;
};

/**
 * Remove duplicates from array
 * @param {Array} array - Input array
 * @param {string} key - Key to check uniqueness
 * @returns {Array}
 */
const unique = (array, key = null) => {
    if (!key) {
        return [...new Set(array)];
    }
    
    const seen = new Set();
    return array.filter(item => {
        const value = item[key];
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
    });
};

/**
 * Deep clone object
 * @param {Object} obj - Input object
 * @returns {Object}
 */
const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (obj instanceof Object) {
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
            }
        }
        return cloned;
    }
    return obj;
};

/**
 * Merge objects deeply
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object}
 */
const deepMerge = (target, source) => {
    const result = { ...target };
    
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }
    
    return result;
};

// ============================================
// Storage Utilities
// ============================================

/**
 * Set item in localStorage with expiry
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 * @param {number} expiry - Expiry in milliseconds
 */
const setStorageItem = (key, value, expiry = null) => {
    const item = {
        value: value,
        timestamp: Date.now()
    };
    
    if (expiry) {
        item.expiry = expiry;
    }
    
    localStorage.setItem(key, JSON.stringify(item));
};

/**
 * Get item from localStorage with expiry check
 * @param {string} key - Storage key
 * @returns {any|null}
 */
const getStorageItem = (key) => {
    const item = localStorage.getItem(key);
    if (!item) return null;
    
    try {
        const data = JSON.parse(item);
        
        if (data.expiry && (Date.now() - data.timestamp) > data.expiry) {
            localStorage.removeItem(key);
            return null;
        }
        
        return data.value;
    } catch {
        return item;
    }
};

/**
 * Remove item from localStorage
 * @param {string} key - Storage key
 */
const removeStorageItem = (key) => {
    localStorage.removeItem(key);
};

/**
 * Clear all storage items with prefix
 * @param {string} prefix - Key prefix
 */
const clearStorageByPrefix = (prefix) => {
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith(prefix)) {
            localStorage.removeItem(key);
        }
    });
};

// ============================================
// URL & Navigation Utilities
// ============================================

/**
 * Get URL parameter
 * @param {string} name - Parameter name
 * @param {string} url - URL (optional)
 * @returns {string|null}
 */
const getUrlParam = (name, url = window.location.href) => {
    const urlObj = new URL(url);
    return urlObj.searchParams.get(name);
};

/**
 * Set URL parameter without reload
 * @param {string} name - Parameter name
 * @param {string} value - Parameter value
 */
const setUrlParam = (name, value) => {
    const url = new URL(window.location.href);
    url.searchParams.set(name, value);
    window.history.pushState({}, '', url);
};

/**
 * Remove URL parameter
 * @param {string} name - Parameter name
 */
const removeUrlParam = (name) => {
    const url = new URL(window.location.href);
    url.searchParams.delete(name);
    window.history.pushState({}, '', url);
};

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>}
 */
const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('Copy failed:', error);
        return false;
    }
};

// ============================================
// Validation Utilities
// ============================================

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
const isValidEmail = (email) => {
    const regex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
    return regex.test(email);
};

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean}
 */
const isValidPhone = (phone) => {
    const regex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}[-\s\.]?[0-9]{1,5}$/;
    return regex.test(phone);
};

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object}
 */
const validatePassword = (password) => {
    const result = {
        isValid: true,
        errors: []
    };
    
    if (password.length < 6) {
        result.isValid = false;
        result.errors.push('Password must be at least 6 characters');
    }
    
    if (!/[A-Z]/.test(password)) {
        result.isValid = false;
        result.errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
        result.isValid = false;
        result.errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
        result.isValid = false;
        result.errors.push('Password must contain at least one number');
    }
    
    return result;
};

// ============================================
// Device & Browser Utilities
// ============================================

/**
 * Detect device type
 * @returns {string}
 */
const getDeviceType = () => {
    const ua = navigator.userAgent;
    if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
    if (/Tablet|iPad/i.test(ua)) return 'tablet';
    return 'desktop';
};

/**
 * Detect browser
 * @returns {string}
 */
const getBrowser = () => {
    const ua = navigator.userAgent;
    if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) return 'chrome';
    if (/Firefox/i.test(ua)) return 'firefox';
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'safari';
    if (/Edge/i.test(ua)) return 'edge';
    if (/MSIE|Trident/i.test(ua)) return 'ie';
    return 'unknown';
};

/**
 * Check if device is touch-enabled
 * @returns {boolean}
 */
const isTouchDevice = () => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

/**
 * Get viewport size
 * @returns {Object}
 */
const getViewportSize = () => {
    return {
        width: window.innerWidth,
        height: window.innerHeight
    };
};

// ============================================
// Color Utilities
// ============================================

/**
 * Convert hex to RGB
 * @param {string} hex - Hex color code
 * @returns {Object}
 */
const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

/**
 * Get contrasting text color (black or white)
 * @param {string} hex - Background color
 * @returns {string}
 */
const getContrastColor = (hex) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return '#000000';
    
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
};

/**
 * Lighten color
 * @param {string} hex - Hex color
 * @param {number} percent - Lighten percentage
 * @returns {string}
 */
const lightenColor = (hex, percent) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    
    const lighten = (value) => {
        return Math.min(255, Math.floor(value + (255 - value) * (percent / 100)));
    };
    
    const r = lighten(rgb.r);
    const g = lighten(rgb.g);
    const b = lighten(rgb.b);
    
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

// ============================================
// Performance Utilities
// ============================================

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function}
 */
const debounce = (func, wait = 300) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Throttle function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in milliseconds
 * @returns {Function}
 */
const throttle = (func, limit = 300) => {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

/**
 * Measure function execution time
 * @param {Function} func - Function to measure
 * @returns {Promise<number>}
 */
const measureTime = async (func) => {
    const start = performance.now();
    await func();
    const end = performance.now();
    return end - start;
};

// ============================================
// Export Utilities
// ============================================

// Make utilities globally available
window.utils = {
    // DOM
    getElement,
    getElements,
    createElement,
    toggleVisibility,
    addClassWithTimeout,
    scrollToElement,
    
    // String
    capitalize,
    truncate,
    slugify,
    escapeHtml,
    unescapeHtml,
    randomString,
    
    // Number
    formatNumber,
    formatPercentage,
    clamp,
    random,
    calculatePercentage,
    
    // Date
    formatDate,
    getRelativeTime,
    isToday,
    daysBetween,
    
    // Array/Object
    groupBy,
    sortBy,
    unique,
    deepClone,
    deepMerge,
    
    // Storage
    setStorageItem,
    getStorageItem,
    removeStorageItem,
    clearStorageByPrefix,
    
    // URL
    getUrlParam,
    setUrlParam,
    removeUrlParam,
    copyToClipboard,
    
    // Validation
    isValidEmail,
    isValidPhone,
    isValidUrl,
    validatePassword,
    
    // Device
    getDeviceType,
    getBrowser,
    isTouchDevice,
    getViewportSize,
    
    // Color
    hexToRgb,
    getContrastColor,
    lightenColor,
    
    // Performance
    debounce,
    throttle,
    measureTime
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.utils;
}
