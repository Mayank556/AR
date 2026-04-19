export default class DrawingSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.strokes = [];
        this.currentStroke = null;
        this.color = "#8b5a2b"; // Brown bead color
        this.size = 12;
        
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
        this.currentStroke = { 
            points: [{x, y}], 
            color: isErase ? "erase" : this.color, 
            baseSize: this.size 
        };
        this.strokes.push(this.currentStroke);
    }

    continueStroke(x, y) {
        if (!this.currentStroke) return;
        
        // Only add point if it's far enough away from the last point to create the "bead" effect
        const lastPoint = this.currentStroke.points[this.currentStroke.points.length - 1];
        const dist = Math.hypot(x - lastPoint.x, y - lastPoint.y);
        
        // Bead spacing distance
        if (dist > this.size * 0.8) {
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

    renderAll() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let stroke of this.strokes) {
            if (stroke.points.length === 0) continue;
            
            if (stroke.color === "erase") continue; // simplistic for now
            
            for (let point of stroke.points) {
                // Draw a 3D-looking bead/sphere
                const radius = stroke.baseSize;
                
                const gradient = this.ctx.createRadialGradient(
                    point.x - radius/3, point.y - radius/3, radius/10,
                    point.x, point.y, radius
                );
                
                // Brown/Gold bead colors
                gradient.addColorStop(0, "#d2b48c"); // Highlight
                gradient.addColorStop(0.5, stroke.color); // Mid
                gradient.addColorStop(1, "#3e2723"); // Shadow
                
                this.ctx.beginPath();
                this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
                this.ctx.fillStyle = gradient;
                this.ctx.shadowBlur = 20;
                this.ctx.shadowColor = stroke.color;
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
                
                // Outline to make it pop like the screenshot
                this.ctx.strokeStyle = "rgba(0,0,0,0.5)";
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            }
        }
    }
}
