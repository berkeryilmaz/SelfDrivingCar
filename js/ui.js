export class UI {
    constructor() {
        this.rewardHistory = [];
        this.maxRewardHistory = 200;
        this.drawMode = false;
        this.drawCenterline = [];

        this.elements = {
            episode: document.getElementById('metric-episode'),
            reward: document.getElementById('metric-reward'),
            epsilon: document.getElementById('metric-epsilon'),
            steps: document.getElementById('metric-steps'),
            best: document.getElementById('metric-best'),
            statusIndicator: document.getElementById('status-indicator'),
            statusText: document.getElementById('status-text'),
            btnTrain: document.getElementById('btn-train'),
            btnStop: document.getElementById('btn-stop'),
            btnReset: document.getElementById('btn-reset'),
            btnDraw: document.getElementById('btn-draw'),
            sliderEpsilon: document.getElementById('slider-epsilon'),
            sliderLR: document.getElementById('slider-lr'),
            sliderGamma: document.getElementById('slider-gamma'),
            valEpsilon: document.getElementById('val-epsilon'),
            valLR: document.getElementById('val-lr'),
            valGamma: document.getElementById('val-gamma'),
            valSpeed: document.getElementById('val-speed'),
            drawOverlay: document.getElementById('draw-overlay'),
            rewardChart: document.getElementById('reward-chart'),
            nnArchInfo: document.getElementById('nn-arch-info')
        };

        this.sensorBars = {
            front: { bar: document.getElementById('telem-front'), val: document.getElementById('telem-val-front') },
            back: { bar: document.getElementById('telem-back'), val: document.getElementById('telem-val-back') },
            left: { bar: document.getElementById('telem-left'), val: document.getElementById('telem-val-left') },
            right: { bar: document.getElementById('telem-right'), val: document.getElementById('telem-val-right') },
            fl: { bar: document.getElementById('telem-fl'), val: document.getElementById('telem-val-fl') },
            fr: { bar: document.getElementById('telem-fr'), val: document.getElementById('telem-val-fr') },
            steer: { bar: document.getElementById('telem-steer'), val: document.getElementById('telem-val-steer') },
            rpm: { bar: document.getElementById('telem-rpm'), val: document.getElementById('telem-val-rpm') }
        };

        this.setupSliders();
    }

    setupSliders() {
        this.elements.sliderEpsilon.addEventListener('input', () => {
            this.elements.valEpsilon.textContent = parseFloat(this.elements.sliderEpsilon.value).toFixed(2);
        });
        this.elements.sliderLR.addEventListener('input', () => {
            this.elements.valLR.textContent = parseFloat(this.elements.sliderLR.value).toFixed(4);
        });
        this.elements.sliderGamma.addEventListener('input', () => {
            this.elements.valGamma.textContent = parseFloat(this.elements.sliderGamma.value).toFixed(3);
        });
    }

    updateMetrics(episode, reward, epsilon, steps, best) {
        this.elements.episode.textContent = episode;
        this.elements.reward.textContent = reward.toFixed(2);
        this.elements.epsilon.textContent = epsilon.toFixed(3);
        this.elements.steps.textContent = steps;
        this.elements.best.textContent = best === -Infinity ? '-∞' : best.toFixed(2);
        this.elements.sliderEpsilon.value = epsilon;
        this.elements.valEpsilon.textContent = epsilon.toFixed(2);
    }

    updateTelemetry(sensorData, steeringAngle, rpm, maxSteer) {
        const keys = ['front', 'back', 'left', 'right', 'fl', 'fr'];
        for (let i = 0; i < keys.length; i++) {
            const pct = sensorData[i] * 100;
            this.sensorBars[keys[i]].bar.style.width = pct + '%';
            this.sensorBars[keys[i]].val.textContent = sensorData[i].toFixed(2);
        }

        const steerPct = ((steeringAngle / maxSteer) + 1) / 2 * 100;
        this.sensorBars.steer.bar.style.width = steerPct + '%';
        this.sensorBars.steer.val.textContent = (steeringAngle * 180 / Math.PI).toFixed(1) + '°';

        const rpmPct = rpm * 100;
        this.sensorBars.rpm.bar.style.width = rpmPct + '%';
        this.sensorBars.rpm.val.textContent = (rpm * 6000).toFixed(0);
    }

    setTraining(active) {
        this.elements.btnTrain.disabled = active;
        this.elements.btnStop.disabled = !active;
        this.elements.statusIndicator.className = 'status-indicator' + (active ? ' training' : '');
        this.elements.statusText.textContent = active ? 'Training' : 'Idle';
    }

    setDrawing(active) {
        this.drawMode = active;
        this.elements.drawOverlay.style.display = active ? 'flex' : 'none';
        this.elements.btnDraw.classList.toggle('active', active);
        this.elements.statusIndicator.className = 'status-indicator' + (active ? ' drawing' : '');
        this.elements.statusText.textContent = active ? 'Drawing' : 'Idle';
        if (!active) {
            this.drawCenterline = [];
        }
    }

    addReward(reward) {
        this.rewardHistory.push(reward);
        if (this.rewardHistory.length > this.maxRewardHistory) {
            this.rewardHistory.shift();
        }
    }

    renderRewardChart() {
        const canvas = this.elements.rewardChart;
        const ctx = canvas.getContext('2d');
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * devicePixelRatio;
        canvas.height = rect.height * devicePixelRatio;
        ctx.scale(devicePixelRatio, devicePixelRatio);
        const w = rect.width;
        const h = rect.height;

        ctx.clearRect(0, 0, w, h);

        if (this.rewardHistory.length < 2) return;

        const data = this.rewardHistory;
        const min = Math.min(...data) - 10;
        const max = Math.max(...data) + 10;
        const range = max - min || 1;

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(108, 92, 231, 0.3)');
        grad.addColorStop(1, 'rgba(108, 92, 231, 0)');

        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let i = 0; i < data.length; i++) {
            const x = (i / (data.length - 1)) * w;
            const y = h - ((data[i] - min) / range) * (h - 10);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
            const x = (i / (data.length - 1)) * w;
            const y = h - ((data[i] - min) / range) * (h - 10);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#6c5ce7';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    renderNeuralNetwork(canvas, activations, weights, layerSizes) {
        const ctx = canvas.getContext('2d');
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * devicePixelRatio;
        canvas.height = rect.height * devicePixelRatio;
        ctx.scale(devicePixelRatio, devicePixelRatio);
        const w = rect.width;
        const h = rect.height;

        const bodyStyle = getComputedStyle(document.body);
        const nnBg = bodyStyle.getPropertyValue('--nn-bg').trim();
        const labelColor = bodyStyle.getPropertyValue('--nn-node-label').trim();
        const layerLabelColor = bodyStyle.getPropertyValue('--nn-layer-label').trim();
        const mutedColor = bodyStyle.getPropertyValue('--text-muted').trim();

        if (nnBg && nnBg !== 'transparent') {
            ctx.fillStyle = nnBg;
            ctx.fillRect(0, 0, w, h);
        } else {
            ctx.clearRect(0, 0, w, h);
        }

        const numLayers = layerSizes.length;
        const padding = 60;
        const layerSpacing = (w - padding * 2) / (numLayers - 1);

        const maxNodesDisplay = 16;
        const nodeRadius = 8;

        const nodePositions = [];

        const inputLabels = ['Front', 'Back', 'Left', 'Right', 'F-L', 'F-R', 'Steer', 'RPM'];
        const outputLabels = ['L+Slow', 'L+Med', 'L+Fast', 'F+Slow', 'F+Med', 'F+Fast', 'R+Slow', 'R+Med', 'R+Fast'];

        for (let l = 0; l < numLayers; l++) {
            const numNodes = Math.min(layerSizes[l], maxNodesDisplay);
            const truncated = layerSizes[l] > maxNodesDisplay;
            const nodeSpacing = Math.min(24, (h - padding * 2) / (numNodes + 1));
            const startY = h / 2 - (numNodes - 1) * nodeSpacing / 2;
            const x = padding + l * layerSpacing;
            const positions = [];

            for (let n = 0; n < numNodes; n++) {
                const y = startY + n * nodeSpacing;
                positions.push({ x, y });
            }
            nodePositions.push(positions);

            ctx.fillStyle = layerLabelColor;
            ctx.font = '10px Inter';
            ctx.textAlign = 'center';
            if (l === 0) {
                ctx.fillText('Input', x, padding - 30);
                ctx.fillStyle = mutedColor;
                ctx.fillText(`(${layerSizes[l]})`, x, padding - 18);
            } else if (l === numLayers - 1) {
                ctx.fillText('Output', x, padding - 30);
                ctx.fillStyle = mutedColor;
                ctx.fillText(`(${layerSizes[l]})`, x, padding - 18);
            } else {
                ctx.fillText(`Hidden ${l}`, x, padding - 30);
                ctx.fillStyle = mutedColor;
                ctx.fillText(`(${layerSizes[l]})`, x, padding - 18);
            }

            if (truncated) {
                ctx.fillStyle = mutedColor;
                ctx.font = '9px Inter';
                ctx.fillText(`...${layerSizes[l] - maxNodesDisplay} more`, x, startY + numNodes * nodeSpacing + 12);
            }
        }

        if (weights && weights.length > 0) {
            for (let l = 0; l < nodePositions.length - 1; l++) {
                const from = nodePositions[l];
                const to = nodePositions[l + 1];
                const wData = weights[l];

                for (let i = 0; i < from.length; i++) {
                    for (let j = 0; j < to.length; j++) {
                        let wVal = 0;
                        if (wData && wData.data) {
                            const idx = i * wData.shape[1] + j;
                            if (idx < wData.data.length) {
                                wVal = wData.data[idx];
                            }
                        }

                        const absW = Math.min(Math.abs(wVal), 2) / 2;
                        const alpha = 0.05 + absW * 0.4;
                        const color = wVal >= 0
                            ? `rgba(85, 239, 196, ${alpha})`
                            : `rgba(255, 107, 107, ${alpha})`;

                        ctx.beginPath();
                        ctx.moveTo(from[i].x, from[i].y);
                        ctx.lineTo(to[j].x, to[j].y);
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 0.5 + absW * 1.5;
                        ctx.stroke();
                    }
                }
            }
        }

        for (let l = 0; l < nodePositions.length; l++) {
            const positions = nodePositions[l];
            const acts = activations && activations[l] ? activations[l] : null;

            for (let n = 0; n < positions.length; n++) {
                const { x, y } = positions[n];
                let activation = 0;
                if (acts && n < acts.length) {
                    activation = acts[n];
                }

                const absAct = Math.min(Math.abs(activation), 1);

                ctx.beginPath();
                ctx.arc(x, y, nodeRadius + 2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(108, 92, 231, ${0.1 + absAct * 0.3})`;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
                const nodeGrad = ctx.createRadialGradient(x, y, 0, x, y, nodeRadius);
                if (activation >= 0) {
                    nodeGrad.addColorStop(0, `rgba(85, 239, 196, ${0.3 + absAct * 0.7})`);
                    nodeGrad.addColorStop(1, `rgba(0, 206, 201, ${0.2 + absAct * 0.5})`);
                } else {
                    nodeGrad.addColorStop(0, `rgba(255, 107, 107, ${0.3 + absAct * 0.7})`);
                    nodeGrad.addColorStop(1, `rgba(238, 90, 36, ${0.2 + absAct * 0.5})`);
                }
                ctx.fillStyle = nodeGrad;
                ctx.fill();

                ctx.strokeStyle = `rgba(162, 155, 254, ${0.3 + absAct * 0.5})`;
                ctx.lineWidth = 1;
                ctx.stroke();

                if (l === 0 && n < inputLabels.length) {
                    ctx.fillStyle = labelColor;
                    ctx.font = '9px Inter';
                    ctx.textAlign = 'right';
                    ctx.fillText(inputLabels[n], x - nodeRadius - 6, y + 3);
                }

                if (l === nodePositions.length - 1 && n < outputLabels.length) {
                    ctx.fillStyle = labelColor;
                    ctx.font = '9px Inter';
                    ctx.textAlign = 'left';
                    ctx.fillText(outputLabels[n], x + nodeRadius + 6, y + 3);

                    if (acts) {
                        const maxIdx = acts.indexOf(Math.max(...acts));
                        if (n === maxIdx) {
                            ctx.beginPath();
                            ctx.arc(x, y, nodeRadius + 4, 0, Math.PI * 2);
                            ctx.strokeStyle = 'rgba(254, 202, 87, 0.8)';
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        }
                    }
                }
            }
        }
    }

    renderDrawPreview(ctx, scale = 1, roadWidth = 80) {
        ctx.save();
        ctx.scale(scale, scale);

        const pts = this.drawCenterline;

        if (pts.length >= 4) {
            // Generate spline preview
            const n = pts.length;
            const splinePoints = [];
            const segments = 8;
            for (let i = 0; i < n; i++) {
                const p0 = pts[(i - 1 + n) % n];
                const p1 = pts[i];
                const p2 = pts[(i + 1) % n];
                const p3 = pts[(i + 2) % n];
                for (let t = 0; t < segments; t++) {
                    const s = t / segments;
                    const s2 = s * s;
                    const s3 = s2 * s;
                    const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * s + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3);
                    const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * s + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3);
                    splinePoints.push({ x, y });
                }
            }

            // Draw road width preview (semi-transparent fill)
            const hw = roadWidth / 2;
            const outerPts = [];
            const innerPts = [];
            const sn = splinePoints.length;
            for (let i = 0; i < sn; i++) {
                const prev = splinePoints[(i - 1 + sn) % sn];
                const curr = splinePoints[i];
                const next = splinePoints[(i + 1) % sn];
                const tx = (next.x - prev.x);
                const ty = (next.y - prev.y);
                const tLen = Math.hypot(tx, ty) || 1;
                const nx = -ty / tLen;
                const ny = tx / tLen;
                outerPts.push({ x: curr.x + nx * hw, y: curr.y + ny * hw });
                innerPts.push({ x: curr.x - nx * hw, y: curr.y - ny * hw });
            }

            // Road fill
            ctx.beginPath();
            ctx.moveTo(outerPts[0].x, outerPts[0].y);
            for (let i = 1; i < outerPts.length; i++) ctx.lineTo(outerPts[i].x, outerPts[i].y);
            ctx.closePath();
            ctx.moveTo(innerPts[0].x, innerPts[0].y);
            for (let i = innerPts.length - 1; i >= 0; i--) ctx.lineTo(innerPts[i].x, innerPts[i].y);
            ctx.closePath();
            ctx.fillStyle = 'rgba(254, 202, 87, 0.08)';
            ctx.fill('evenodd');

            // Road edges
            ctx.beginPath();
            ctx.moveTo(outerPts[0].x, outerPts[0].y);
            for (let i = 1; i < outerPts.length; i++) ctx.lineTo(outerPts[i].x, outerPts[i].y);
            ctx.closePath();
            ctx.strokeStyle = 'rgba(254, 202, 87, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.beginPath();
            ctx.moveTo(innerPts[0].x, innerPts[0].y);
            for (let i = 1; i < innerPts.length; i++) ctx.lineTo(innerPts[i].x, innerPts[i].y);
            ctx.closePath();
            ctx.strokeStyle = 'rgba(254, 202, 87, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Smooth centerline
            ctx.beginPath();
            ctx.moveTo(splinePoints[0].x, splinePoints[0].y);
            for (let i = 1; i < splinePoints.length; i++) {
                ctx.lineTo(splinePoints[i].x, splinePoints[i].y);
            }
            ctx.closePath();
            ctx.strokeStyle = 'rgba(254, 202, 87, 0.6)';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (pts.length >= 2) {
            // Just draw lines between points (not enough for spline)
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                ctx.lineTo(pts[i].x, pts[i].y);
            }
            ctx.strokeStyle = 'rgba(254, 202, 87, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw control points with numbers
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            // Outer ring
            ctx.beginPath();
            ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? 'rgba(85, 239, 196, 0.3)' : 'rgba(254, 202, 87, 0.2)';
            ctx.fill();
            ctx.strokeStyle = i === 0 ? '#55efc4' : '#feca57';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Inner dot
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? '#55efc4' : '#feca57';
            ctx.fill();

            // Point number
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = '9px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(i + 1, p.x, p.y - 10);
        }

        // Instruction text at bottom
        if (pts.length < 4) {
            const canvasW = ctx.canvas.width / (scale * devicePixelRatio);
            const canvasH = ctx.canvas.height / (scale * devicePixelRatio);
            ctx.fillStyle = 'rgba(254, 202, 87, 0.6)';
            ctx.font = '13px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const needed = 4 - pts.length;
            ctx.fillText(
                `Click to place road centerline points (${needed} more needed)`,
                canvasW / 2 / scale,
                (canvasH - 20) / scale
            );
        }

        ctx.restore();
    }
}
