export default class TrackingSystem {
    constructor(onGesture) {
        this.onGesture = onGesture;
        this.hands = new window.Hands({locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
        
        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6
        });
        
        this.hands.onResults((r) => this.processResults(r));
        
        this.historyX = [];
        this.historyY = [];
        this.SMOOTH_FACTOR = 4; 
        this.clearHoldCounter = 0;
    }

    getSmoothedCoords(x, y) {
        this.historyX.push(x);
        this.historyY.push(y);
        
        if (this.historyX.length > this.SMOOTH_FACTOR) {
            this.historyX.shift();
            this.historyY.shift();
        }
        
        const avgX = this.historyX.reduce((a, b) => a + b) / this.historyX.length;
        const avgY = this.historyY.reduce((a, b) => a + b) / this.historyY.length;
        return { x: avgX, y: avgY };
    }

    processResults(results) {
        const out = { gesture: null, x: null, y: null, rawResults: results };
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const lm = results.multiHandLandmarks[0];
            
            const thumbTip = lm[4];
            const indexTip = lm[8];
            const middleTip = lm[12];
            const ringTip = lm[16];
            const pinkyTip = lm[20];

            const w = window.innerWidth, h = window.innerHeight;
            let rawX = indexTip.x * w;
            const rawY = indexTip.y * h;

            const workspace = document.getElementById("workspace");
            if (workspace && workspace.classList.contains("mirrored")) {
                rawX = (1 - indexTip.x) * w;
            }

            const { x, y } = this.getSmoothedCoords(rawX, rawY);
            out.x = x; out.y = y;

            // Calculate pinch distance between thumb and index
            const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
            
            // If they are pinching (distance is very small, say < 0.05)
            const isPinching = pinchDist < 0.08;

            if (isPinching) {
                // Pinch -> Draw
                out.gesture = "draw";
                this.clearHoldCounter = 0;
            } else if (indexTip.y < lm[6].y && middleTip.y > lm[10].y && ringTip.y > lm[14].y && pinkyTip.y > lm[18].y) {
                // Only index up, no pinch -> Hover
                out.gesture = "hover";
            } else {
                out.gesture = "stop";
                this.historyX = []; this.historyY = [];
            }
        } else {
            out.gesture = "none";
            this.historyX = []; this.historyY = [];
            this.clearHoldCounter = 0;
        }

        this.onGesture(out);
    }
}
