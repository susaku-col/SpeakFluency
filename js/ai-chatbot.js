// ============ AI CHATBOT with Memory & API Support ============

let conversationMemory = [];
let userInfo = { name: null, interest: null, lastTopic: null };

// Local response database (fallback jika API tidak tersedia)
const localResponses = {
    greetings: {
        patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
        response: "Hello! Great to see you! How are you doing today?",
        alternatives: ["Hi there!", "Hey! How's your day?", "Good to meet you!"]
    },
    howAreYou: {
        patterns: ['how are you', "how're you", "how do you do", "how's it going"],
        response: "I'm doing fantastic, thanks for asking! How about you?",
        alternatives: ["I'm great!", "Wonderful!", "I'm doing well!"]
    },
    weather: {
        patterns: ['weather', 'sunny', 'rain', 'cloudy', 'hot', 'cold'],
        response: "The weather has been lovely lately! Do you enjoy this kind of weather?",
        alternatives: ["What's your favorite season?", "Do you prefer sunny or rainy days?"]
    },
    food: {
        patterns: ['food', 'eat', 'meal', 'breakfast', 'lunch', 'dinner', 'restaurant'],
        response: "Food is a great topic! What's your favorite dish?",
        alternatives: ["Do you enjoy cooking?", "What cuisine do you like?"]
    },
    hobby: {
        patterns: ['hobby', 'like to', 'enjoy', 'love to', 'free time', 'weekend'],
        response: "That sounds interesting! Tell me more about your hobbies.",
        alternatives: ["How did you get started?", "What do you enjoy most about it?"]
    },
    travel: {
        patterns: ['travel', 'vacation', 'holiday', 'trip', 'visit', 'beach'],
        response: "Traveling is amazing! Where's your favorite place you've visited?",
        alternatives: ["What's your dream destination?", "Do you prefer beach or mountains?"]
    },
    work: {
        patterns: ['work', 'job', 'company', 'office', 'career', 'student', 'study'],
        response: "That's fascinating! What do you like most about your work or studies?",
        alternatives: ["Tell me about your daily routine!", "What inspired you to choose that path?"]
    },
    bye: {
        patterns: ['bye', 'goodbye', 'see you', 'later', 'exit'],
        response: "Goodbye! It was great talking with you. Keep practicing English!",
        alternatives: ["Take care!", "See you next time!", "Bye! Keep learning!"]
    },
    default: {
        response: "That's interesting! Could you tell me more about that?",
        alternatives: ["Tell me more!", "That's a great point!", "Interesting perspective!"]
    }
};

function detectTopic(text) {
    const lowerText = text.toLowerCase();
    for (const [topic, data] of Object.entries(localResponses)) {
        if (topic === 'default') continue;
        if (data.patterns && data.patterns.some(pattern => lowerText.includes(pattern))) {
            return topic;
        }
    }
    return 'default';
}

function getGrammarCorrection(text) {
    const corrections = [];
    let correctedText = text;
    
    const rules = [
        { error: /\bi is\b/gi, correction: "I am", message: "Use 'I am' instead of 'I is'" },
        { error: /\byou is\b/gi, correction: "you are", message: "Use 'you are' instead of 'you is'" },
        { error: /\bthey is\b/gi, correction: "they are", message: "Use 'they are' instead of 'they is'" },
        { error: /\bgo to home\b/gi, correction: "go home", message: "Say 'go home' not 'go to home'" },
        { error: /\blisten music\b/gi, correction: "listen to music", message: "Add 'to': 'listen to music'" }
    ];
    
    for (const rule of rules) {
        if (rule.error.test(correctedText)) {
            correctedText = correctedText.replace(rule.error, rule.correction);
            corrections.push(rule.message);
        }
    }
    
    return { hasCorrection: corrections.length > 0, correctedText, messages: corrections };
}

// Local response generator (tanpa API)
function generateLocalResponse(userText) {
    const topic = detectTopic(userText);
    const responseData = localResponses[topic] || localResponses.default;
    
    // Extract name
    const nameMatch = userText.match(/my name is (\w+)/i) || userText.match(/i am (\w+)/i);
    if (nameMatch && nameMatch[1] && !userInfo.name) {
        userInfo.name = nameMatch[1];
    }
    
    let response = responseData.response;
    if (userInfo.name && topic === 'greetings') {
        response = `Nice to see you again, ${userInfo.name}! ` + response;
    }
    
    return {
        response: response,
        alternatives: responseData.alternatives || ["Tell me more!", "That's interesting!", "I'd love to hear more!"]
    };
}

// API-based response generator (untuk future - OpenAI/Gemini)
async function generateAPIResponse(userText) {
    if (!CONFIG.USE_API || !CONFIG.OPENAI_API_KEY) {
        return generateLocalResponse(userText);
    }
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: CONFIG.AI_MODEL,
                messages: [
                    { role: 'system', content: 'You are a friendly English conversation partner. Keep responses short and natural.' },
                    ...conversationMemory.slice(-5).map(m => ({ role: m.role, content: m.text })),
                    { role: 'user', content: userText }
                ],
                max_tokens: CONFIG.MAX_TOKENS,
                temperature: CONFIG.TEMPERATURE
            })
        });
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        return {
            response: aiResponse,
            alternatives: ["That's interesting!", "Tell me more!", "Great point!"]
        };
    } catch (error) {
        console.error('API Error:', error);
        return generateLocalResponse(userText);
    }
}

// Main function to get AI response
async function getAIResponse(userText, useAPI = false) {
    // Save to memory
    conversationMemory.push({ role: 'user', text: userText, timestamp: new Date() });
    if (conversationMemory.length > 20) conversationMemory.shift();
    
    const grammarCheck = getGrammarCorrection(userText);
    let responseData;
    
    if (useAPI && CONFIG.USE_API) {
        responseData = await generateAPIResponse(userText);
    } else {
        responseData = generateLocalResponse(userText);
    }
    
    conversationMemory.push({ role: 'assistant', text: responseData.response, timestamp: new Date() });
    
    return {
        response: responseData.response,
        alternatives: responseData.alternatives,
        grammarCorrection: grammarCheck
    };
}

function clearMemory() {
    conversationMemory = [];
    userInfo = { name: null, interest: null, lastTopic: null };
}

function getMemorySummary() {
    return {
        memoryLength: conversationMemory.length,
        userName: userInfo.name,
        lastTopic: userInfo.lastTopic
    };
}
