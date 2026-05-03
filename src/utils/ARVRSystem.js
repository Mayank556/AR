import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

export default class ARVRSystem {
    constructor(threeCanvas) {
        this.threeCanvas = threeCanvas;
        this.scene = new THREE.Scene();
        
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 50, 150);
        
        this.renderer = new THREE.WebGLRenderer({ canvas: this.threeCanvas, alpha: true, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Immersive AR Grid Floor
        const grid = new THREE.GridHelper(500, 100, 0x888888, 0x444444);
        grid.position.y = -10;
        grid.material.opacity = 0.5;
        grid.material.transparent = true;
        this.scene.add(grid);
        
        const light = new THREE.DirectionalLight(0xffffff, 1.2);
        light.position.set(100, 200, 50);
        light.castShadow = true;
        light.shadow.mapSize.width = 2048;
        light.shadow.mapSize.height = 2048;
        light.shadow.camera.near = 0.5;
        light.shadow.camera.far = 500;
        const d = 150;
        light.shadow.camera.left = -d;
        light.shadow.camera.right = d;
        light.shadow.camera.top = d;
        light.shadow.camera.bottom = -d;
        this.scene.add(light);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

        this.objects3D = [];
        this.is3DMode = false;
        
        window.addEventListener("resize", () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Add OrbitControls for 360 view
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        
        // TransformControls for moving shapes individually
        this.transformControl = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControl.addEventListener('dragging-changed', (event) => {
            this.controls.enabled = !event.value;
        });
        this.scene.add(this.transformControl);
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));

        this.animationId = null;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.animate();
    }

    onPointerDown(event) {
        if (!this.is3DMode) return;
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.objects3D, true);
        if (intersects.length > 0) {
            this.transformControl.attach(intersects[0].object);
        } else {
            this.transformControl.detach();
        }
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.objects3D.forEach(obj => {
            if (this.transformControl.object !== obj) {
                obj.rotation.y += 0.01;
            }
        });
        this.renderer.render(this.scene, this.camera);
    }

    setTransformMode(mode) {
        this.transformControl.setMode(mode);
    }

    handleTwoHand(distance, angle) {
        const obj = this.transformControl.object;
        if (!obj) return;
        
        // Scale base on dist scale range
        const scaleFactor = Math.max(0.1, distance / 200);
        obj.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        // Rotate based on angle
        obj.rotation.y = angle;
    }

    stop() {
        if(this.animationId) cancelAnimationFrame(this.animationId);
        this.controls.dispose();
        this.transformControl.dispose();
    }

    addShape(type, color, position = null) {
        if (!position) {
            position = {
                x: (Math.random() - 0.5) * 50,
                y: 0,
                z: (Math.random() - 0.5) * 50
            };
        }
        this.is3DMode = true;
        let geometry, material, mesh;
        material = new THREE.MeshPhongMaterial({ color: color || Math.random() * 0xffffff });
        
        const group = new THREE.Group();

        switch (type.toLowerCase()) {
            case 'house':
            case 'building': {
                const boxGeo = new THREE.BoxGeometry(20, 20, 20);
                const roofGeo = new THREE.ConeGeometry(15, 10, 4);
                const box = new THREE.Mesh(boxGeo, material);
                const roof = new THREE.Mesh(roofGeo, new THREE.MeshPhongMaterial({color: 0xaa2222}));
                roof.position.y = 15;
                roof.rotation.y = Math.PI / 4;
                group.add(box);
                group.add(roof);
                mesh = group;
                break;
            }
            case 'tree': {
                const trunkGeo = new THREE.CylinderGeometry(2, 2, 10);
                const leavesGeo = new THREE.SphereGeometry(10);
                const trunk = new THREE.Mesh(trunkGeo, new THREE.MeshPhongMaterial({color: 0x8B4513}));
                const leaves = new THREE.Mesh(leavesGeo, new THREE.MeshPhongMaterial({color: 0x228B22}));
                leaves.position.y = 10;
                group.add(trunk);
                group.add(leaves);
                mesh = group;
                break;
            }
            case 'vehicle':
            case 'car': {
                const bodyGeo = new THREE.BoxGeometry(30, 10, 15);
                const topGeo = new THREE.BoxGeometry(15, 8, 14);
                const body = new THREE.Mesh(bodyGeo, material);
                const topP = new THREE.Mesh(topGeo, new THREE.MeshPhongMaterial({color: 0x999999}));
                topP.position.y = 9;
                group.add(body);
                group.add(topP);
                mesh = group;
                break;
            }
            case 'human': {
                const headGeo = new THREE.SphereGeometry(4);
                const torsoGeo = new THREE.CylinderGeometry(4, 4, 12);
                const head = new THREE.Mesh(headGeo, material);
                const torso = new THREE.Mesh(torsoGeo, new THREE.MeshPhongMaterial({color: 0x2222cc}));
                head.position.y = 10;
                group.add(torso);
                group.add(head);
                mesh = group;
                break;
            }
            // Additional basic standard geometry types (Simulating "50+ shapes")
            case 'box':
            case 'cube':
            case 'rectangle':
                geometry = new THREE.BoxGeometry(15, 15, 15);
                break;
            case 'sphere':
            case 'ball':
            case 'circle':
                geometry = new THREE.SphereGeometry(10, 32, 16);
                break;
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(8, 8, 20, 32);
                break;
            case 'cone':
                geometry = new THREE.ConeGeometry(10, 20, 32);
                break;
            case 'torus':
            case 'ring':
                geometry = new THREE.TorusGeometry(10, 3, 16, 100);
                break;
            case 'torusknot':
                geometry = new THREE.TorusKnotGeometry(10, 3, 100, 16);
                break;
            case 'tetrahedron':
                geometry = new THREE.TetrahedronGeometry(12);
                break;
            case 'octahedron':
                geometry = new THREE.OctahedronGeometry(12);
                break;
            case 'dodecahedron':
                geometry = new THREE.DodecahedronGeometry(12);
                break;
            case 'icosahedron':
                geometry = new THREE.IcosahedronGeometry(12);
                break;
            case 'plane':
                geometry = new THREE.PlaneGeometry(20, 20);
                material.side = THREE.DoubleSide;
                break;
            case 'capsule':
                geometry = new THREE.CapsuleGeometry(5, 10, 4, 16);
                break;
            default:
                geometry = new THREE.BoxGeometry(10, 10, 10); // fallback
                break;
        }

        if (!mesh) {
            mesh = new THREE.Mesh(geometry, material);
        }

        mesh.position.set(position.x, position.y, position.z);
        
        // Ensure shadows and raycasting works
        mesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.scene.add(mesh);
        this.objects3D.push(mesh);
        this.transformControl.attach(mesh);
    }

    clear3D() {
        this.objects3D.forEach(obj => {
            this.scene.remove(obj);
            obj.traverse((child) => {
                if (child.isMesh) {
                    child.geometry?.dispose();
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material?.dispose();
                }
            });
        });
        this.objects3D = [];
        this.transformControl.detach();
    }

    convertStrokesTo3D(strokes) {
        if (!strokes || strokes.length === 0) return;
        const w = window.innerWidth;
        const h = window.innerHeight;

        strokes.forEach((stroke) => {
            if (!stroke.points || stroke.points.length < 2) return;

            const points = stroke.points.map((p) => {
                const nx = ((p.x / w) - 0.5) * 200;
                const ny = -((p.y / h) - 0.5) * 100;
                return new THREE.Vector3(nx, ny, 0);
            });

            const curve = new THREE.CatmullRomCurve3(points);
            const tubeRadius = Math.max(0.5, (stroke.baseSize || 6) * 0.15);
            const geometry = new THREE.TubeGeometry(curve, points.length * 2, tubeRadius, 8, false);
            const color = stroke.color && stroke.color !== 'erase' ? new THREE.Color(stroke.color) : new THREE.Color(0x8b5a2b);
            const material = new THREE.MeshPhongMaterial({ color, shininess: 80 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            this.objects3D.push(mesh);
        });

        this.is3DMode = true;
    }
}
