export default class DrawingSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.strokes = []; // Full history for undo/redo
        this.redoStack = [];
        this.currentStroke = null;
        this.color = "#007aff";
        this.size = 8;
        this.lastTime = 0;
        
        window.addEventListener("resize", () => this.resize());
        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.renderAll();
    }

    startParams(color, size) { 
        this.color = color; 
        this.size = size; 
    }

    startStroke(x, y, isErase = false) {
        this.lastTime = performance.now();
        this.currentStroke = { 
            points: [{x, y}], 
            color: isErase ? "erase" : this.color, 
            baseSize: this.size 
        };
        this.strokes.push(this.currentStroke);
        this.redoStack = []; // Clear redo
    }

    continueStroke(x, y) {
        if (!this.currentStroke) return;
        this.currentStroke.points.push({x, y});
    }

    endStroke() {
        this.currentStroke = null;
    }

    undo() {
        if (this.strokes.length > 0) {
            this.redoStack.push(this.strokes.pop());
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            this.strokes.push(this.redoStack.pop());
        }
    }

    clear() {
        this.strokes = [];
        this.redoStack = [];
    }

    renderAll() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        
        for (let stroke of this.strokes) {
            if (stroke.points.length === 0) continue;
            
            // FEATURE 5: AR-Like Experience - Glow effect for brush
            if (stroke.color === "erase") {
                this.ctx.globalCompositeOperation = "destination-out";
                this.ctx.strokeStyle = "rgba(0,0,0,1)";
                this.ctx.shadowBlur = 0;
            } else {
                this.ctx.globalCompositeOperation = "source-over";
                this.ctx.strokeStyle = stroke.color;
                this.ctx.shadowBlur = stroke.baseSize * 1.5; // Simulate AR neon glow
                this.ctx.shadowColor = stroke.color;
            }
            
            // FEATURE 8: Dynamic brush thickness based on finger speed
            // To achieve dynamic thickness, we draw segment by segment calculating velocity
            if (stroke.points.length < 2) {
                this.ctx.lineWidth = stroke.baseSize;
                this.ctx.beginPath();
                this.ctx.lineTo(stroke.points[0].x, stroke.points[0].y);
                this.ctx.stroke();
                continue;
            }

            for (let i = 1; i < stroke.points.length; i++) {
                const p0 = stroke.points[i - 1];
                const p1 = stroke.points[i];
                
                // Calculate speed-based thickness
                const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
                const speed = dist; // proxy for speed per tick
                let dynamicSize = stroke.baseSize / (1 + speed * 0.05);
                dynamicSize = Math.max(stroke.baseSize * 0.3, Math.min(dynamicSize, stroke.baseSize * 1.5));
                
                this.ctx.lineWidth = dynamicSize;
                this.ctx.beginPath();
                this.ctx.moveTo(p0.x, p0.y);
                this.ctx.lineTo(p1.x, p1.y);
                this.ctx.stroke();
            }
        }
    }
}
