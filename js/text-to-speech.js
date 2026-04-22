// ============ TEXT TO SPEECH with Accents & Gender ============

async function loadVoices() {
    return new Promise((resolve) => {
        let voices = window.speechSynthesis.getVoices();
        if (voices.length) {
            resolve(voices);
        } else {
            window.speechSynthesis.onvoiceschanged = () => {
                resolve(window.speechSynthesis.getVoices());
            };
        }
    });
}

async function setVoiceForAccentAndGender(accent, gender) {
    const voices = await loadVoices();
    const config = CONFIG.ACCENTS[accent];
    const genderConfig = CONFIG.GENDERS[gender];
    
    if (!config) return null;
    
    // Try to find matching voice
    let foundVoice = voices.find(v => v.lang === config.lang && v.name.toLowerCase().includes(gender));
    if (!foundVoice) {
        foundVoice = voices.find(v => v.lang === config.lang);
    }
    if (!foundVoice) {
        foundVoice = voices.find(v => v.lang.startsWith('en'));
    }
    
    selectedVoice = foundVoice;
    return selectedVoice;
}

function speakWithAccent(text, accent, gender, callback) {
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
    
    const config = CONFIG.ACCENTS[accent];
    const genderConfig = CONFIG.GENDERS[gender];
    
    if (!config) {
        console.error('Accent not found:', accent);
        return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }
    
    utterance.lang = config.lang;
    utterance.rate = config.rate * (gender === 'male' ? 0.95 : 1.0);
    utterance.pitch = genderConfig.pitch;
    utterance.volume = 1;
    
    utterance.onend = function() {
        if (callback) callback();
    };
    
    utterance.onerror = function() {
        if (callback) callback();
    };
    
    window.speechSynthesis.speak(utterance);
}

function testAccent(accent, gender) {
    const sampleText = `Hello! This is ${CONFIG.ACCENTS[accent].name
