/* ============================================
   SPEAKFLOW - A/B TESTING MODULE
   Version: 1.0.0
   Handles A/B tests, experiment management, and statistical analysis
   ============================================ */

const { validationResult } = require('express-validator');
const { body, param, query } = require('express-validator');
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================

const ABTestConfig = {
    // Statistical Settings
    statistics: {
        significanceLevel: 0.05,
        power: 0.8,
        minimumSampleSize: 1000,
        confidenceLevel: 0.95
    },
    
    // Experiment Settings
    experiments: {
        maxDuration: 90, // days
        minDuration: 7, // days
        defaultTrafficAllocation: 0.5,
        maxVariants: 10
    },
    
    // Metrics
    metrics: {
        types: ['conversion_rate', 'retention', 'engagement', 'revenue', 'custom'],
        defaultPrimaryMetric: 'conversion_rate'
    },
    
    // Cache
    cache: {
        ttl: 300, // 5 minutes
        maxSize: 50
    },
    
    // Pagination
    pagination: {
        defaultLimit: 20,
        maxLimit: 100
    }
};

// ============================================
// DATABASE MODELS (Simulated)
// ============================================

class ABTestModel {
    constructor() {
        this.experiments = [];
        this.assignments = [];
        this.results = [];
        this.metrics = [];
    }
    
    async createExperiment(experimentData) {
        const experiment = {
            id: this.experiments.length + 1,
            experimentId: this.generateExperimentId(),
            name: experimentData.name,
            description: experimentData.description,
            type: experimentData.type,
            variants: experimentData.variants,
            metrics: experimentData.metrics,
            targetMetric: experimentData.targetMetric || ABTestConfig.metrics.defaultPrimaryMetric,
            trafficAllocation: experimentData.trafficAllocation || ABTestConfig.experiments.defaultTrafficAllocation,
            status: experimentData.status || 'draft',
            startDate: experimentData.startDate || null,
            endDate: experimentData.endDate || null,
            hypothesis: experimentData.hypothesis,
            owner: experimentData.owner,
            tags: experimentData.tags || [],
            metadata: experimentData.metadata || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.experiments.push(experiment);
        return experiment;
    }
    
    generateExperimentId() {
        return `exp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    async findExperimentById(id) {
        return this.experiments.find(e => e.id === parseInt(id));
    }
    
    async findExperimentByExperimentId(experimentId) {
        return this.experiments.find(e => e.experimentId === experimentId);
    }
    
    async findAllExperiments(filters = {}, options = {}) {
        let results = [...this.experiments];
        
        // Apply filters
        if (filters.status) {
            results = results.filter(e => e.status === filters.status);
        }
        if (filters.type) {
            results = results.filter(e => e.type === filters.type);
        }
        if (filters.owner) {
            results = results.filter(e => e.owner === filters.owner);
        }
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            results = results.filter(e => 
                e.name.toLowerCase().includes(searchLower) ||
                e.description.toLowerCase().includes(searchLower)
            );
        }
        
        // Apply sorting
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
        results.sort((a, b) => {
            if (a[sortBy] < b[sortBy]) return -sortOrder;
            if (a[sortBy] > b[sortBy]) return sortOrder;
            return 0;
        });
        
        // Apply pagination
        const page = options.page || 1;
        const limit = Math.min(options.limit || ABTestConfig.pagination.defaultLimit, ABTestConfig.pagination.maxLimit);
        const start = (page - 1) * limit;
        const end = start + limit;
        
        return {
            experiments: results.slice(start, end),
            total: results.length,
            page,
            limit,
            totalPages: Math.ceil(results.length / limit)
        };
    }
    
    async updateExperiment(id, updates) {
        const index = this.experiments.findIndex(e => e.id === parseInt(id));
        if (index === -1) return null;
        
        const allowedUpdates = ['name', 'description', 'variants', 'metrics', 'targetMetric', 'trafficAllocation', 'status', 'endDate', 'hypothesis', 'tags', 'metadata'];
        const filteredUpdates = {};
        
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        
        this.experiments[index] = {
            ...this.experiments[index],
            ...filteredUpdates,
            updatedAt: new Date().toISOString()
        };
        
        return this.experiments[index];
    }
    
    async deleteExperiment(id) {
        const index = this.experiments.findIndex(e => e.id === parseInt(id));
        if (index === -1) return false;
        
        this.experiments.splice(index, 1);
        return true;
    }
    
    async assignVariant(experimentId, userId, variantId = null) {
        const experiment = await this.findExperimentById(experimentId);
        if (!experiment) return null;
        
        if (experiment.status !== 'active') return null;
        
        // Check if already assigned
        const existingAssignment = this.assignments.find(a => a.experimentId === experimentId && a.userId === userId);
        if (existingAssignment) {
            return existingAssignment;
        }
        
        // Determine variant
        let assignedVariantId = variantId;
        if (!assignedVariantId) {
            assignedVariantId = this.selectVariant(experiment.variants);
        }
        
        const assignment = {
            id: this.assignments.length + 1,
            assignmentId: this.generateAssignmentId(),
            experimentId,
            experimentName: experiment.name,
            userId,
            variantId: assignedVariantId,
            variantName: experiment.variants.find(v => v.id === assignedVariantId)?.name || assignedVariantId,
            assignedAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            conversions: []
        };
        
        this.assignments.push(assignment);
        return assignment;
    }
    
    generateAssignmentId() {
        return `asg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    selectVariant(variants) {
        const random = Math.random();
        let cumulative = 0;
        
        for (const variant of variants) {
            cumulative += variant.weight || (1 / variants.length);
            if (random <= cumulative) {
                return variant.id;
            }
        }
        
        return variants[0].id;
    }
    
    async trackConversion(experimentId, userId, metric, value = 1, metadata = {}) {
        const assignment = this.assignments.find(a => a.experimentId === experimentId && a.userId === userId);
        if (!assignment) return null;
        
        const conversion = {
            id: this.results.length + 1,
            conversionId: this.generateConversionId(),
            experimentId,
            userId,
            variantId: assignment.variantId,
            metric,
            value,
            metadata,
            timestamp: new Date().toISOString()
        };
        
        this.results.push(conversion);
        
        // Update assignment conversions
        assignment.conversions.push(conversion);
        
        return conversion;
    }
    
    generateConversionId() {
        return `conv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    async getExperimentResults(experimentId) {
        const experiment = await this.findExperimentById(experimentId);
        if (!experiment) return null;
        
        const experimentAssignments = this.assignments.filter(a => a.experimentId === experimentId);
        const experimentResults = this.results.filter(r => r.experimentId === experimentId);
        
        const results = {};
        
        for (const variant of experiment.variants) {
            const variantAssignments = experimentAssignments.filter(a => a.variantId === variant.id);
            const variantResults = experimentResults.filter(r => r.variantId === variant.id);
            
            results[variant.id] = {
                variantId: variant.id,
                variantName: variant.name,
                assignments: variantAssignments.length,
                metrics: {}
            };
            
            for (const metric of experiment.metrics) {
                const metricResults = variantResults.filter(r => r.metric === metric);
                const totalValue = metricResults.reduce((sum, r) => sum + r.value, 0);
                const conversionCount = metricResults.length;
                const conversionRate = variantAssignments.length > 0 ? (conversionCount / variantAssignments.length) * 100 : 0;
                const averageValue = conversionCount > 0 ? totalValue / conversionCount : 0;
                
                results[variant.id].metrics[metric] = {
                    count: conversionCount,
                    totalValue,
                    averageValue,
                    conversionRate
                };
            }
        }
        
        return {
            experimentId,
            experimentName: experiment.name,
            results,
            totalAssignments: experimentAssignments.length,
            totalConversions: experimentResults.length
        };
    }
    
    async getStatisticalSignificance(experimentId, metric) {
        const results = await this.getExperimentResults(experimentId);
        if (!results) return null;
        
        const variants = Object.keys(results.results);
        if (variants.length < 2) return null;
        
        const controlVariant = variants[0];
        const testVariants = variants.slice(1);
        
        const significance = {};
        
        for (const testVariant of testVariants) {
            const controlData = results.results[controlVariant].metrics[metric];
            const testData = results.results[testVariant].metrics[metric];
            
            if (!controlData || !testData) continue;
            
            const controlRate = controlData.conversionRate;
            const testRate = testData.conversionRate;
            const controlCount = controlData.count;
            const testCount = testData.count;
            
            // Calculate z-score and p-value
            const pooledRate = (controlRate * controlCount + testRate * testCount) / (controlCount + testCount);
            const standardError = Math.sqrt(pooledRate * (1 - pooledRate) * (1/controlCount + 1/testCount));
            const zScore = (testRate - controlRate) / standardError;
            const pValue = this.calculatePValue(zScore);
            const isSignificant = pValue < ABTestConfig.statistics.significanceLevel;
            const lift = controlRate > 0 ? ((testRate - controlRate) / controlRate) * 100 : 0;
            
            significance[testVariant] = {
                controlRate,
                testRate,
                difference: testRate - controlRate,
                lift,
                zScore,
                pValue,
                isSignificant,
                confidenceLevel: (1 - pValue) * 100
            };
        }
        
        return significance;
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
    
    async getWinner(experimentId, metric = null) {
        const results = await this.getExperimentResults(experimentId);
        if (!results) return null;
        
        const targetMetric = metric || this.experiments.find(e => e.id === experimentId)?.targetMetric;
        if (!targetMetric) return null;
        
        const variants = Object.keys(results.results);
        let winner = null;
        let bestRate = -1;
        
        for (const variantId of variants) {
            const rate = results.results[variantId].metrics[targetMetric]?.conversionRate || 0;
            if (rate > bestRate) {
                bestRate = rate;
                winner = variantId;
            }
        }
        
        return { winner, bestRate, metric: targetMetric };
    }
    
    async getExperimentStats(experimentId) {
        const experiment = await this.findExperimentById(experimentId);
        if (!experiment) return null;
        
        const assignments = this.assignments.filter(a => a.experimentId === experimentId);
        const uniqueUsers = new Set(assignments.map(a => a.userId)).size;
        const totalConversions = this.results.filter(r => r.experimentId === experimentId).length;
        
        const variantDistribution = {};
        for (const variant of experiment.variants) {
            variantDistribution[variant.id] = assignments.filter(a => a.variantId === variant.id).length;
        }
        
        return {
            experimentId,
            experimentName: experiment.name,
            status: experiment.status,
            startDate: experiment.startDate,
            endDate: experiment.endDate,
            duration: experiment.startDate ? Math.ceil((new Date() - new Date(experiment.startDate)) / (1000 * 60 * 60 * 24)) : 0,
            totalAssignments: assignments.length,
            uniqueUsers,
            totalConversions,
            variantDistribution
        };
    }
}

// ============================================
// A/B TEST SERVICE
// ============================================

class ABTestService {
    constructor(abTestModel) {
        this.abTestModel = abTestModel;
    }
    
    async createExperiment(experimentData, userId) {
        // Validate experiment data
        this.validateExperiment(experimentData);
        
        const experiment = await this.abTestModel.createExperiment({
            ...experimentData,
            owner: userId,
            status: 'draft'
        });
        
        return experiment;
    }
    
    validateExperiment(data) {
        if (!data.name || data.name.length < 3) {
            throw new Error('Experiment name must be at least 3 characters');
        }
        
        if (!data.variants || data.variants.length < 2) {
            throw new Error('At least 2 variants are required');
        }
        
        if (data.variants.length > ABTestConfig.experiments.maxVariants) {
            throw new Error(`Maximum ${ABTestConfig.experiments.maxVariants} variants allowed`);
        }
        
        if (data.trafficAllocation && (data.trafficAllocation < 0 || data.trafficAllocation > 1)) {
            throw new Error('Traffic allocation must be between 0 and 1');
        }
        
        if (data.metrics && data.metrics.length === 0) {
            throw new Error('At least one metric is required');
        }
    }
    
    async startExperiment(experimentId) {
        const experiment = await this.abTestModel.findExperimentById(experimentId);
        if (!experiment) {
            throw new Error('Experiment not found');
        }
        
        if (experiment.status !== 'draft') {
            throw new Error(`Cannot start experiment with status: ${experiment.status}`);
        }
        
        const updated = await this.abTestModel.updateExperiment(experimentId, {
            status: 'active',
            startDate: new Date().toISOString()
        });
        
        return updated;
    }
    
    async pauseExperiment(experimentId) {
        const experiment = await this.abTestModel.findExperimentById(experimentId);
        if (!experiment) {
            throw new Error('Experiment not found');
        }
        
        if (experiment.status !== 'active') {
            throw new Error(`Cannot pause experiment with status: ${experiment.status}`);
        }
        
        const updated = await this.abTestModel.updateExperiment(experimentId, {
            status: 'paused'
        });
        
        return updated;
    }
    
    async stopExperiment(experimentId, winnerVariantId = null) {
        const experiment = await this.abTestModel.findExperimentById(experimentId);
        if (!experiment) {
            throw new Error('Experiment not found');
        }
        
        const updates = {
            status: 'completed',
            endDate: new Date().toISOString()
        };
        
        if (winnerVariantId) {
            updates.winner = winnerVariantId;
        } else {
            // Determine winner automatically
            const winner = await this.abTestModel.getWinner(experimentId);
            if (winner && winner.winner) {
                updates.winner = winner.winner;
            }
        }
        
        const updated = await this.abTestModel.updateExperiment(experimentId, updates);
        
        return updated;
    }
    
    async assignVariant(experimentId, userId) {
        const experiment = await this.abTestModel.findExperimentById(experimentId);
        if (!experiment) {
            throw new Error('Experiment not found');
        }
        
        // Check if user is in experiment (based on traffic allocation)
        const userHash = this.hashUserId(userId);
        if (userHash > experiment.trafficAllocation) {
            return null;
        }
        
        const assignment = await this.abTestModel.assignVariant(experimentId, userId);
        return assignment;
    }
    
    hashUserId(userId) {
        const hash = crypto.createHash('md5').update(String(userId)).digest('hex');
        const intHash = parseInt(hash.substring(0, 8), 16);
        return (intHash % 100) / 100;
    }
    
    async trackConversion(experimentId, userId, metric, value = 1, metadata = {}) {
        const experiment = await this.abTestModel.findExperimentById(experimentId);
        if (!experiment) {
            throw new Error('Experiment not found');
        }
        
        // Check if metric is being tracked
        if (!experiment.metrics.includes(metric)) {
            throw new Error(`Metric "${metric}" is not being tracked for this experiment`);
        }
        
        const conversion = await this.abTestModel.trackConversion(experimentId, userId, metric, value, metadata);
        return conversion;
    }
    
    async getExperimentResults(experimentId, includeStats = true) {
        const experiment = await this.abTestModel.findExperimentById(experimentId);
        if (!experiment) {
            throw new Error('Experiment not found');
        }
        
        const results = await this.abTestModel.getExperimentResults(experimentId);
        const significance = {};
        
        for (const metric of experiment.metrics) {
            significance[metric] = await this.abTestModel.getStatisticalSignificance(experimentId, metric);
        }
        
        const winner = await this.abTestModel.getWinner(experimentId);
        
        const response = {
            experiment: {
                id: experiment.id,
                name: experiment.name,
                description: experiment.description,
                type: experiment.type,
                status: experiment.status,
                startDate: experiment.startDate,
                endDate: experiment.endDate,
                variants: experiment.variants,
                metrics: experiment.metrics,
                targetMetric: experiment.targetMetric
            },
            results,
            significance,
            winner
        };
        
        if (includeStats) {
            const stats = await this.abTestModel.getExperimentStats(experimentId);
            response.stats = stats;
        }
        
        return response;
    }
    
    async getExperimentsList(filters = {}, options = {}) {
        return await this.abTestModel.findAllExperiments(filters, options);
    }
    
    async getActiveExperiments() {
        return await this.abTestModel.findAllExperiments({ status: 'active' });
    }
    
    async deleteExperiment(experimentId) {
        const experiment = await this.abTestModel.findExperimentById(experimentId);
        if (!experiment) {
            throw new Error('Experiment not found');
        }
        
        if (experiment.status === 'active') {
            throw new Error('Cannot delete active experiment. Stop it first.');
        }
        
        return await this.abTestModel.deleteExperiment(experimentId);
    }
    
    async updateExperiment(experimentId, updates) {
        const experiment = await this.abTestModel.findExperimentById(experimentId);
        if (!experiment) {
            throw new Error('Experiment not found');
        }
        
        if (experiment.status === 'active') {
            throw new Error('Cannot update active experiment. Stop it first.');
        }
        
        const updated = await this.abTestModel.updateExperiment(experimentId, updates);
        return updated;
    }
    
    async getExperimentReport(experimentId, format = 'json') {
        const results = await this.getExperimentResults(experimentId);
        
        if (format === 'json') {
            return JSON.stringify(results, null, 2);
        } else if (format === 'csv') {
            return this.convertToCSV(results);
        }
        
        return results;
    }
    
    convertToCSV(results) {
        const rows = [['Variant', 'Metric', 'Count', 'Conversion Rate', 'Lift', 'Significant']];
        
        for (const [variantId, variantData] of Object.entries(results.results.results)) {
            for (const [metric, metricData] of Object.entries(variantData.metrics)) {
                const significance = results.significance[metric]?.[variantId];
                rows.push([
                    variantId,
                    metric,
                    metricData.count,
                    `${metricData.conversionRate.toFixed(2)}%`,
                    significance ? `${significance.lift.toFixed(2)}%` : 'N/A',
                    significance?.isSignificant ? 'Yes' : 'No'
                ]);
            }
        }
        
        return rows.map(row => row.join(',')).join('\n');
    }
}

// ============================================
// VALIDATION RULES
// ============================================

const ABTestValidation = {
    createExperiment: [
        body('name')
            .notEmpty().withMessage('Experiment name is required')
            .isLength({ min: 3, max: 100 }).withMessage('Name must be between 3 and 100 characters'),
        
        body('description')
            .optional()
            .isLength({ max: 500 }).withMessage('Description too long'),
        
        body('type')
            .notEmpty().withMessage('Experiment type is required')
            .isIn(['onboarding', 'pricing', 'ui', 'feature', 'content', 'email'])
            .withMessage('Invalid experiment type'),
        
        body('variants')
            .isArray({ min: 2 }).withMessage('At least 2 variants required')
            .custom((variants) => {
                for (const variant of variants) {
                    if (!variant.id || !variant.name) {
                        throw new Error('Each variant must have id and name');
                    }
                }
                return true;
            }),
        
        body('metrics')
            .isArray({ min: 1 }).withMessage('At least one metric required'),
        
        body('targetMetric')
            .optional()
            .isString().withMessage('Target metric must be a string'),
        
        body('trafficAllocation')
            .optional()
            .isFloat({ min: 0, max: 1 }).withMessage('Traffic allocation must be between 0 and 1'),
        
        body('hypothesis')
            .optional()
            .isString().withMessage('Hypothesis must be a string')
    ],
    
    updateExperiment: [
        body('name')
            .optional()
            .isLength({ min: 3, max: 100 }).withMessage('Name must be between 3 and 100 characters'),
        
        body('description')
            .optional()
            .isLength({ max: 500 }).withMessage('Description too long'),
        
        body('variants')
            .optional()
            .isArray({ min: 2 }).withMessage('At least 2 variants required'),
        
        body('metrics')
            .optional()
            .isArray({ min: 1 }).withMessage('At least one metric required'),
        
        body('trafficAllocation')
            .optional()
            .isFloat({ min: 0, max: 1 }).withMessage('Traffic allocation must be between 0 and 1')
    ],
    
    trackConversion: [
        body('experimentId')
            .notEmpty().withMessage('Experiment ID is required')
            .isInt({ min: 1 }).withMessage('Invalid experiment ID'),
        
        body('metric')
            .notEmpty().withMessage('Metric is required')
            .isString().withMessage('Metric must be a string'),
        
        body('value')
            .optional()
            .isNumeric().withMessage('Value must be a number')
    ],
    
    assignVariant: [
        body('experimentId')
            .notEmpty().withMessage('Experiment ID is required')
            .isInt({ min: 1 }).withMessage('Invalid experiment ID')
    ],
    
    getExperiments: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        
        query('limit')
            .optional()
            .isInt({ min: 1, max: ABTestConfig.pagination.maxLimit })
            .withMessage(`Limit must be between 1 and ${ABTestConfig.pagination.maxLimit}`),
        
        query('status')
            .optional()
            .isIn(['draft', 'active', 'paused', 'completed'])
            .withMessage('Invalid status'),
        
        query('type')
            .optional()
            .isIn(['onboarding', 'pricing', 'ui', 'feature', 'content', 'email'])
            .withMessage('Invalid experiment type')
    ]
};

// ============================================
// A/B TEST ROUTES
// ============================================

function createABTestRoutes(abTestService, authMiddleware) {
    const router = require('express').Router();
    
    // Create experiment
    router.post('/experiments', authMiddleware.authenticate, authMiddleware.requireRole('admin'), ABTestValidation.createExperiment, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const experiment = await abTestService.createExperiment(req.body, req.user.id);
            res.status(201).json(experiment);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get experiments list
    router.get('/experiments', authMiddleware.authenticate, authMiddleware.requireRole('admin'), ABTestValidation.getExperiments, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const filters = {
            status: req.query.status,
            type: req.query.type,
            owner: req.query.owner,
            search: req.query.search
        };
        
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || ABTestConfig.pagination.defaultLimit,
            sortBy: req.query.sortBy || 'createdAt',
            sortOrder: req.query.sortOrder || 'desc'
        };
        
        const experiments = await abTestService.getExperimentsList(filters, options);
        res.json(experiments);
    });
    
    // Get active experiments
    router.get('/experiments/active', authMiddleware.authenticate, async (req, res) => {
        const experiments = await abTestService.getActiveExperiments();
        res.json(experiments);
    });
    
    // Get experiment by ID
    router.get('/experiments/:id', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const experiment = await abTestService.abTestModel.findExperimentById(req.params.id);
        if (!experiment) {
            return res.status(404).json({ error: 'Experiment not found' });
        }
        res.json(experiment);
    });
    
    // Update experiment
    router.put('/experiments/:id', authMiddleware.authenticate, authMiddleware.requireRole('admin'), ABTestValidation.updateExperiment, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const updated = await abTestService.updateExperiment(req.params.id, req.body);
            res.json(updated);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Delete experiment
    router.delete('/experiments/:id', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        try {
            await abTestService.deleteExperiment(req.params.id);
            res.json({ success: true });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Start experiment
    router.post('/experiments/:id/start', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        try {
            const experiment = await abTestService.startExperiment(req.params.id);
            res.json(experiment);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Pause experiment
    router.post('/experiments/:id/pause', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        try {
            const experiment = await abTestService.pauseExperiment(req.params.id);
            res.json(experiment);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Stop experiment
    router.post('/experiments/:id/stop', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        try {
            const experiment = await abTestService.stopExperiment(req.params.id, req.body.winner);
            res.json(experiment);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get experiment results
    router.get('/experiments/:id/results', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const includeStats = req.query.stats !== 'false';
        
        try {
            const results = await abTestService.getExperimentResults(req.params.id, includeStats);
            res.json(results);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Export experiment report
    router.get('/experiments/:id/export', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const format = req.query.format || 'json';
        
        try {
            const report = await abTestService.getExperimentReport(req.params.id, format);
            
            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=experiment_${req.params.id}_report.csv`);
                res.send(report);
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.send(report);
            }
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Assign variant (for frontend)
    router.post('/assign', authMiddleware.authenticate, ABTestValidation.assignVariant, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const assignment = await abTestService.assignVariant(req.body.experimentId, req.user.id);
            res.json({ variant: assignment?.variantId || null });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Track conversion
    router.post('/track', authMiddleware.authenticate, ABTestValidation.trackConversion, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const conversion = await abTestService.trackConversion(
                req.body.experimentId,
                req.user.id,
                req.body.metric,
                req.body.value || 1,
                req.body.metadata || {}
            );
            res.json(conversion);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get experiment stats
    router.get('/experiments/:id/stats', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        try {
            const stats = await abTestService.abTestModel.getExperimentStats(req.params.id);
            res.json(stats);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    return router;
}

// ============================================
// EXPORTS
// ============================================

const abTestModel = new ABTestModel();
const abTestService = new ABTestService(abTestModel);
const abTestRoutes = createABTestRoutes(abTestService, require('./auth').authMiddleware);

module.exports = {
    abTestModel,
    abTestService,
    abTestRoutes,
    ABTestConfig,
    ABTestValidation
};
