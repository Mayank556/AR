import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

export default class ARVRSystem {
    constructor(threeCanvas, bgCanvas) {
        this.threeCanvas = threeCanvas;
        this.scene = new THREE.Scene();
        
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 50, 150);
        
        this.renderer = new THREE.WebGLRenderer({ canvas: this.threeCanvas, alpha: true, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        const light = new THREE.DirectionalLight(0xffffff, 1.2);
        light.position.set(100, 200, 50);
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
        this.controls.update(); // for damping
        this.renderer.render(this.scene, this.camera);
    }
    
    $code
    stop() {
        if(this.animationId) cancelAnimationFrame(this.animationId);
        this.controls.dispose();
        this.transformControl.dispose();
    }

    addShape(type, color, position = {x:0, y:0, z:0}) {
        this.is3DMode = true;
        let geometry, material, mesh;
        material = new THREE.MeshPhongMaterial({ color: color || 0xffffff });
        
        const group = new THREE.Group();

        switch (type.toLowerCase()) {
            case 'house':
            case 'building':
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
            case 'tree':
                const trunkGeo = new THREE.CylinderGeometry(2, 2, 10);
                const leavesGeo = new THREE.SphereGeometry(10);
                const trunk = new THREE.Mesh(trunkGeo, new THREE.MeshPhongMaterial({color: 0x8B4513}));
                const leaves = new THREE.Mesh(leavesGeo, new THREE.MeshPhongMaterial({color: 0x228B22}));
                leaves.position.y = 8;
                group.add(trunk);
                group.add(leaves);
                mesh = group;
                break;
            case 'vehicle':
            case 'car':
                const carBodyGeom = new THREE.BoxGeometry(30, 10, 15);
                const carTopGeom = new THREE.BoxGeometry(15, 8, 12);
                const carBody = new THREE.Mesh(carBodyGeom, material);
                const carTop = new THREE.Mesh(carTopGeom, new THREE.MeshPhongMaterial({color: 0xffffff}));
                carTop.position.y = 9;
                group.add(carBody, carTop);
                // Wheels
                for(let i=0; i<4; i++) {
                    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(4,4,2), new THREE.MeshPhongMaterial({color:0x111111}));
                    wheel.rotation.x = Math.PI/2;
                    wheel.position.set(i<2?-10:10, -5, i%2===0?8:-8);
                    group.add(wheel);
                }
                mesh = group;
                break;
            case 'human':
                // simple stick figure/block human
                const head = new THREE.Mesh(new THREE.SphereGeometry(4), new THREE.MeshPhongMaterial({color:0xffccaa}));
                head.position.y = 15;
                const body = new THREE.Mesh(new THREE.BoxGeometry(8, 12, 4), material);
                body.position.y = 5;
                group.add(head, body);
                mesh = group;
                break;
            case 'circle':
            case 'sphere':
                geometry = new THREE.SphereGeometry(15, 32, 32);
                mesh = new THREE.Mesh(geometry, material);
                break;
            case 'rectangle':
            case 'box':
            case 'cube':
                geometry = new THREE.BoxGeometry(20, 20, 20);
                mesh = new THREE.Mesh(geometry, material);
                break;
            case 'triangle':
            case 'cone':
                geometry = new THREE.ConeGeometry(15, 20, 3);
                mesh = new THREE.Mesh(geometry, material);
                break;
            default:
                geometry = new THREE.BoxGeometry(10, 10, 10);
                mesh = new THREE.Mesh(geometry, material);
                break;
        }

        mesh.position.set(position.x, position.y, position.z);
        this.group.add(mesh);
        this.objects3D.push(mesh);
    }
}
