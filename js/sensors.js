export class Sensors {
    constructor(car, maxRange = 200) {
        this.car = car;
        this.maxRange = maxRange;
        this.readings = [0, 0, 0, 0, 0, 0];
        this.rayEnds = [];
        this.hitPoints = [];

        this.angles = [
            0,
            Math.PI,
            -Math.PI / 2,
            Math.PI / 2,
            -Math.PI / 4,
            Math.PI / 4
        ];
    }

    update(wallSegments) {
        this.rayEnds = [];
        this.hitPoints = [];

        for (let i = 0; i < this.angles.length; i++) {
            const angle = this.car.angle + this.angles[i];
            const ox = this.car.x;
            const oy = this.car.y;
            const ex = ox + Math.cos(angle) * this.maxRange;
            const ey = oy + Math.sin(angle) * this.maxRange;

            let closest = null;
            let minDist = this.maxRange;

            for (const seg of wallSegments) {
                const hit = this.raySegmentIntersect(
                    ox, oy, ex, ey,
                    seg.a.x, seg.a.y, seg.b.x, seg.b.y
                );
                if (hit) {
                    const d = Math.hypot(hit.x - ox, hit.y - oy);
                    if (d < minDist) {
                        minDist = d;
                        closest = hit;
                    }
                }
            }

            this.readings[i] = minDist / this.maxRange;
            this.rayEnds.push({ x: ex, y: ey });
            this.hitPoints.push(closest || { x: ex, y: ey });
        }
    }

    raySegmentIntersect(rx, ry, rex, rey, sx, sy, sex, sey) {
        const dx = rex - rx;
        const dy = rey - ry;
        const dsx = sex - sx;
        const dsy = sey - sy;
        const denom = dx * dsy - dy * dsx;
        if (Math.abs(denom) < 1e-10) return null;

        const t = ((sx - rx) * dsy - (sy - ry) * dsx) / denom;
        const u = ((sx - rx) * dy - (sy - ry) * dx) / denom;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: rx + t * dx,
                y: ry + t * dy
            };
        }
        return null;
    }

    getNormalized() {
        return this.readings.slice();
    }

    render(ctx, scale = 1) {
        ctx.save();
        ctx.scale(scale, scale);

        for (let i = 0; i < this.angles.length; i++) {
            const hit = this.hitPoints[i];
            if (!hit) continue;

            const dist = this.readings[i];
            const r = Math.floor(255 * (1 - dist));
            const g = Math.floor(255 * dist);

            ctx.beginPath();
            ctx.moveTo(this.car.x, this.car.y);
            ctx.lineTo(hit.x, hit.y);
            ctx.strokeStyle = `rgba(${r}, ${g}, 80, 0.5)`;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(hit.x, hit.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r}, ${g}, 80, 0.9)`;
            ctx.fill();
        }

        ctx.restore();
    }
}
