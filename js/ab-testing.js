/* ============================================
   SPEAKFLOW - A/B TESTING MODULE
   Version: 1.0.0
   Handles A/B testing, experiment management, and statistical analysis
   ============================================ */

// ============================================
// A/B TESTING CONFIGURATION
// ============================================

const ABTestConfig = {
    // API Endpoints
    api: {
        getExperiments: '/api/ab-test/experiments',
        track: '/api/ab-test/track',
        assign: '/api/ab-test/assign',
        results: '/api/ab-test/results'
    },
    
    // Default Settings
    defaults: {
        trafficAllocation: 0.5,
        confidenceLevel: 0.95,
        minSampleSize: 1000,
        maxDurationDays: 30,
        minDurationDays: 7
    },
    
    // Statistical Settings
    statistics: {
        significanceLevel: 0.05,
        power: 0.8,
        effectSize: 0.2,
        correctionMethod: 'bonferroni'
    },
    
    // Experiment Types
    experimentTypes: {
        onboarding: 'onboarding',
        pricing: 'pricing',
        ui: 'ui',
        feature: 'feature',
        content: 'content',
        email: 'email'
    },
    
    // Storage Keys
    storage: {
        assignments: 'ab_test_assignments',
        experiments: 'ab_test_experiments'
    }
};

// ============================================
// EXPERIMENT MANAGER
// ============================================

class ExperimentManager {
    constructor() {
        this.experiments = new Map();
        this.assignments = new Map();
        this.results = new Map();
        this.init();
    }
    
    init() {
        this.loadExperiments();
        this.loadAssignments();
        this.setupStorageSync();
    }
    
    loadExperiments() {
        const saved = localStorage.getItem(ABTestConfig.storage.experiments);
        if (saved) {
            try {
                const experiments = JSON.parse(saved);
                experiments.forEach(exp => this.experiments.set(exp.id, exp));
            } catch (e) {
                console.error('Failed to load experiments:', e);
            }
        }
        
        // Load default experiments if none exist
        if (this.experiments.size === 0) {
            this.loadDefaultExperiments();
        }
    }
    
    loadDefaultExperiments() {
        const defaultExperiments = [
            {
                id: 'onboarding_flow_v2',
                name: 'Onboarding Flow Optimization',
                description: 'Test simplified vs step-by-step onboarding',
                type: ABTestConfig.experimentTypes.onboarding,
                variants: [
                    { id: 'A', name: 'Current', weight: 0.5, config: { steps: 3, timeEstimate: 120 } },
                    { id: 'B', name: 'Simplified', weight: 0.5, config: { steps: 1, timeEstimate: 45 } }
                ],
                metrics: ['completion_rate', 'time_to_complete', 'retention_day7'],
                startDate: new Date().toISOString(),
                status: 'active',
                trafficAllocation: 1.0
            },
            {
                id: 'pricing_page_layout',
                name: 'Pricing Page Layout Test',
                description: 'Test different pricing page layouts',
                type: ABTestConfig.experimentTypes.pricing,
                variants: [
                    { id: 'A', name: 'Current Layout', weight: 0.5, config: { style: 'grid', showAnnual: true } },
                    { id: 'B', name: 'Highlighted Premium', weight: 0.5, config: { style: 'cards', showAnnual: true, highlightPopular: true } }
                ],
                metrics: ['conversion_rate', 'average_revenue', 'click_through_rate'],
                startDate: new Date().toISOString(),
                status: 'active',
                trafficAllocation: 0.5
            },
            {
                id: 'practice_button_color',
                name: 'Practice Button Color Test',
                description: 'Test different CTA button colors',
                type: ABTestConfig.experimentTypes.ui,
                variants: [
                    { id: 'A', name: 'Blue', weight: 0.5, config: { color: '#3b82f6', text: 'Start Practice' } },
                    { id: 'B', name: 'Green', weight: 0.5, config: { color: '#10b981', text: 'Practice Now' } }
                ],
                metrics: ['click_rate', 'practice_start_rate'],
                startDate: new Date().toISOString(),
                status: 'active',
                trafficAllocation: 0.3
            }
        ];
        
        defaultExperiments.forEach(exp => {
            this.experiments.set(exp.id, exp);
        });
        
        this.saveExperiments();
    }
    
    loadAssignments() {
        const saved = localStorage.getItem(ABTestConfig.storage.assignments);
        if (saved) {
            try {
                const assignments = JSON.parse(saved);
                assignments.forEach(assignment => {
                    const key = `${assignment.experimentId}_${assignment.userId}`;
                    this.assignments.set(key, assignment);
                });
            } catch (e) {
                console.error('Failed to load assignments:', e);
            }
        }
    }
    
    setupStorageSync() {
        window.addEventListener('beforeunload', () => {
            this.saveExperiments();
            this.saveAssignments();
        });
    }
    
    saveExperiments() {
        const experimentsArray = Array.from(this.experiments.values());
        localStorage.setItem(ABTestConfig.storage.experiments, JSON.stringify(experimentsArray));
    }
    
    saveAssignments() {
        const assignmentsArray = Array.from(this.assignments.values());
        localStorage.setItem(ABTestConfig.storage.assignments, JSON.stringify(assignmentsArray));
    }
    
    getExperiment(experimentId) {
        return this.experiments.get(experimentId);
    }
    
    getAllExperiments() {
        return Array.from(this.experiments.values());
    }
    
    getActiveExperiments() {
        return Array.from(this.experiments.values()).filter(exp => exp.status === 'active');
    }
    
    async assignVariant(experimentId, userId) {
        const experiment = this.getExperiment(experimentId);
        if (!experiment) return null;
        
        if (experiment.status !== 'active') return null;
        
        // Check if already assigned
        const existingKey = `${experimentId}_${userId}`;
        if (this.assignments.has(existingKey)) {
            return this.assignments.get(existingKey);
        }
        
        // Check if user should be included (traffic allocation)
        const userHash = this.hashUserId(userId);
        if (userHash > experiment.trafficAllocation) {
            return null;
        }
        
        // Assign variant based on weights
        const variant = this.selectVariant(experiment.variants);
        
        const assignment = {
            experimentId,
            userId,
            variantId: variant.id,
            assignedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            conversions: []
        };
        
        this.assignments.set(existingKey, assignment);
        this.saveAssignments();
        
        // Track assignment event
        this.trackAssignment(experiment, variant, userId);
        
        return assignment;
    }
    
    selectVariant(variants) {
        const random = Math.random();
        let cumulative = 0;
        
        for (const variant of variants) {
            cumulative += variant.weight;
            if (random <= cumulative) {
                return variant;
            }
        }
        
        return variants[0];
    }
    
    hashUserId(userId) {
        // Simple hash function for consistent assignment
        let hash = 0;
        const str = String(userId);
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash % 100) / 100;
    }
    
    trackAssignment(experiment, variant, userId) {
        const event = {
            type: 'ab_test_assignment',
            experimentId: experiment.id,
            experimentName: experiment.name,
            variantId: variant.id,
            variantName: variant.name,
            userId,
            timestamp: new Date().toISOString()
        };
        
        // Dispatch event for analytics
        const customEvent = new CustomEvent('ab:assignment', { detail: event });
        document.dispatchEvent(customEvent);
        
        console.log(`[AB Test] Assigned ${userId} to ${experiment.name} - Variant ${variant.id}`);
    }
    
    trackConversion(experimentId, userId, metric, value = 1) {
        const key = `${experimentId}_${userId}`;
        const assignment = this.assignments.get(key);
        
        if (!assignment) return false;
        
        const experiment = this.getExperiment(experimentId);
        if (!experiment) return false;
        
        // Check if metric is being tracked
        if (!experiment.metrics.includes(metric)) return false;
        
        assignment.conversions.push({
            metric,
            value,
            timestamp: new Date().toISOString()
        });
        
        this.assignments.set(key, assignment);
        this.saveAssignments();
        
        // Track conversion event
        const event = {
            type: 'ab_test_conversion',
            experimentId,
            userId,
            variantId: assignment.variantId,
            metric,
            value,
            timestamp: new Date().toISOString()
        };
        
        const customEvent = new CustomEvent('ab:conversion', { detail: event });
        document.dispatchEvent(customEvent);
        
        console.log(`[AB Test] Conversion for ${experiment.name} - ${metric}: ${value}`);
        
        return true;
    }
    
    createExperiment(experimentData) {
        const id = `${experimentData.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
        const experiment = {
            id,
            ...experimentData,
            createdAt: new Date().toISOString(),
            status: 'draft'
        };
        
        this.experiments.set(id, experiment);
        this.saveExperiments();
        
        return experiment;
    }
    
    startExperiment(experimentId) {
        const experiment = this.getExperiment(experimentId);
        if (!experiment) return false;
        
        experiment.status = 'active';
        experiment.startDate = new Date().toISOString();
        this.saveExperiments();
        
        return true;
    }
    
    pauseExperiment(experimentId) {
        const experiment = this.getExperiment(experimentId);
        if (!experiment) return false;
        
        experiment.status = 'paused';
        this.saveExperiments();
        
        return true;
    }
    
    stopExperiment(experimentId) {
        const experiment = this.getExperiment(experimentId);
        if (!experiment) return false;
        
        experiment.status = 'completed';
        experiment.endDate = new Date().toISOString();
        this.saveExperiments();
        
        return true;
    }
}

// ============================================
// STATISTICAL ANALYZER
// ============================================

class StatisticalAnalyzer {
    constructor() {
        this.results = new Map();
    }
    
    async analyzeExperiment(experiment, assignments) {
        const experimentAssignments = Array.from(assignments.values())
            .filter(a => a.experimentId === experiment.id);
        
        const results = {};
        
        for (const variant of experiment.variants) {
            const variantAssignments = experimentAssignments.filter(a => a.variantId === variant.id);
            const metrics = {};
            
            for (const metric of experiment.metrics) {
                const conversions = variantAssignments.flatMap(a => 
                    a.conversions.filter(c => c.metric === metric)
                );
                
                const totalUsers = variantAssignments.length;
                const convertedUsers = new Set(conversions.map(c => c.userId)).size;
                const conversionRate = totalUsers > 0 ? (convertedUsers / totalUsers) * 100 : 0;
                
                const values = conversions.map(c => c.value);
                const averageValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
                
                metrics[metric] = {
                    totalUsers,
                    convertedUsers,
                    conversionRate,
                    totalConversions: conversions.length,
                    averageValue,
                    sumValue: values.reduce((a, b) => a + b, 0)
                };
            }
            
            results[variant.id] = metrics;
        }
        
        // Perform statistical tests
        const significance = this.calculateSignificance(results, experiment);
        
        const analysis = {
            experimentId: experiment.id,
            experimentName: experiment.name,
            results,
            significance,
            winner: this.determineWinner(results, significance),
            recommendations: this.generateRecommendations(results, significance),
            analyzedAt: new Date().toISOString()
        };
        
        this.results.set(experiment.id, analysis);
        
        return analysis;
    }
    
    calculateSignificance(results, experiment) {
        const significance = {};
        
        for (const metric of experiment.metrics) {
            const variantAScore = results['A']?.[metric]?.conversionRate || 0;
            const variantBScore = results['B']?.[metric]?.conversionRate || 0;
            
            // Calculate z-score and p-value
            const difference = variantBScore - variantAScore;
            const standardError = this.calculateStandardError(variantAScore, variantBScore);
            const zScore = difference / standardError;
            const pValue = this.calculatePValue(zScore);
            const isSignificant = pValue < ABTestConfig.statistics.significanceLevel;
            
            const lift = variantAScore > 0 ? ((variantBScore - variantAScore) / variantAScore) * 100 : 0;
            
            significance[metric] = {
                variantAScore,
                variantBScore,
                difference,
                lift,
                zScore,
                pValue,
                isSignificant,
                confidenceLevel: (1 - pValue) * 100
            };
        }
        
        return significance;
    }
    
    calculateStandardError(rateA, rateB) {
        // Simplified standard error calculation
        const pPooled = (rateA + rateB) / 200;
        return Math.sqrt(pPooled * (1 - pPooled) * (1/1000 + 1/1000));
    }
    
    calculatePValue(zScore) {
        // Simplified p-value calculation
        // In production, use proper statistical library
        const absZ = Math.abs(zScore);
        if (absZ > 3.89) return 0.0001;
        if (absZ > 3.29) return 0.001;
        if (absZ > 2.58) return 0.01;
        if (absZ > 1.96) return 0.05;
        if (absZ > 1.64) return 0.10;
        return 0.5;
    }
    
    determineWinner(results, significance) {
        let winner = null;
        let maxImprovement = 0;
        
        for (const metric in significance) {
            const metricSignificance = significance[metric];
            if (metricSignificance.isSignificant && metricSignificance.lift > maxImprovement) {
                maxImprovement = metricSignificance.lift;
                winner = metricSignificance.variantBScore > metricSignificance.variantAScore ? 'B' : 'A';
            }
        }
        
        return winner;
    }
    
    generateRecommendations(results, significance) {
        const recommendations = [];
        
        for (const metric in significance) {
            const sig = significance[metric];
            
            if (sig.isSignificant && sig.lift > 5) {
                recommendations.push({
                    type: 'promote',
                    metric,
                    message: `Variant B shows ${sig.lift.toFixed(1)}% improvement in ${metric}. Consider promoting to all users.`,
                    confidence: sig.confidenceLevel
                });
            } else if (sig.isSignificant && sig.lift < -5) {
                recommendations.push({
                    type: 'revert',
                    metric,
                    message: `Variant B shows ${Math.abs(sig.lift).toFixed(1)}% decrease in ${metric}. Consider keeping Variant A.`,
                    confidence: sig.confidenceLevel
                });
            } else if (sig.pValue < 0.2) {
                recommendations.push({
                    type: 'continue',
                    metric,
                    message: `${metric} shows trending but not yet significant. Continue test for more data.`,
                    confidence: sig.confidenceLevel
                });
            } else {
                recommendations.push({
                    type: 'inconclusive',
                    metric,
                    message: `No significant difference detected in ${metric}. Need more data or test different variant.`,
                    confidence: sig.confidenceLevel
                });
            }
        }
        
        return recommendations;
    }
    
    calculateSampleSizeNeeded(effectSize, power = 0.8, alpha = 0.05) {
        // Simplified sample size calculation
        // In production, use proper statistical formula
        const zAlpha = 1.96;
        const zBeta = 0.84;
        
        const sampleSize = 2 * Math.pow(zAlpha + zBeta, 2) * (effectSize * (1 - effectSize)) / Math.pow(effectSize, 2);
        
        return Math.ceil(sampleSize);
    }
    
    getExperimentResults(experimentId) {
        return this.results.get(experimentId);
    }
}

// ============================================
// A/B TEST UI CONTROLLER
// ============================================

class ABTestUIController {
    constructor(experimentManager, statisticalAnalyzer) {
        this.manager = experimentManager;
        this.analyzer = statisticalAnalyzer;
        this.elements = {};
        this.activeTests = new Map();
        this.init();
    }
    
    init() {
        this.bindElements();
        this.bindEvents();
        this.setupListeners();
        this.renderExperiments();
    }
    
    bindElements() {
        this.elements = {
            experimentsContainer: document.getElementById('abTestsContainer'),
            createTestBtn: document.getElementById('createNewTestBtn'),
            promoteVariantBtn: document.getElementById('promoteVariantBBtn'),
            testResults: document.getElementById('testResults')
        };
    }
    
    bindEvents() {
        if (this.elements.createTestBtn) {
            this.elements.createTestBtn.addEventListener('click', () => this.showCreateTestModal());
        }
        
        if (this.elements.promoteVariantBtn) {
            this.elements.promoteVariantBtn.addEventListener('click', () => this.promoteWinner());
        }
    }
    
    setupListeners() {
        document.addEventListener('ab:assignment', (e) => {
            this.handleAssignment(e.detail);
        });
        
        document.addEventListener('ab:conversion', (e) => {
            this.handleConversion(e.detail);
        });
    }
    
    renderExperiments() {
        const experiments = this.manager.getAllExperiments();
        
        if (this.elements.experimentsContainer) {
            this.elements.experimentsContainer.innerHTML = experiments.map(exp => `
                <div class="ab-test-card variant-${exp.status === 'active' ? 'active' : 'completed'}" data-experiment-id="${exp.id}">
                    <div class="test-header">
                        <h3>${exp.name}</h3>
                        <span class="test-status status-${exp.status}">${exp.status.toUpperCase()}</span>
                    </div>
                    <p class="test-description">${exp.description}</p>
                    <div class="test-metrics">
                        <div class="metric">
                            <span class="metric-label">Type:</span>
                            <span class="metric-value">${exp.type}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Traffic:</span>
                            <span class="metric-value">${(exp.trafficAllocation * 100)}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Started:</span>
                            <span class="metric-value">${new Date(exp.startDate).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="test-variants">
                        ${exp.variants.map(v => `
                            <div class="variant">
                                <div class="variant-header">
                                    <strong>Variant ${v.id}</strong>: ${v.name}
                                    <span class="variant-weight">${(v.weight * 100)}% traffic</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="test-actions">
                        ${exp.status === 'active' ? `
                            <button class="btn btn-sm btn-outline view-results-btn" data-id="${exp.id}">View Results</button>
                            <button class="btn btn-sm btn-outline stop-test-btn" data-id="${exp.id}">Stop Test</button>
                        ` : `
                            <button class="btn btn-sm btn-primary view-results-btn" data-id="${exp.id}">View Report</button>
                        `}
                    </div>
                </div>
            `).join('');
            
            // Attach event listeners
            document.querySelectorAll('.view-results-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = btn.dataset.id;
                    this.showTestResults(id);
                });
            });
            
            document.querySelectorAll('.stop-test-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = btn.dataset.id;
                    this.stopTest(id);
                });
            });
        }
    }
    
    async showTestResults(experimentId) {
        const experiment = this.manager.getExperiment(experimentId);
        if (!experiment) return;
        
        // Get assignments for this experiment
        const assignments = Array.from(this.manager.assignments.values())
            .filter(a => a.experimentId === experimentId);
        
        const analysis = await this.analyzer.analyzeExperiment(experiment, this.manager.assignments);
        
        if (this.elements.testResults) {
            this.elements.testResults.innerHTML = `
                <div class="results-modal">
                    <div class="results-header">
                        <h2>${experiment.name} - Results</h2>
                        <button class="close-results">&times;</button>
                    </div>
                    <div class="results-summary">
                        <div class="summary-card">
                            <div class="summary-label">Total Users</div>
                            <div class="summary-value">${assignments.length}</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Duration</div>
                            <div class="summary-value">${this.getDurationDays(experiment.startDate)} days</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Winner</div>
                            <div class="summary-value">${analysis.winner ? `Variant ${analysis.winner}` : 'None yet'}</div>
                        </div>
                    </div>
                    <div class="results-metrics">
                        <h3>Metric Comparison</h3>
                        ${Object.entries(analysis.significance).map(([metric, sig]) => `
                            <div class="metric-comparison">
                                <div class="metric-name">${metric}</div>
                                <div class="comparison-bars">
                                    <div class="bar-label">Variant A: ${sig.variantAScore.toFixed(1)}%</div>
                                    <div class="bar-container">
                                        <div class="bar bar-a" style="width: ${sig.variantAScore}%"></div>
                                    </div>
                                    <div class="bar-label">Variant B: ${sig.variantBScore.toFixed(1)}%</div>
                                    <div class="bar-container">
                                        <div class="bar bar-b" style="width: ${sig.variantBScore}%"></div>
                                    </div>
                                </div>
                                <div class="metric-stats">
                                    <span class="lift ${sig.lift > 0 ? 'positive' : 'negative'}">
                                        ${sig.lift > 0 ? '+' : ''}${sig.lift.toFixed(1)}% lift
                                    </span>
                                    <span class="significance ${sig.isSignificant ? 'significant' : 'not-significant'}">
                                        ${sig.isSignificant ? '✓ Statistically Significant' : 'Not yet significant'}
                                    </span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="results-recommendations">
                        <h3>Recommendations</h3>
                        <ul>
                            ${analysis.recommendations.map(rec => `
                                <li>
                                    <strong>${rec.type}:</strong> ${rec.message}
                                    <span class="confidence">(${rec.confidence.toFixed(1)}% confidence)</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    <div class="results-actions">
                        ${analysis.winner ? `
                            <button class="btn btn-primary promote-winner" data-winner="${analysis.winner}">Promote Variant ${analysis.winner}</button>
                        ` : ''}
                        <button class="btn btn-outline continue-test">Continue Test</button>
                    </div>
                </div>
            `;
            
            // Show modal
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.innerHTML = this.elements.testResults.innerHTML;
            document.body.appendChild(modal);
            
            // Close modal
            modal.querySelector('.close-results')?.addEventListener('click', () => {
                modal.remove();
            });
            
            // Promote winner
            modal.querySelector('.promote-winner')?.addEventListener('click', () => {
                this.promoteVariant(experimentId, analysis.winner);
                modal.remove();
            });
        }
    }
    
    getDurationDays(startDate) {
        const start = new Date(startDate);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    async promoteVariant(experimentId, variantId) {
        const experiment = this.manager.getExperiment(experimentId);
        if (!experiment) return;
        
        // Stop the experiment
        this.manager.stopExperiment(experimentId);
        
        // Track promotion
        const event = {
            type: 'ab_test_promotion',
            experimentId,
            experimentName: experiment.name,
            variantId,
            timestamp: new Date().toISOString()
        };
        
        const customEvent = new CustomEvent('ab:promotion', { detail: event });
        document.dispatchEvent(customEvent);
        
        alert(`✅ Variant ${variantId} promoted to all users! The experiment has been stopped.`);
        
        this.renderExperiments();
    }
    
    async stopTest(experimentId) {
        if (confirm('Are you sure you want to stop this test?')) {
            this.manager.stopExperiment(experimentId);
            this.renderExperiments();
            alert('Test stopped successfully.');
        }
    }
    
    showCreateTestModal() {
        const modalHtml = `
            <div class="modal active">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Create New A/B Test</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Test Name</label>
                            <input type="text" id="testName" class="form-control" placeholder="e.g., New Onboarding Flow">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea id="testDescription" class="form-control" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Test Type</label>
                            <select id="testType" class="form-control">
                                <option value="onboarding">Onboarding</option>
                                <option value="pricing">Pricing</option>
                                <option value="ui">UI/UX</option>
                                <option value="feature">Feature</option>
                                <option value="content">Content</option>
                                <option value="email">Email</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Traffic Allocation (%)</label>
                            <input type="range" id="trafficAllocation" min="0" max="100" value="50" class="form-control">
                            <span id="trafficValue">50%</span>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Metrics to Track</label>
                            <div class="checkbox-group">
                                <label><input type="checkbox" value="conversion_rate"> Conversion Rate</label>
                                <label><input type="checkbox" value="retention_day7"> 7-Day Retention</label>
                                <label><input type="checkbox" value="engagement_time"> Engagement Time</label>
                                <label><input type="checkbox" value="click_rate"> Click Rate</label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" id="createTestConfirm">Create Test</button>
                        <button class="btn btn-outline modal-close">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.innerHTML = modalHtml;
        document.body.appendChild(modal);
        
        // Traffic allocation slider
        const slider = modal.querySelector('#trafficAllocation');
        const trafficValue = modal.querySelector('#trafficValue');
        slider?.addEventListener('input', (e) => {
            trafficValue.textContent = `${e.target.value}%`;
        });
        
        // Create test
        modal.querySelector('#createTestConfirm')?.addEventListener('click', () => {
            const name = modal.querySelector('#testName').value;
            const description = modal.querySelector('#testDescription').value;
            const type = modal.querySelector('#testType').value;
            const trafficAllocation = parseInt(modal.querySelector('#trafficAllocation').value) / 100;
            
            const metrics = Array.from(modal.querySelectorAll('.checkbox-group input:checked'))
                .map(cb => cb.value);
            
            if (name && description) {
                const experiment = this.manager.createExperiment({
                    name,
                    description,
                    type,
                    variants: [
                        { id: 'A', name: 'Control', weight: 0.5, config: {} },
                        { id: 'B', name: 'Treatment', weight: 0.5, config: {} }
                    ],
                    metrics,
                    trafficAllocation
                });
                
                this.manager.startExperiment(experiment.id);
                this.renderExperiments();
                modal.remove();
                alert(`Test "${name}" created and started!`);
            } else {
                alert('Please fill in all required fields');
            }
        });
        
        // Close modal
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
    }
    
    promoteWinner() {
        // Find experiment with significant winner
        const activeExperiments = this.manager.getActiveExperiments();
        for (const exp of activeExperiments) {
            const assignments = Array.from(this.manager.assignments.values())
                .filter(a => a.experimentId === exp.id);
            
            if (assignments.length > 100) {
                this.showTestResults(exp.id);
                return;
            }
        }
        
        alert('No experiments with significant results found yet. Keep testing!');
    }
    
    handleAssignment(data) {
        console.log('AB Test Assignment:', data);
        // Update UI based on variant
        this.applyVariantChanges(data.experimentId, data.variantId);
    }
    
    handleConversion(data) {
        console.log('AB Test Conversion:', data);
    }
    
    applyVariantChanges(experimentId, variantId) {
        const experiment = this.manager.getExperiment(experimentId);
        if (!experiment) return;
        
        const variant = experiment.variants.find(v => v.id === variantId);
        if (!variant) return;
        
        // Apply UI changes based on experiment
        switch (experimentId) {
            case 'practice_button_color':
                this.applyButtonColorVariant(variant);
                break;
            case 'onboarding_flow_v2':
                this.applyOnboardingVariant(variant);
                break;
            case 'pricing_page_layout':
                this.applyPricingVariant(variant);
                break;
        }
    }
    
    applyButtonColorVariant(variant) {
        const buttons = document.querySelectorAll('.btn-primary');
        buttons.forEach(btn => {
            if (variant.config.color) {
                btn.style.backgroundColor = variant.config.color;
            }
            if (variant.config.text) {
                btn.textContent = variant.config.text;
            }
        });
    }
    
    applyOnboardingVariant(variant) {
        localStorage.setItem('onboarding_variant', variant.id);
        if (variant.config.steps === 1) {
            // Simplified onboarding
            console.log('Using simplified onboarding');
        }
    }
    
    applyPricingVariant(variant) {
        localStorage.setItem('pricing_variant', variant.id);
        if (variant.config.highlightPopular) {
            const popularCard = document.querySelector('.pricing-card.popular');
            if (popularCard) {
                popularCard.style.border = '3px solid var(--color-warning)';
            }
        }
    }
}

// ============================================
// EXPORTS
// ============================================

// Initialize A/B testing system
const experimentManager = new ExperimentManager();
const statisticalAnalyzer = new StatisticalAnalyzer();
const abTestUI = new ABTestUIController(experimentManager, statisticalAnalyzer);

// Global exports
window.SpeakFlow = window.SpeakFlow || {};
window.SpeakFlow.ABTest = {
    manager: experimentManager,
    analyzer: statisticalAnalyzer,
    ui: abTestUI,
    config: ABTestConfig
};

// Module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ABTestConfig,
        ExperimentManager,
        StatisticalAnalyzer,
        ABTestUIController
    };
}

// ============================================
// AUTO-INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('A/B Testing module initialized');
    
    // Track page view as conversion for active experiments
    const userId = localStorage.getItem('userId') || 'anonymous';
    
    // Assign variants for active experiments
    const activeExperiments = experimentManager.getActiveExperiments();
    activeExperiments.forEach(exp => {
        experimentManager.assignVariant(exp.id, userId);
    });
    
    // Debug mode
    if (window.location.hostname === 'localhost') {
        window.debugABTest = {
            manager: experimentManager,
            analyzer: statisticalAnalyzer
        };
        console.log('A/B Testing debug mode enabled');
    }
});
