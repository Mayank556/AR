export default class TrackingSystem {
    /**
     * How hand tracking works:
     * We initialize MediaPipe Hands, a machine learning model that runs in the browser via WebAssembly.
     * It takes video frames and outputs an array of 21 3D landmarks for each detected hand.
     * Each landmark represents a specific joint (e.g., landmark 8 is the index finger tip).
     * The model outputs normalized coordinates (0.0 to 1.0) which we multiply by screen dimensions.
     */
    constructor(onGesture) {
        this.onGesture = onGesture;
        this.hands = new window.Hands({locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
        
        // Performance Optimization: Limit to 1 hand, lower complexity for speed
        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1, // Balance between speed and accuracy
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.6 // Slightly lower to keep tracking fast during motion
        });
        
        this.hands.onResults((r) => this.processResults(r));
        
        // Smoothing properties (Moving Average implementation)
        this.historyX = [];
        this.historyY = [];
        this.SMOOTH_FACTOR = 4; // Average over 4 frames to reduce jitter
        this.clearHoldCounter = 0;
    }

    /**
     * Hand Tracking Phase 2: Stabilization
     * Raw coordinates from AI models often "jitter" or shake natively. 
     * We use a Simple Moving Average (SMA) buffer. We store the last N frames of coordinates,
     * and return the average. This acts as a low-pass filter, smoothing the user's stroke.
     */
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

    /**
     * How coordinates are mapped:
     * MediaPipe returns x and y as ratios from 0.0 to 1.0 (e.g., 0.5 is screen center).
     * We multiply by window.innerWidth and window.innerHeight to map them to the full-screen canvas.
     * If the mirror mode is on (front camera), we invert the X axis by subtracting it from 1.0.
     */
    processResults(results) {
        const out = { gesture: null, x: null, y: null, rawResults: results };
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const lm = results.multiHandLandmarks[0];
            
            // Get tips and PIP joints (second joint from tip) to determine if a finger is extended
            const indexTip = lm[8], indexPip = lm[6];
            const middleTip = lm[12], middlePip = lm[10];
            const ringTip = lm[16], ringPip = lm[14];
            const pinkyTip = lm[20], pinkyPip = lm[18];

            /**
             * How gestures are detected:
             * We compare the Y coordinate of the fingertip to its lower joint (PIP).
             * If the tip is higher (Y is smaller in browser coordinates) than the PIP, the finger is "up".
             */
            const indexUp = indexTip.y < indexPip.y;
            const middleUp = middleTip.y < middlePip.y;
            const ringUp = ringTip.y < ringPip.y;
            const pinkyUp = pinkyTip.y < pinkyPip.y;

            const w = window.innerWidth, h = window.innerHeight;
            let rawX = indexTip.x * w;
            const rawY = indexTip.y * h;

            // Coordinate Mapping: Handle Mirroring
            if (document.getElementById("workspace").classList.contains("mirrored")) {
                rawX = (1 - indexTip.x) * w;
            }

            const { x, y } = this.getSmoothedCoords(rawX, rawY);
            out.x = x; out.y = y;

            // Gesture Classification Logic
            if (indexUp && !middleUp && !ringUp && !pinkyUp) {
                // One finger (index up) -> Start drawing
                out.gesture = "draw";
                this.clearHoldCounter = 0;
            } else if (indexUp && middleUp && !ringUp && !pinkyUp) {
                // Two fingers (index & middle) -> Eraser mode
                out.gesture = "erase";
                this.clearHoldCounter = 0;
            } else if (indexUp && middleUp && ringUp && pinkyUp) {
                // Open palm (all fingers up) -> Clear canvas (requires holding for safety)
                out.gesture = "clear_ready";
                this.clearHoldCounter++;
                if (this.clearHoldCounter > 20) { // ~0.5 second hold
                    out.gesture = "clear";
                    this.clearHoldCounter = 0;
                }
            } else if (!indexUp && !middleUp && !ringUp && !pinkyUp) {
                // No hand or closed fist -> Stop drawing
                out.gesture = "stop";
                this.historyX = []; this.historyY = []; // Break smoothing chain to avoid connecting disjointed strokes
            } else {
                out.gesture = "hover";
            }
        } else {
            out.gesture = "none";
            this.historyX = []; this.historyY = [];
            this.clearHoldCounter = 0;
        }

        this.onGesture(out);
    }
}
