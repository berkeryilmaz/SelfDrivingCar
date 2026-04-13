import { Environment } from './environment.js';
import { Car } from './car.js';
import { Agent } from './agent.js';
import { UI } from './ui.js';
import { WindowManager } from './window-manager.js';

class Simulation {
    constructor() {
        this.simCanvas = document.getElementById('sim-canvas');
        this.nnCanvas = document.getElementById('nn-canvas');
        this.simCtx = this.simCanvas.getContext('2d');
        this.nnCtx = this.nnCanvas.getContext('2d');

        this.environment = new Environment(this.simCanvas);
        this.car = new Car(
            this.environment.spawnPoint.x,
            this.environment.spawnPoint.y,
            this.environment.spawnAngle
        );
        this.agent = new Agent(8, 9);
        this.ui = new UI();

        this.training = false;
        this.episode = 0;
        this.stepCount = 0;
        this.episodeReward = 0;
        this.bestReward = -Infinity;
        this.maxStepsPerEpisode = 1500;
        this.simSpeed = 1;
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;

        this.wallSegments = this.environment.getWallSegments();

        this.setupThemeToggle();
        this.setupEventListeners();
        this.setupWindowManager();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.ui.elements.nnArchInfo.textContent = this.agent.network.getArchString();

        this.lastState = null;
        this.lastAction = null;

        this.nnUpdateCounter = 0;
        this.nnUpdateFreq = 10;

        requestAnimationFrame(() => this.loop());
    }

    setupWindowManager() {
        this.windowManager = new WindowManager(() => this.resize());
        this.windowManager.register('sim-panel', 'Simulation');
        this.windowManager.register('nn-panel', 'Neural Network');
        this.windowManager.register('control-panel', 'Controls');
    }

    resize() {
        const simWrapper = document.getElementById('sim-canvas-wrapper');
        const nnWrapper = document.getElementById('nn-canvas-wrapper');

        this.simCanvas.width = simWrapper.clientWidth * devicePixelRatio;
        this.simCanvas.height = simWrapper.clientHeight * devicePixelRatio;
        this.nnCanvas.width = nnWrapper.clientWidth * devicePixelRatio;
        this.nnCanvas.height = nnWrapper.clientHeight * devicePixelRatio;

        const envWidth = 800;
        const envHeight = 600;
        const scaleX = (simWrapper.clientWidth) / envWidth;
        const scaleY = (simWrapper.clientHeight) / envHeight;
        this.scale = Math.min(scaleX, scaleY) * 0.9;
    }

    setupThemeToggle() {
        const saved = localStorage.getItem('sdcar-theme');
        if (saved === 'light') {
            document.body.setAttribute('data-theme', 'light');
        }
        document.getElementById('btn-theme-toggle').addEventListener('click', () => {
            const isLight = document.body.getAttribute('data-theme') === 'light';
            if (isLight) {
                document.body.removeAttribute('data-theme');
                localStorage.setItem('sdcar-theme', 'dark');
            } else {
                document.body.setAttribute('data-theme', 'light');
                localStorage.setItem('sdcar-theme', 'light');
            }
        });
    }

    setupEventListeners() {
        this.ui.elements.btnTrain.addEventListener('click', () => this.startTraining());
        this.ui.elements.btnStop.addEventListener('click', () => this.stopTraining());
        this.ui.elements.btnReset.addEventListener('click', () => this.resetAll());
        this.ui.elements.btnDraw.addEventListener('click', () => this.toggleDrawMode());

        // Random path button
        document.getElementById('btn-random').addEventListener('click', () => this.generateRandomPath());

        this.ui.elements.sliderEpsilon.addEventListener('input', (e) => {
            this.agent.setEpsilon(parseFloat(e.target.value));
        });
        this.ui.elements.sliderLR.addEventListener('input', (e) => {
            this.agent.setLearningRate(parseFloat(e.target.value));
        });
        this.ui.elements.sliderGamma.addEventListener('input', (e) => {
            this.agent.setGamma(parseFloat(e.target.value));
        });

        const speedRow = document.getElementById('speed-btn-row');
        speedRow.addEventListener('click', (e) => {
            const btn = e.target.closest('.speed-btn');
            if (!btn) return;
            const speed = parseInt(btn.dataset.speed);
            this.simSpeed = speed;
            this.ui.elements.valSpeed.textContent = speed + 'x';
            speedRow.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });

        document.getElementById('btn-zoom-in').addEventListener('click', () => {
            this.scale *= 1.2;
        });
        document.getElementById('btn-zoom-out').addEventListener('click', () => {
            this.scale /= 1.2;
        });

        this.simCanvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.simCanvas.addEventListener('contextmenu', (e) => this.handleCanvasRightClick(e));

        // Middle mouse button panning
        this.simCanvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) {
                e.preventDefault();
                this.isPanning = true;
                this.panStartX = e.clientX - this.panX;
                this.panStartY = e.clientY - this.panY;
                this.simCanvas.style.cursor = 'grabbing';
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                this.panX = e.clientX - this.panStartX;
                this.panY = e.clientY - this.panStartY;
            }
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 1 && this.isPanning) {
                this.isPanning = false;
                this.simCanvas.style.cursor = '';
            }
        });
        // Prevent default middle-click scroll behavior
        this.simCanvas.addEventListener('auxclick', (e) => {
            if (e.button === 1) e.preventDefault();
        });

        // Draw toolbar controls
        this.setupDrawToolbar();

        this.setupNetworkEditor();
    }

    setupDrawToolbar() {
        const widthSlider = document.getElementById('draw-road-width');
        const widthVal = document.getElementById('draw-road-width-val');
        const pointCount = document.getElementById('draw-point-count');

        widthSlider.addEventListener('input', () => {
            widthVal.textContent = widthSlider.value;
            this.drawRoadWidth = parseInt(widthSlider.value);
        });
        this.drawRoadWidth = parseInt(widthSlider.value);

        document.getElementById('btn-draw-undo').addEventListener('click', () => {
            if (this.ui.drawCenterline.length > 0) {
                this.ui.drawCenterline.pop();
                this.updateDrawPointCount();
            }
        });

        document.getElementById('btn-draw-clear').addEventListener('click', () => {
            this.ui.drawCenterline = [];
            this.updateDrawPointCount();
        });

        document.getElementById('btn-draw-apply').addEventListener('click', () => {
            this.applyDrawnTrack();
        });
    }

    updateDrawPointCount() {
        const el = document.getElementById('draw-point-count');
        const n = this.ui.drawCenterline.length;
        el.textContent = n + (n === 1 ? ' point' : ' points');
        el.style.color = n >= 4 ? 'var(--success)' : 'var(--text-muted)';
    }

    setupNetworkEditor() {
        const modal = document.getElementById('nn-edit-modal');
        const input = document.getElementById('nn-edit-input');
        const preview = document.getElementById('nn-edit-preview');
        const archInfo = document.getElementById('nn-arch-info');

        archInfo.addEventListener('click', () => {
            const currentHidden = this.agent.network.hiddenSizes.join(', ');
            input.value = currentHidden;
            this.updateArchPreview();
            modal.style.display = 'grid';
            input.focus();
            input.select();
        });

        input.addEventListener('input', () => this.updateArchPreview());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.applyNetworkArchitecture();
            }
            if (e.key === 'Escape') {
                modal.style.display = 'none';
            }
        });

        document.getElementById('nn-edit-close').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        document.getElementById('nn-edit-cancel').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        document.getElementById('nn-edit-apply').addEventListener('click', () => {
            this.applyNetworkArchitecture();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    updateArchPreview() {
        const input = document.getElementById('nn-edit-input');
        const preview = document.getElementById('nn-edit-preview');
        const parsed = this.parseHiddenLayers(input.value);
        if (parsed) {
            const arch = [8, ...parsed, 9].join(' → ');
            preview.textContent = 'Architecture: ' + arch;
            preview.style.color = '';
        } else {
            preview.textContent = 'Invalid format — use comma-separated numbers';
            preview.style.color = 'var(--danger)';
        }
    }

    parseHiddenLayers(str) {
        const trimmed = str.trim();
        if (!trimmed) return null;
        const parts = trimmed.split(',').map(s => s.trim());
        const nums = [];
        for (const p of parts) {
            const n = parseInt(p);
            if (isNaN(n) || n < 1 || n > 1024) return null;
            nums.push(n);
        }
        return nums.length > 0 ? nums : null;
    }

    async applyNetworkArchitecture() {
        const input = document.getElementById('nn-edit-input');
        const modal = document.getElementById('nn-edit-modal');
        const parsed = this.parseHiddenLayers(input.value);
        if (!parsed) return;

        this.stopTraining();
        this.episode = 0;
        this.stepCount = 0;
        this.episodeReward = 0;
        this.bestReward = -Infinity;
        this.ui.rewardHistory = [];

        this.agent.dispose();
        
        const { Agent } = await import('./agent.js');
        const { Network } = await import('./network.js');
        
        this.agent = new Agent(8, 9);
        this.agent.network.dispose();

        this.agent.network = new Network(8, 9, parsed, parseFloat(this.ui.elements.sliderLR.value));
        this.agent.stateSize = 8;
        this.agent.actionSize = 9;

        this.ui.elements.nnArchInfo.textContent = this.agent.network.getArchString();
        this.resetEpisode();
        this.ui.updateMetrics(0, 0, this.agent.epsilon, 0, -Infinity);

        modal.style.display = 'none';
    }

    handleCanvasClick(e) {
        if (!this.ui.drawMode) return;
        // Don't capture clicks on toolbar buttons
        if (e.target.closest('.draw-toolbar')) return;
        const rect = this.simCanvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.panX) / this.scale;
        const y = (e.clientY - rect.top - this.panY) / this.scale;
        this.ui.drawCenterline.push({ x, y });
        this.updateDrawPointCount();
    }

    handleCanvasRightClick(e) {
        e.preventDefault();
        if (!this.ui.drawMode) return;
        // Right-click = apply track (shortcut)
        if (this.ui.drawCenterline.length >= 4) {
            this.applyDrawnTrack();
        }
    }

    applyDrawnTrack() {
        if (this.ui.drawCenterline.length < 4) return;

        // Smooth the centerline
        const smoothed = this.environment.catmullRomSpline(this.ui.drawCenterline, 8);
        const [outer, inner] = this.environment.buildTrackFromCenterline(smoothed, this.drawRoadWidth);

        this.environment.setCustomWalls([outer, inner]);
        this.wallSegments = this.environment.getWallSegments();

        this.ui.setDrawing(false);
        this.ui.drawCenterline = [];
        this.updateDrawPointCount();
        this.resetEpisode();
    }

    toggleDrawMode() {
        if (this.ui.drawMode) {
            this.ui.setDrawing(false);
            this.ui.drawCenterline = [];
        } else {
            this.stopTraining();
            this.ui.drawCenterline = [];
            this.ui.setDrawing(true);
            this.updateDrawPointCount();
        }
    }

    generateRandomPath() {
        this.stopTraining();
        if (this.ui.drawMode) {
            this.ui.setDrawing(false);
            this.ui.drawCenterline = [];
        }
        this.environment.generateRandomTrack();
        this.wallSegments = this.environment.getWallSegments();
        this.resetEpisode();
    }

    startTraining() {
        if (this.ui.drawMode) return;
        this.training = true;
        this.ui.setTraining(true);
        this.resetEpisode();
    }

    stopTraining() {
        this.training = false;
        this.ui.setTraining(false);
    }

    resetAll() {
        this.stopTraining();
        this.episode = 0;
        this.stepCount = 0;
        this.episodeReward = 0;
        this.bestReward = -Infinity;
        this.ui.rewardHistory = [];
        this.agent.dispose();
        this.agent = new Agent(8, 9);
        this.environment.setDefaultMap();
        this.wallSegments = this.environment.getWallSegments();
        this.ui.drawCenterline = [];
        this.resetEpisode();
        this.ui.updateMetrics(0, 0, 1.0, 0, -Infinity);
    }

    resetEpisode() {
        this.car.reset(
            this.environment.spawnPoint.x,
            this.environment.spawnPoint.y,
            this.environment.spawnAngle
        );
        this.car.sensors.update(this.wallSegments);
        this.lastState = this.car.getState();
        this.lastAction = null;
        this.stepCount = 0;
        this.episodeReward = 0;
    }

    computeReward(prevState, car) {
        if (!car.alive) return -10;

        let reward = 0;

        reward += car.speed * 0.5;

        reward += car.checkpointsPassed * 5;

        const frontDist = car.sensors.readings[0];
        if (frontDist < 0.15) reward -= 2;
        else if (frontDist < 0.3) reward -= 0.5;

        const minSensor = Math.min(...car.sensors.readings);
        if (minSensor < 0.1) reward -= 1;

        const steerAmount = Math.abs(car.steeringAngle) / car.maxSteer;
        reward -= steerAmount * 0.3;

        if (car.speed < 0.3) reward -= 0.5;

        const centerBonus = Math.min(
            car.sensors.readings[2],
            car.sensors.readings[3]
        );
        reward += centerBonus * 0.3;

        return reward;
    }

    async step() {
        if (!this.car.alive || this.stepCount >= this.maxStepsPerEpisode) {
            this.episode++;
            this.ui.addReward(this.episodeReward);
            if (this.episodeReward > this.bestReward) {
                this.bestReward = this.episodeReward;
            }
            this.ui.updateMetrics(
                this.episode,
                this.episodeReward,
                this.agent.epsilon,
                this.stepCount,
                this.bestReward
            );
            this.resetEpisode();
            return;
        }

        const state = this.car.getState();
        const actionIdx = this.agent.chooseAction(state);
        const action = this.agent.getAction(actionIdx);

        this.car.applyAction(action.steer, action.throttle);

        const prevCheckpoints = this.car.checkpointsPassed;
        this.car.update(this.wallSegments, this.environment.checkpoints);

        const reward = this.computeReward(state, this.car);
        const nextState = this.car.getState();
        const done = !this.car.alive || this.stepCount >= this.maxStepsPerEpisode - 1;

        this.agent.remember(state, actionIdx, reward, nextState, done);
        await this.agent.replay();

        this.episodeReward += reward;
        this.stepCount++;
        this.lastState = nextState;
        this.lastAction = actionIdx;
    }

    renderSim() {
        const ctx = this.simCtx;
        const w = this.simCanvas.width / devicePixelRatio;
        const h = this.simCanvas.height / devicePixelRatio;

        ctx.save();
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const style = getComputedStyle(document.body);
        const simBg = style.getPropertyValue('--sim-bg').trim();
        ctx.fillStyle = simBg;
        ctx.fillRect(0, 0, w, h);

        // Apply pan offset
        ctx.translate(this.panX, this.panY);

        const gridSize = 40 * this.scale;
        ctx.strokeStyle = style.getPropertyValue('--sim-grid-color').trim();
        ctx.lineWidth = 0.5;
        // Draw grid with pan offset awareness
        const gridOffsetX = this.panX % gridSize;
        const gridOffsetY = this.panY % gridSize;
        for (let x = -gridSize + gridOffsetX - this.panX; x < w - this.panX + gridSize; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, -this.panY);
            ctx.lineTo(x, h - this.panY);
            ctx.stroke();
        }
        for (let y = -gridSize + gridOffsetY - this.panY; y < h - this.panY + gridSize; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(-this.panX, y);
            ctx.lineTo(w - this.panX, y);
            ctx.stroke();
        }

        this.environment.render(ctx, this.scale);

        if (this.ui.drawMode) {
            this.ui.renderDrawPreview(ctx, this.scale, this.drawRoadWidth || 80);
        }

        this.car.render(ctx, this.scale);

        ctx.restore();
    }

    renderNN() {
        this.nnUpdateCounter++;
        if (this.nnUpdateCounter % this.nnUpdateFreq !== 0) return;

        const state = this.car.getState();
        const activations = this.agent.network.extractActivations(state);
        const weights = this.agent.network.extractWeightsForVis();
        this.ui.renderNeuralNetwork(
            this.nnCanvas,
            activations,
            weights,
            this.agent.network.layerSizes
        );
    }

    loop() {
        if (this.training) {
            for (let i = 0; i < this.simSpeed; i++) {
                this.step();
            }
        }

        const sensorData = this.car.sensors.getNormalized();
        this.ui.updateTelemetry(
            sensorData,
            this.car.steeringAngle,
            this.car.rpm,
            this.car.maxSteer
        );

        this.renderSim();
        this.renderNN();
        this.ui.renderRewardChart();

        requestAnimationFrame(() => this.loop());
    }
}

window.addEventListener('load', async () => {
    await tf.ready();
    tf.setBackend('cpu');
    new Simulation();
});
