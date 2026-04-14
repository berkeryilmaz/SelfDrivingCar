export class Environment {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.walls = [];
        this.spawnPoint = { x: 0, y: 0 };
        this.spawnAngle = 0;
        this.checkpoints = [];
        this.roadWidth = 80;
        this.centerlineControlPoints = null;
        this.setDefaultMap();
    }

    setDefaultMap() {
        const w = 800;
        const h = 600;
        this.walls = [
            [
                { x: 100, y: 80 },
                { x: 350, y: 40 },
                { x: 550, y: 60 },
                { x: 720, y: 120 },
                { x: 750, y: 300 },
                { x: 700, y: 480 },
                { x: 500, y: 550 },
                { x: 280, y: 560 },
                { x: 80, y: 500 },
                { x: 50, y: 300 },
                { x: 70, y: 150 }
            ],
            [
                { x: 200, y: 180 },
                { x: 350, y: 150 },
                { x: 480, y: 170 },
                { x: 580, y: 220 },
                { x: 600, y: 320 },
                { x: 560, y: 420 },
                { x: 430, y: 460 },
                { x: 280, y: 450 },
                { x: 190, y: 390 },
                { x: 170, y: 280 }
            ]
        ];

        this.spawnPoint = { x: 150, y: 240 };
        this.spawnAngle = -Math.PI / 2;
        this.generateCheckpoints();
    }

    generateCheckpoints() {
        if (this.walls.length < 2) {
            this.checkpoints = [];
            return;
        }
        const outer = this.walls[0];
        const inner = this.walls[1];
        const n = Math.min(outer.length, inner.length);
        this.checkpoints = [];
        for (let i = 0; i < n; i++) {
            this.checkpoints.push({
                a: { x: outer[i].x, y: outer[i].y },
                b: { x: inner[i].x, y: inner[i].y }
            });
        }
    }

    setCustomWalls(wallPolygons) {
        this.walls = wallPolygons;
        if (wallPolygons.length >= 2 && wallPolygons[0].length > 0 && wallPolygons[1].length > 0) {
            const o = wallPolygons[0][0];
            const i = wallPolygons[1][0];
            this.spawnPoint = {
                x: (o.x + i.x) / 2,
                y: (o.y + i.y) / 2
            };
            // Calculate angle from first to second centerline point
            if (wallPolygons[0].length > 1 && wallPolygons[1].length > 1) {
                const o2 = wallPolygons[0][1];
                const i2 = wallPolygons[1][1];
                const cx2 = (o2.x + i2.x) / 2;
                const cy2 = (o2.y + i2.y) / 2;
                this.spawnAngle = Math.atan2(cy2 - this.spawnPoint.y, cx2 - this.spawnPoint.x);
            } else {
                this.spawnAngle = 0;
            }
            this.generateCheckpoints();
        } else if (wallPolygons.length > 0 && wallPolygons[0].length > 0) {
            const p = wallPolygons[0][0];
            const p2 = wallPolygons[0][1] || p;
            this.spawnPoint = {
                x: (p.x + p2.x) / 2 + 30,
                y: (p.y + p2.y) / 2 + 30
            };
            this.spawnAngle = 0;
            this.checkpoints = [];
        }
    }

    /**
     * Build outer/inner wall polygons from a centerline path.
     * @param {Array} centerline - Array of {x, y} points forming a closed path
     * @param {number} width - Road width (distance between inner and outer walls)
     * @returns {Array} [outerWall, innerWall]
     */
    buildTrackFromCenterline(centerline, width) {
        const hw = width / 2;
        const outer = [];
        const inner = [];
        const n = centerline.length;

        for (let i = 0; i < n; i++) {
            const prev = centerline[(i - 1 + n) % n];
            const curr = centerline[i];
            const next = centerline[(i + 1) % n];

            // Tangent direction (average of prev->curr and curr->next)
            const dx1 = curr.x - prev.x;
            const dy1 = curr.y - prev.y;
            const dx2 = next.x - curr.x;
            const dy2 = next.y - curr.y;
            const tx = dx1 + dx2;
            const ty = dy1 + dy2;
            const tLen = Math.hypot(tx, ty) || 1;

            // Normal (perpendicular to tangent)
            const nx = -ty / tLen;
            const ny = tx / tLen;

            outer.push({ x: curr.x + nx * hw, y: curr.y + ny * hw });
            inner.push({ x: curr.x - nx * hw, y: curr.y - ny * hw });
        }

        return [outer, inner];
    }

    /**
     * Catmull-Rom spline interpolation for smooth curves through control points.
     * @param {Array} points - Control points [{x,y}, ...]
     * @param {number} segments - Number of interpolated points per segment
     * @returns {Array} Smoothed path
     */
    catmullRomSpline(points, segments = 12) {
        const result = [];
        const n = points.length;

        for (let i = 0; i < n; i++) {
            const p0 = points[(i - 1 + n) % n];
            const p1 = points[i];
            const p2 = points[(i + 1) % n];
            const p3 = points[(i + 2) % n];

            for (let t = 0; t < segments; t++) {
                const s = t / segments;
                const s2 = s * s;
                const s3 = s2 * s;

                const x = 0.5 * (
                    (2 * p1.x) +
                    (-p0.x + p2.x) * s +
                    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 +
                    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3
                );
                const y = 0.5 * (
                    (2 * p1.y) +
                    (-p0.y + p2.y) * s +
                    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 +
                    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3
                );

                result.push({ x, y });
            }
        }

        return result;
    }

    /**
     * Generate a random closed track.
     * Uses random control points arranged in a circle-ish pattern,
     * then smooths them with Catmull-Rom spline, then builds walls.
     */
    generateRandomTrack() {
        const w = 2000;
        const h = 1500;
        const cx = w / 2;
        const cy = h / 2;

        const numPoints = 8 + Math.floor(Math.random() * 7); // 8-14 control points
        const baseRadius = Math.min(w, h) * 0.38;
        const controlPoints = [];

        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const radiusVariation = 0.4 + Math.random() * 0.8; // 0.4-1.2 of base
            const r = baseRadius * radiusVariation;
            // Add some angular jitter
            const jitter = (Math.random() - 0.5) * (Math.PI * 2 / numPoints) * 0.45;
            const a = angle + jitter;
            controlPoints.push({
                x: cx + Math.cos(a) * r,
                y: cy + Math.sin(a) * r
            });
        }
        
        this.centerlineControlPoints = controlPoints.map(p => ({...p}));

        // Smooth the path
        const centerline = this.catmullRomSpline(controlPoints, 10);

        // Build walls from centerline
        const roadWidth = 70 + Math.random() * 30; // 70-100
        const [outer, inner] = this.buildTrackFromCenterline(centerline, roadWidth);

        this.walls = [outer, inner];
        this.roadWidth = roadWidth;

        // Spawn point: between first outer and inner points
        this.spawnPoint = {
            x: (outer[0].x + inner[0].x) / 2,
            y: (outer[0].y + inner[0].y) / 2
        };
        // Spawn angle: direction toward the second segment center
        const cx2 = (outer[1].x + inner[1].x) / 2;
        const cy2 = (outer[1].y + inner[1].y) / 2;
        this.spawnAngle = Math.atan2(cy2 - this.spawnPoint.y, cx2 - this.spawnPoint.x);

        this.generateCheckpoints();
    }

    getWallSegments() {
        const segments = [];
        for (const poly of this.walls) {
            for (let i = 0; i < poly.length; i++) {
                const a = poly[i];
                const b = poly[(i + 1) % poly.length];
                segments.push({ a, b });
            }
        }
        return segments;
    }

    render(ctx, scale = 1) {
        ctx.save();
        ctx.scale(scale, scale);

        const isLight = document.body.getAttribute('data-theme') === 'light';

        for (let wi = 0; wi < this.walls.length; wi++) {
            const poly = this.walls[wi];
            if (poly.length < 2) continue;

            ctx.beginPath();
            ctx.moveTo(poly[0].x, poly[0].y);
            for (let i = 1; i < poly.length; i++) {
                ctx.lineTo(poly[i].x, poly[i].y);
            }
            ctx.closePath();

            if (wi === 0) {
                ctx.fillStyle = isLight ? 'rgba(200, 205, 215, 0.5)' : 'rgba(20, 20, 35, 0.6)';
                ctx.fill();
            }

            ctx.strokeStyle = isLight
                ? (wi === 0 ? '#8888a0' : '#aaaabc')
                : (wi === 0 ? '#4a4a6a' : '#3a3a5a');
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.strokeStyle = isLight
                ? (wi === 0 ? 'rgba(91, 76, 219, 0.5)' : 'rgba(91, 76, 219, 0.3)')
                : (wi === 0 ? 'rgba(108, 92, 231, 0.4)' : 'rgba(108, 92, 231, 0.2)');
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (this.walls.length >= 2) {
            const outer = this.walls[0];
            const inner = this.walls[1];
            ctx.beginPath();
            ctx.moveTo(outer[0].x, outer[0].y);
            for (let i = 1; i < outer.length; i++) ctx.lineTo(outer[i].x, outer[i].y);
            ctx.closePath();

            ctx.moveTo(inner[0].x, inner[0].y);
            for (let i = inner.length - 1; i >= 0; i--) ctx.lineTo(inner[i].x, inner[i].y);
            ctx.closePath();

            ctx.fillStyle = isLight ? 'rgba(180, 185, 200, 0.35)' : 'rgba(40, 40, 60, 0.4)';
            ctx.fill('evenodd');
        }

        ctx.restore();
    }
}
