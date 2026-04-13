export class Environment {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.walls = [];
        this.spawnPoint = { x: 0, y: 0 };
        this.spawnAngle = 0;
        this.checkpoints = [];
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
        if (wallPolygons.length > 0 && wallPolygons[0].length > 0) {
            const p = wallPolygons[0][0];
            const p2 = wallPolygons[0][1] || p;
            this.spawnPoint = {
                x: (p.x + p2.x) / 2 + 30,
                y: (p.y + p2.y) / 2 + 30
            };
            this.spawnAngle = 0;
        }
        if (wallPolygons.length >= 2) {
            this.generateCheckpoints();
        } else {
            this.checkpoints = [];
        }
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
