// ============ GAMIFICATION SYSTEM ============
let totalXP = localStorage.getItem('speakflow_xp') ? parseInt(localStorage.getItem('speakflow_xp')) : 0;
let streak = localStorage.getItem('speakflow_streak') ? parseInt(localStorage.getItem('speakflow_streak')) : 0;
let lastActive = localStorage.getItem('speakflow_last_active') || new Date().toDateString();

function checkStreak() {
    const today = new Date().toDateString();
    if (lastActive !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastActive === yesterday.toDateString()) {
            streak++;
        } else {
            streak = 1;
        }
        localStorage.setItem('speakflow_streak', streak);
        localStorage.setItem('speakflow_last_active', today);
        updateDisplay();
    }
}

function addXP(amount) {
    totalXP += amount;
    localStorage.setItem('speakflow_xp', totalXP);
    updateDisplay();
    checkAchievements();
    showToast(`+${amount} XP earned! Total: ${totalXP} XP`);
}

function updateDisplay() {
    const userXPElement = document.getElementById('userXP');
    const userStreakElement = document.getElementById('userStreak');
    const displayXPElement = document.getElementById('displayXP');
    const displayStreakElement = document.getElementById('displayStreak');
    const displayLevelElement = document.getElementById('displayLevel');
    const levelProgressElement = document.getElementById('levelProgress');
    
    if (userXPElement) userXPElement.innerText = totalXP;
    if (userStreakElement) userStreakElement.innerText = streak;
    if (displayXPElement) displayXPElement.innerText = totalXP;
    if (displayStreakElement) displayStreakElement.innerText = streak;
    
    let level = Math.floor(totalXP / CONFIG.XP_LEVEL_MULTIPLIER) + 1;
    if (displayLevelElement) displayLevelElement.innerText = level;
    
    let progress = (totalXP % CONFIG.XP_LEVEL_MULTIPLIER);
    if (levelProgressElement) levelProgressElement.style.width = progress + '%';
}

function checkAchievements() {
    const achievementsList = document.getElementById('achievementsList');
    if (achievementsList) {
        achievementsList.innerHTML = `
            <li>🏅 First Lesson - ${totalXP >= 10 ? '✅' : '❌'}</li>
            <li>🎯 100 XP - ${totalXP >= 100 ? '✅' : '❌'}</li>
            <li>🔥 7 Day Streak - ${streak >= 7 ? '✅' : '❌'}</li>
            <li>🗣️ 10 Conversations - ${totalXP >= 250 ? '✅' : '❌'}</li>
            <li>⭐ Level 5 - ${totalXP >= 500 ? '✅' : '❌'}</li>
        `;
    }
}
