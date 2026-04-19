import * as THREE from "three";

export default class ARVRSystem {
    constructor(threeCanvas, bgCanvas) {
        // --- THREE JS SETUP ---
        this.threeCanvas = threeCanvas;
        this.scene = new THREE.Scene();
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 500;
        
        this.renderer = new THREE.WebGLRenderer({ canvas: this.threeCanvas, alpha: true, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 0, 1);
        this.scene.add(light);
        this.scene.add(new THREE.AmbientLight(0x404040));

        this.objects3D = [];
        this.is3DMode = false;
        
        window.addEventListener("resize", () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // --- BACKGROUND SEGMENTATION SETUP ---
        this.bgCanvas = bgCanvas;
        this.bgCtx = this.bgCanvas.getContext("2d");
        this.isVRBgMode = false;

        if (typeof window.SelfieSegmentation !== 'undefined') {
            this.segmentation = new window.SelfieSegmentation({locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
            }});
            this.segmentation.setOptions({ modelSelection: 1 });
            this.segmentation.onResults(this.onSegmentationResults.bind(this));
        }

        this.animationId = null;
        this.animate();
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Auto-rotate 3D objects
        this.objects3D.forEach(obj => {
            obj.rotation.y += 0.01;
            obj.rotation.x += 0.005;
        });
        
        this.renderer.render(this.scene, this.camera);
    }
    
    stop() {
        if(this.animationId) cancelAnimationFrame(this.animationId);
    }

    // --- FEATURE: CONVERT 2D TO 3D ---
    convertStrokesTo3D(strokes) {
        if (!strokes || strokes.length === 0) return;
        this.is3DMode = true;
        
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        strokes.forEach(stroke => {
            if (stroke.points.length < 2) return;
            if (stroke.color === "erase") return; // skip erasures

            const path = new THREE.CurvePath();
            stroke.points.forEach((p, idx) => {
                // Map 2D window coords to 3D space relatively
                const x = p.x - w / 2;
                const y = -(p.y - h / 2);
                const z = (Math.random() - 0.5) * 50; // Add some depth jitter
                
                const v3 = new THREE.Vector3(x, y, z);
                
                if (idx === 0) {
                    // Start of curve
                } else if (idx === 1) {
                    path.add(new THREE.LineCurve3(new THREE.Vector3(stroke.points[0].x - w/2, -(stroke.points[0].y - h/2), z), v3));
                } else {
                    const prevP = stroke.points[idx-1];
                    const prevV3 = new THREE.Vector3(prevP.x - w/2, -(prevP.y - h/2), z);
                    path.add(new THREE.LineCurve3(prevV3, v3));
                }
            });

            const geometry = new THREE.TubeGeometry(path, stroke.points.length, stroke.baseSize * 2, 8, false);
            const material = new THREE.MeshPhongMaterial({ 
                color: new THREE.Color(stroke.color),
                emissive: new THREE.Color(stroke.color).multiplyScalar(0.5),
                shininess: 100
            });
            const mesh = new THREE.Mesh(geometry, material);
            
            this.scene.add(mesh);
            this.objects3D.push(mesh);
        });

        // Add fun particles
        this.addParticles();
    }

    addParticles() {
        const pGeo = new THREE.BufferGeometry();
        const pMat = new THREE.PointsMaterial({color: 0xffffff, size: 3});
        const pCount = 500;
        const posArray = new Float32Array(pCount * 3);
        for(let i=0;i<pCount*3;i++) {
            posArray[i] = (Math.random() - 0.5) * window.innerWidth;
        }
        pGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particles = new THREE.Points(pGeo, pMat);
        this.scene.add(particles);
        this.objects3D.push(particles);
    }

    clear3D() {
        this.objects3D.forEach(obj => this.scene.remove(obj));
        this.objects3D = [];
        this.is3DMode = false;
    }

    // --- FEATURE: 360 BACKGROUND REMOVAL ---
    toggleVRBackground() {
        this.isVRBgMode = !this.isVRBgMode;
        if (!this.isVRBgMode) {
            this.bgCtx.clearRect(0,0, this.bgCanvas.width, this.bgCanvas.height);
        }
        return this.isVRBgMode;
    }

    async processVideoForSegmentation(videoElement) {
        if (this.isVRBgMode && this.segmentation) {
            await this.segmentation.send({image: videoElement});
        }
    }

    onSegmentationResults(results) {
        if (!this.isVRBgMode) return;
        
        this.bgCanvas.width = window.innerWidth;
        this.bgCanvas.height = window.innerHeight;
        
        this.bgCtx.save();
        this.bgCtx.clearRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
        
        // Draw the Segmented Mask
        this.bgCtx.drawImage(results.segmentationMask, 0, 0, this.bgCanvas.width, this.bgCanvas.height);
        this.bgCtx.globalCompositeOperation = 'source-in';
        this.bgCtx.drawImage(results.image, 0, 0, this.bgCanvas.width, this.bgCanvas.height);
        
        // Draw the cool 360 Space background in the back
        this.bgCtx.globalCompositeOperation = 'destination-over';
        
        // Fun space gradient
        const grd = this.bgCtx.createLinearGradient(0, 0, 0, this.bgCanvas.height);
        grd.addColorStop(0, "#000022");
        grd.addColorStop(1, "#220044");
        this.bgCtx.fillStyle = grd;
        this.bgCtx.fillRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);

        // draw stars
        this.bgCtx.fillStyle = 'white';
        for(let i=0; i<100; i++) {
            this.bgCtx.fillRect(Math.random()*this.bgCanvas.width, Math.random()*this.bgCanvas.height, 2, 2);
        }
        
        this.bgCtx.restore();
    }

    // --- FEATURE: PAPER SCANNER (SIMULATED) ---
    scanPaperCurrentVideo(videoCtx, drawingSystem) {
        const w = window.innerWidth; const h = window.innerHeight;
        const imgData = videoCtx.getImageData(0, 0, w, h);
        const data = imgData.data;
        
        drawingSystem.startParams("#32d74b", 5);
        drawingSystem.startStroke(w/2, h/2);

        let pointsFound = 0;
        // Sub-sample to keep it fast
        for (let y = 0; y < h; y += 10) {
            for (let x = 0; x < w; x += 10) {
                const i = (y * w + x) * 4;
                const r = data[i], g = data[i+1], b = data[i+2];
                const brightness = (r+g+b)/3;
                
                // If it's a very dark line (marker/pencil on paper)
                if (brightness < 50 && r < 60 && g < 60 && b < 60) {
                    drawingSystem.continueStroke(x, y);
                    pointsFound++;
                }
            }
        }
        drawingSystem.endStroke();
        drawingSystem.renderAll();
        return pointsFound > 0;
    }
}
