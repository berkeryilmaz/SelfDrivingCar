import { Sensors } from './sensors.js';

export class Car {
    constructor(x, y, angle) {
        this.spawnX = x;
        this.spawnY = y;
        this.spawnAngle = angle;

        this.x = x;
        this.y = y;
        this.angle = angle;
        this.steeringAngle = 0;
        this.rpm = 0;
        this.speed = 0;
        this.maxSpeed = 3;
        this.maxSteer = Math.PI / 6;
        this.width = 12;
        this.height = 24;
        this.alive = true;
        this.distanceTraveled = 0;
        this.lastCheckpoint = -1;
        this.checkpointsPassed = 0;

        this.sensors = new Sensors(this, 200);
        this.trail = [];
        this.maxTrail = 200;
    }

    reset(x, y, angle) {
        this.x = x || this.spawnX;
        this.y = y || this.spawnY;
        this.angle = angle !== undefined ? angle : this.spawnAngle;
        this.steeringAngle = 0;
        this.rpm = 0;
        this.speed = 0;
        this.alive = true;
        this.distanceTraveled = 0;
        this.lastCheckpoint = -1;
        this.checkpointsPassed = 0;
        this.trail = [];
    }

    applyAction(steerDelta, throttle) {
        this.steeringAngle = Math.max(-this.maxSteer, Math.min(this.maxSteer, steerDelta * this.maxSteer));
        this.rpm = Math.max(0, Math.min(1, throttle));
        this.speed = this.rpm * this.maxSpeed;
    }

    update(wallSegments, checkpoints) {
        if (!this.alive) return;

        const prevX = this.x;
        const prevY = this.y;

        this.angle += this.steeringAngle * (this.speed / this.maxSpeed) * 0.08;
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        const dx = this.x - prevX;
        const dy = this.y - prevY;
        this.distanceTraveled += Math.hypot(dx, dy);

        if (this.checkCollision(wallSegments)) {
            this.alive = false;
            this.x = prevX;
            this.y = prevY;
            this.speed = 0;
        }

        this.checkCheckpoints(checkpoints);
        this.sensors.update(wallSegments);

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrail) {
            this.trail.shift();
        }
    }

    checkCollision(wallSegments) {
        const corners = this.getCorners();
        for (const seg of wallSegments) {
            for (let i = 0; i < corners.length; i++) {
                const a = corners[i];
                const b = corners[(i + 1) % corners.length];
                if (this.segmentsIntersect(a, b, seg.a, seg.b)) {
                    return true;
                }
            }
            if (this.pointInPolygon(seg.a, corners) || this.pointInPolygon(seg.b, corners)) {
                return true;
            }
        }
        return false;
    }

    checkCheckpoints(checkpoints) {
        if (!checkpoints || checkpoints.length === 0) return;
        const corners = this.getCorners();
        for (let i = 0; i < checkpoints.length; i++) {
            const cp = checkpoints[i];
            for (let j = 0; j < corners.length; j++) {
                const a = corners[j];
                const b = corners[(j + 1) % corners.length];
                if (this.segmentsIntersect(a, b, cp.a, cp.b)) {
                    const expected = (this.lastCheckpoint + 1) % checkpoints.length;
                    if (i === expected) {
                        this.lastCheckpoint = i;
                        this.checkpointsPassed++;
                    }
                    break;
                }
            }
        }
    }

    getCorners() {
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        const hw = this.width / 2;
        const hh = this.height / 2;
        return [
            { x: this.x + cos * hh - sin * hw, y: this.y + sin * hh + cos * hw },
            { x: this.x + cos * hh + sin * hw, y: this.y + sin * hh - cos * hw },
            { x: this.x - cos * hh + sin * hw, y: this.y - sin * hh - cos * hw },
            { x: this.x - cos * hh - sin * hw, y: this.y - sin * hh + cos * hw }
        ];
    }

    segmentsIntersect(a, b, c, d) {
        const denom = (d.y - c.y) * (b.x - a.x) - (d.x - c.x) * (b.y - a.y);
        if (Math.abs(denom) < 1e-10) return false;
        const ua = ((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x)) / denom;
        const ub = ((b.x - a.x) * (a.y - c.y) - (b.y - a.y) * (a.x - c.x)) / denom;
        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }

    pointInPolygon(p, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    getState() {
        const sensorData = this.sensors.getNormalized();
        return [
            ...sensorData,
            (this.steeringAngle / this.maxSteer + 1) / 2,
            this.rpm
        ];
    }

    render(ctx, scale = 1) {
        ctx.save();
        ctx.scale(scale, scale);

        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.strokeStyle = 'rgba(108, 92, 231, 0.15)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        this.sensors.render(ctx, 1);

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        const hw = this.width / 2;
        const hh = this.height / 2;

        ctx.beginPath();
        ctx.moveTo(hh + 4, 0);
        ctx.lineTo(hh - 2, -hw);
        ctx.lineTo(-hh, -hw);
        ctx.lineTo(-hh, hw);
        ctx.lineTo(hh - 2, hw);
        ctx.closePath();

        const grad = ctx.createLinearGradient(-hh, 0, hh, 0);
        if (this.alive) {
            grad.addColorStop(0, '#4834d4');
            grad.addColorStop(1, '#6c5ce7');
        } else {
            grad.addColorStop(0, '#c0392b');
            grad.addColorStop(1, '#e74c3c');
        }
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = this.alive ? '#a29bfe' : '#ff6b6b';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = this.alive ? 'rgba(255,255,255,0.3)' : 'rgba(255,100,100,0.3)';
        ctx.fillRect(hh - 6, -hw + 1, 5, hw * 2 - 2);

        ctx.beginPath();
        ctx.arc(hh + 4, 0, 2, 0, Math.PI * 2);
        ctx.fillStyle = this.alive ? '#55efc4' : '#ff6b6b';
        ctx.fill();

        ctx.restore();

        if (!this.alive) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, 18, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 107, 107, 0.6)';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();
    }
}
