export default class DrawingSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.strokes = [];
        this.currentStroke = null;
        this.color = "#8b5a2b"; // Brown bead color
        this.size = 12;
        this.brushType = "bead";
        this.tool = "pen";
        
        window.addEventListener("resize", () => this.resize());
        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.renderAll();
    }

    startParams(color, size, type = 'bead', tool = 'pen') { 
        this.color = color; 
        this.size = size; 
        this.brushType = type;
        this.tool = tool;
    }

    startStroke(x, y, isErase = false) {
        this.currentStroke = { 
            points: [{x, y}], 
            color: isErase ? "erase" : this.color, 
            baseSize: this.size,
            type: this.brushType || 'bead',
            tool: this.tool || 'pen'
        };
        this.strokes.push(this.currentStroke);
    }

    continueStroke(x, y) {
        if (!this.currentStroke) return;

        if (this.currentStroke.tool !== 'pen') {
            if (this.currentStroke.points.length < 2) {
                this.currentStroke.points.push({ x, y });
            } else {
                this.currentStroke.points[1] = { x, y };
            }
            return;
        }
        
        const lastPoint = this.currentStroke.points[this.currentStroke.points.length - 1];
        const dist = Math.hypot(x - lastPoint.x, y - lastPoint.y);
        
        let spacing = this.size * 0.8;
        if (this.currentStroke.type === 'line' || this.currentStroke.type === 'neon') spacing = this.size * 0.2;
        
        if (dist > spacing) {
            this.currentStroke.points.push({x, y});
        }
    }

    endStroke() {
        this.currentStroke = null;
    }

    undo() {
        this.strokes.pop();
        this.renderAll();
    }

    clear() {
        this.strokes = [];
        this.renderAll();
    }

    drawFreeformStroke(stroke) {
        if (stroke.points.length === 0) return;

        if (stroke.type === 'pencil') {
            this.ctx.beginPath();
            this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.lineWidth = Math.max(1.5, stroke.baseSize * 0.35);
            this.ctx.strokeStyle = stroke.color;
            this.ctx.globalAlpha = 0.88;
            this.ctx.stroke();
            this.ctx.globalAlpha = 1;
            return;
        }

        if (stroke.type === 'line' || stroke.type === 'neon') {
            this.ctx.beginPath();
            this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            this.ctx.lineCap = "round";
            this.ctx.lineJoin = "round";
            this.ctx.lineWidth = stroke.baseSize;
            this.ctx.strokeStyle = stroke.color;

            if (stroke.type === 'neon') {
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = stroke.color;
                this.ctx.lineWidth = stroke.baseSize * 0.5;
                this.ctx.strokeStyle = "#fff";
            }
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            return;
        }

        for (let point of stroke.points) {
            const radius = stroke.baseSize;

            if (stroke.type === 'square') {
                this.ctx.fillStyle = stroke.color;
                this.ctx.shadowBlur = 5;
                this.ctx.shadowColor = stroke.color;
                this.ctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
                this.ctx.shadowBlur = 0;
                continue;
            }

            const gradient = this.ctx.createRadialGradient(
                point.x - radius/3, point.y - radius/3, radius/10,
                point.x, point.y, radius
            );

            gradient.addColorStop(0, "#d2b48c");
            gradient.addColorStop(0.5, stroke.color);
            gradient.addColorStop(1, "#3e2723");

            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = stroke.color;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            this.ctx.strokeStyle = "rgba(0,0,0,0.5)";
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }
    }

    drawShapeStroke(stroke) {
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1] || start;
        const left = Math.min(start.x, end.x);
        const top = Math.min(start.y, end.y);
        const width = Math.max(10, Math.abs(end.x - start.x));
        const height = Math.max(10, Math.abs(end.y - start.y));
        const centerX = left + width / 2;
        const centerY = top + height / 2;
        const radius = Math.max(width, height) / 2;

        this.ctx.save();
        this.ctx.strokeStyle = stroke.color;
        this.ctx.fillStyle = stroke.color;
        this.ctx.lineWidth = Math.max(2, stroke.baseSize / 4);
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';

        switch (stroke.tool) {
            case 'line':
                this.ctx.beginPath();
                this.ctx.moveTo(start.x, start.y);
                this.ctx.lineTo(end.x, end.y);
                this.ctx.stroke();
                break;
            case 'circle':
                this.ctx.beginPath();
                this.ctx.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, Math.PI * 2);
                this.ctx.stroke();
                break;
            case 'rectangle':
            case 'square':
                this.ctx.strokeRect(left, top, width, height);
                break;
            case 'triangle':
                this.ctx.beginPath();
                this.ctx.moveTo(centerX, top);
                this.ctx.lineTo(left, top + height);
                this.ctx.lineTo(left + width, top + height);
                this.ctx.closePath();
                this.ctx.stroke();
                break;
            case 'diamond':
                this.ctx.beginPath();
                this.ctx.moveTo(centerX, top);
                this.ctx.lineTo(left, centerY);
                this.ctx.lineTo(centerX, top + height);
                this.ctx.lineTo(left + width, centerY);
                this.ctx.closePath();
                this.ctx.stroke();
                break;
            case 'hexagon':
                this.ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6;
                    const px = centerX + Math.cos(angle) * radius;
                    const py = centerY + Math.sin(angle) * radius;
                    if (i === 0) this.ctx.moveTo(px, py);
                    else this.ctx.lineTo(px, py);
                }
                this.ctx.closePath();
                this.ctx.stroke();
                break;
            case 'star':
                this.ctx.beginPath();
                for (let i = 0; i < 10; i++) {
                    const angle = (Math.PI / 5) * i - Math.PI / 2;
                    const r = i % 2 === 0 ? radius : radius / 2;
                    const px = centerX + Math.cos(angle) * r;
                    const py = centerY + Math.sin(angle) * r;
                    if (i === 0) this.ctx.moveTo(px, py);
                    else this.ctx.lineTo(px, py);
                }
                this.ctx.closePath();
                this.ctx.stroke();
                break;
            case 'heart': {
                const heartRadius = radius / 1.4;
                this.ctx.beginPath();
                this.ctx.moveTo(centerX, centerY + heartRadius / 2);
                this.ctx.bezierCurveTo(centerX - heartRadius, centerY - heartRadius, centerX - heartRadius * 1.8, centerY + heartRadius / 3, centerX, centerY + heartRadius * 1.8);
                this.ctx.bezierCurveTo(centerX + heartRadius * 1.8, centerY + heartRadius / 3, centerX + heartRadius, centerY - heartRadius, centerX, centerY + heartRadius / 2);
                this.ctx.closePath();
                this.ctx.stroke();
                break;
            }
            default:
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                this.ctx.stroke();
                break;
        }

        this.ctx.restore();
    }

    renderAll() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let stroke of this.strokes) {
            if (stroke.points.length === 0) continue;
            
            if (stroke.color === "erase") continue; // simplistic for now

            if (stroke.tool && stroke.tool !== 'pen') {
                this.drawShapeStroke(stroke);
                continue;
            }

            this.drawFreeformStroke(stroke);
        }
    }
}
