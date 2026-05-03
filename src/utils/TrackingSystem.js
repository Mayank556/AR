export default class TrackingSystem {
    constructor(onGesture) {
        this.onGesture = onGesture;
        this.hands = new window.Hands({locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
        
        this.hands.setOptions({
            maxNumHands: 2, // Enable two hands for max/min & rotate
            modelComplexity: 1,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6
        });
        
        this.hands.onResults((r) => this.processResults(r));
        
        this.historyX = [];
        this.historyY = [];
        this.SMOOTH_FACTOR = 4; 
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
        const out = { gesture: null, x: null, y: null, rawResults: results, twoHand: null, pinch: null };
        
        // Two hands detected -> calculate Zoom & Rotate
        if (results.multiHandLandmarks && results.multiHandLandmarks.length === 2) {
            const h1 = results.multiHandLandmarks[0];
            const h2 = results.multiHandLandmarks[1];

            const idx1 = h1[8];
            const idx2 = h2[8];

            const w = window.innerWidth, h = window.innerHeight;
            const x1 = idx1.x * w, y1 = idx1.y * h;
            const x2 = idx2.x * w, y2 = idx2.y * h;

            const dist = Math.hypot(x2 - x1, y2 - y1);
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const centerX = (x1 + x2) / 2;
            const centerY = (y1 + y2) / 2;

            out.twoHand = { distance: dist, angle: angle, centerX, centerY };
            out.gesture = "two-hand";
            this.onGesture(out);
            return;
        }

        // Single hand detected
        if (results.multiHandLandmarks && results.multiHandLandmarks.length === 1) {
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

            const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
            const isPinching = pinchDist < 0.08;
            out.pinch = pinchDist;

            if (isPinching) {
                out.gesture = "draw";
            } else if (indexTip.y < lm[6].y && middleTip.y > lm[10].y && ringTip.y > lm[14].y && pinkyTip.y > lm[18].y) {
                out.gesture = "hover";
            } else {
                out.gesture = "stop";
                this.historyX = []; this.historyY = [];
            }
        } else {
            out.gesture = "none";
            this.historyX = []; this.historyY = [];
        }

        this.onGesture(out);
    }
}
