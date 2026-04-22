// ============ CONFIGURATION ============
const CONFIG = {
    // API Keys (untuk future integration dengan OpenAI, dll)
    OPENAI_API_KEY: '',  // Isi dengan API key Anda nanti
    USE_API: false,       // Set true untuk menggunakan API realtime
    
    // AI Settings
    AI_MODEL: 'gpt-3.5-turbo',
    MAX_TOKENS: 150,
    TEMPERATURE: 0.9,
    
    // Voice Settings
    DEFAULT_ACCENT: 'uk',
    DEFAULT_GENDER: 'female',  // 'male' or 'female'
    
    // Available Accents
    ACCENTS: {
        uk: { name: 'British', flag: '🇬🇧', lang: 'en-GB', pitch: 1.0, rate: 0.9, gender: { male: 'en-GB', female: 'en-GB' } },
        us: { name: 'American', flag: '🇺🇸', lang: 'en-US', pitch: 1.0, rate: 0.95, gender: { male: 'en-US', female: 'en-US' } },
        australia: { name: 'Australian', flag: '🇦🇺', lang: 'en-AU', pitch: 1.05, rate: 0.92, gender: { male: 'en-AU', female: 'en-AU' } },
        ireland: { name: 'Irish', flag: '🇮🇪', lang: 'en-IE', pitch: 1.08, rate: 0.88, gender: { male: 'en-IE', female: 'en-IE' } },
        southafrica: { name: 'South African', flag: '🇿🇦', lang: 'en-ZA', pitch: 1.02, rate: 0.93, gender: { male: 'en-ZA', female: 'en-ZA' } },
        india: { name: 'Indian', flag: '🇮🇳', lang: 'en-IN', pitch: 1.03, rate: 0.96, gender: { male: 'en-IN', female: 'en-IN' } }
    },
    
    // Gender options for voice
    GENDERS: {
        male: { name: '👨 Male', pitch: 0.85, rate: 0.95 },
        female: { name: '👩 Female', pitch: 1.15, rate: 1.0 }
    },
    
    // Gamification
    XP_PER_PRACTICE: 10,
    XP_PER_CONVERSATION: 25,
    XP_LEVEL_MULTIPLIER: 100
};

// Current state
let currentAccent = CONFIG.DEFAULT_ACCENT;
let currentGender = CONFIG.DEFAULT_GENDER;
let selectedVoice = null;
let availableVoices = [];
