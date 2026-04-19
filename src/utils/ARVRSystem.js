import * as THREE from "three";

export default class ARVRSystem {
    constructor(threeCanvas, bgCanvas) {
        this.threeCanvas = threeCanvas;
        this.scene = new THREE.Scene();
        
        // Closer perspective
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ canvas: this.threeCanvas, alpha: true, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        const light = new THREE.DirectionalLight(0xffddaa, 1.2);
        light.position.set(100, 200, 50);
        this.scene.add(light);
        this.scene.add(new THREE.AmbientLight(0x888888));

        this.objects3D = [];
        this.is3DMode = false;
        
        window.addEventListener("resize", () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        this.animationId = null;
        this.animate();
        this.group = new THREE.Group();
        this.scene.add(this.group);
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        if (this.is3DMode && this.group) {
            // Slow, majestic rotation to view the castle/shape
            this.group.rotation.x = Math.PI / 6; // Tilted down to look from above
            this.group.rotation.y += 0.01;
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    stop() {
        if(this.animationId) cancelAnimationFrame(this.animationId);
    }

    convertStrokesTo3D(strokes) {
        if (!strokes || strokes.length === 0) return;
        this.is3DMode = true;
        
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        // Center the camera on the object
        this.camera.position.set(0, 200, 400);
        this.camera.lookAt(0, 0, 0);

        // Brown gold castle material
        const material = new THREE.MeshPhongMaterial({ 
            color: 0x8b5a2b, // Brown/Bronze core
            emissive: 0x221100,
            shininess: 30,
            flatShading: false
        });
        
        strokes.forEach(stroke => {
            if (stroke.points.length === 0) return;
            if (stroke.color === "erase") return;

            stroke.points.forEach((p) => {
                // Map 2D window coords to 3D space
                const x = p.x - w / 2;
                const z = p.y - h / 2; // Y in 2D becomes Z in 3D floor
                const radius = stroke.baseSize * 1.5;
                const height = stroke.baseSize * 6; // Extrude up!
                
                // Create a cylinder for each point
                // It looks like a coin/bead stack forming a wall/tower
                const geo = new THREE.CylinderGeometry(radius, radius, height, 16);
                const mesh = new THREE.Mesh(geo, material);
                
                // Position it so the bottom touches the "paper" (y=0)
                mesh.position.set(x, height / 2, z);
                
                // Optional: add little horizontal ridges (like in the screenshot)
                const ridges = new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, height * 0.1, 16);
                const ridgeMesh = new THREE.Mesh(ridges, material);
                ridgeMesh.position.set(x, height * 0.9, z);
                
                this.group.add(mesh);
                this.group.add(ridgeMesh);
                this.objects3D.push(mesh);
                this.objects3D.push(ridgeMesh);
            });
        });
    }

    clear3D() {
        this.objects3D.forEach(obj => {
            if (obj.geometry) obj.geometry.dispose();
            this.group.remove(obj);
        });
        this.objects3D = [];
        this.group.rotation.set(0,0,0);
        this.is3DMode = false;
    }
}
