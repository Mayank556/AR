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
        this.renderer.domElement.style.touchAction = 'none';
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
        this.transformControl.setMode('translate');
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
        this.selectedObject = null;
        this.activePointers = new Map();
        this.dragState = null;
        this.pinchState = null;

        this.renderer.domElement.addEventListener('pointermove', this.onPointerMove.bind(this));
        this.renderer.domElement.addEventListener('pointerup', this.onPointerUp.bind(this));
        this.renderer.domElement.addEventListener('pointercancel', this.onPointerUp.bind(this));
        this.animate();
    }

    getRootObject(object) {
        if (!object) return null;
        let current = object;
        while (current.parent && current.parent !== this.scene && !this.objects3D.includes(current)) {
            current = current.parent;
        }
        return current;
    }

    onPointerDown(event) {
        if (!this.is3DMode) return;
        event.preventDefault();
        this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.objects3D, true);
        if (intersects.length > 0) {
            const root = this.getRootObject(intersects[0].object);
            this.selectedObject = root;
            this.transformControl.attach(root);
            this.controls.enabled = false;

            if (this.activePointers.size === 1) {
                const hitPoint = new THREE.Vector3();
                const plane = new THREE.Plane();
                const cameraDirection = new THREE.Vector3();
                this.camera.getWorldDirection(cameraDirection);
                plane.setFromNormalAndCoplanarPoint(cameraDirection.clone().negate(), root.position);
                this.raycaster.ray.intersectPlane(plane, hitPoint);
                this.dragState = {
                    plane,
                    offset: hitPoint.clone().sub(root.position)
                };
            }
        } else if (!this.selectedObject) {
            this.selectedObject = null;
            this.transformControl.detach();
        }

        if (this.activePointers.size >= 2 && this.selectedObject) {
            const points = Array.from(this.activePointers.values());
            this.pinchState = {
                distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
                scale: this.selectedObject.scale.clone(),
                rotation: this.selectedObject.rotation.y
            };
            this.dragState = null;
        }
    }

    onPointerMove(event) {
        if (!this.is3DMode || !this.selectedObject) return;
        if (!this.activePointers.has(event.pointerId)) return;

        event.preventDefault();
        this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (this.activePointers.size >= 2 && this.pinchState) {
            const points = Array.from(this.activePointers.values());
            const nextDistance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
            const factor = Math.max(0.15, Math.min(8, nextDistance / Math.max(40, this.pinchState.distance)));
            this.selectedObject.scale.set(
                this.pinchState.scale.x * factor,
                this.pinchState.scale.y * factor,
                this.pinchState.scale.z * factor
            );
            const angle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
            this.selectedObject.rotation.y = this.pinchState.rotation + angle * 0.15;
            return;
        }

        if (!this.dragState) return;

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hitPoint = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.dragState.plane, hitPoint)) {
            this.selectedObject.position.copy(hitPoint.sub(this.dragState.offset));
        }
    }

    onPointerUp(event) {
        if (!this.is3DMode) return;
        this.activePointers.delete(event.pointerId);

        if (this.activePointers.size < 2) {
            this.pinchState = null;
        }

        if (this.activePointers.size === 0) {
            this.dragState = null;
            this.controls.enabled = true;
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

    focusObject(object) {
        const root = this.getRootObject(object);
        if (!root) return;
        this.selectedObject = root;
        this.transformControl.attach(root);
    }

    replaceSelectedShape(type, color) {
        const selected = this.selectedObject;
        if (!selected) return null;

        const position = selected.position.clone();
        const rotation = selected.rotation.clone();
        const scale = selected.scale.clone();
        const shapeType = type || selected.userData?.shapeType || 'box';
        const shapeColor = color ?? selected.userData?.colorHex ?? 0xffffff;

        this.removeObject(selected);
        const replacement = this.addShape(shapeType, shapeColor, position);
        replacement.rotation.copy(rotation);
        replacement.scale.copy(scale);
        this.focusObject(replacement);
        return replacement;
    }

    handleTwoHand(distance, angle) {
        const obj = this.transformControl.object || this.selectedObject;
        if (!obj) return;
        
        const scaleFactor = Math.max(0.15, Math.min(8, distance / 140));
        obj.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        obj.rotation.y = angle;
    }

    stop() {
        if(this.animationId) cancelAnimationFrame(this.animationId);
        this.controls.dispose();
        this.transformControl.dispose();
    }

    removeObject(object) {
        const root = this.getRootObject(object);
        if (!root) return;

        this.scene.remove(root);
        this.objects3D = this.objects3D.filter((item) => item !== root);
        if (this.selectedObject === root) {
            this.selectedObject = null;
            this.transformControl.detach();
        }
        root.traverse((child) => {
            if (child.isMesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material?.dispose();
            }
        });
    }

    createCompositeMesh(type, material) {
        const group = new THREE.Group();
        let mesh = null;

        switch (type) {
            case 'house': {
                const box = new THREE.Mesh(new THREE.BoxGeometry(20, 16, 20), material);
                const roof = new THREE.Mesh(new THREE.ConeGeometry(15, 10, 4), new THREE.MeshPhongMaterial({ color: 0xaa2222 }));
                roof.position.y = 13;
                roof.rotation.y = Math.PI / 4;
                group.add(box, roof);
                mesh = group;
                break;
            }
            case 'tree': {
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 12, 8), new THREE.MeshPhongMaterial({ color: 0x7a4a20 }));
                const leaves = new THREE.Mesh(new THREE.SphereGeometry(9, 18, 16), new THREE.MeshPhongMaterial({ color: 0x2f9e44 }));
                leaves.position.y = 10;
                group.add(trunk, leaves);
                mesh = group;
                break;
            }
            case 'human': {
                const head = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 18), material);
                const torso = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, 12, 16), new THREE.MeshPhongMaterial({ color: 0x2244cc }));
                const legs = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 10, 12), new THREE.MeshPhongMaterial({ color: 0x444444 }));
                head.position.y = 12;
                torso.position.y = 3;
                legs.position.y = -8;
                group.add(legs, torso, head);
                mesh = group;
                break;
            }
            case 'rocket': {
                const body = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 28, 20), material);
                const nose = new THREE.Mesh(new THREE.ConeGeometry(6.5, 12, 20), new THREE.MeshPhongMaterial({ color: 0xff6666 }));
                const finGeo = new THREE.BoxGeometry(2, 8, 8);
                const fin1 = new THREE.Mesh(finGeo, new THREE.MeshPhongMaterial({ color: 0xffaa00 }));
                const fin2 = fin1.clone();
                nose.position.y = 20;
                fin1.position.set(-7, -10, 0);
                fin2.position.set(7, -10, 0);
                group.add(body, nose, fin1, fin2);
                mesh = group;
                break;
            }
            case 'car':
            case 'vehicle': {
                const body = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 16), material);
                const cabin = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 14), new THREE.MeshPhongMaterial({ color: 0xdddddd }));
                cabin.position.y = 9;
                group.add(body, cabin);
                mesh = group;
                break;
            }
            case 'bus': {
                const body = new THREE.Mesh(new THREE.BoxGeometry(38, 12, 16), material);
                const top = new THREE.Mesh(new THREE.BoxGeometry(36, 4, 14), new THREE.MeshPhongMaterial({ color: 0xf4c542 }));
                top.position.y = 8;
                group.add(body, top);
                mesh = group;
                break;
            }
            case 'boat': {
                const hull = new THREE.Mesh(new THREE.CylinderGeometry(0, 15, 28, 4), material);
                hull.rotation.z = Math.PI / 2;
                const sail = new THREE.Mesh(new THREE.PlaneGeometry(16, 20), new THREE.MeshPhongMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
                sail.position.y = 14;
                group.add(hull, sail);
                mesh = group;
                break;
            }
            case 'chair': {
                const seat = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 16), material);
                const back = new THREE.Mesh(new THREE.BoxGeometry(16, 18, 2), new THREE.MeshPhongMaterial({ color: 0x8b5a2b }));
                back.position.set(0, 10, -7);
                group.add(seat, back);
                mesh = group;
                break;
            }
            case 'table': {
                const top = new THREE.Mesh(new THREE.BoxGeometry(28, 2, 18), material);
                const legGeo = new THREE.CylinderGeometry(1, 1, 16, 10);
                const legMaterial = new THREE.MeshPhongMaterial({ color: 0x5d4037 });
                const legs = [
                    [-11, -8, -7], [11, -8, -7], [-11, -8, 7], [11, -8, 7]
                ].map(([x, y, z]) => {
                    const leg = new THREE.Mesh(legGeo, legMaterial);
                    leg.position.set(x, y, z);
                    return leg;
                });
                group.add(top, ...legs);
                mesh = group;
                break;
            }
            case 'cloud': {
                const puffMaterial = new THREE.MeshPhongMaterial({ color: 0xe6f3ff, transparent: true, opacity: 0.96 });
                const puffs = [
                    [-8, 0, 0, 6], [0, 3, 0, 8], [9, 0, 0, 7], [0, -2, 0, 6]
                ].map(([x, y, z, r]) => {
                    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), puffMaterial);
                    puff.position.set(x, y, z);
                    return puff;
                });
                group.add(...puffs);
                mesh = group;
                break;
            }
            case 'heart': {
                const body = new THREE.Mesh(new THREE.SphereGeometry(8, 20, 16), new THREE.MeshPhongMaterial({ color: 0xff4d6d }));
                const body2 = body.clone();
                body.position.set(-5, 2, 0);
                body2.position.set(5, 2, 0);
                const base = new THREE.Mesh(new THREE.ConeGeometry(9, 14, 4), new THREE.MeshPhongMaterial({ color: 0xff4d6d }));
                base.rotation.z = Math.PI;
                base.position.y = -6;
                group.add(body, body2, base);
                mesh = group;
                break;
            }
            default:
                break;
        }

        return mesh;
    }

    createSolidMesh(type, material) {
        let geometry = null;

        switch (type) {
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
            case 'prism':
                geometry = new THREE.CylinderGeometry(10, 10, 18, 3);
                break;
            case 'pyramid':
                geometry = new THREE.ConeGeometry(12, 20, 4);
                break;
            case 'gem':
                geometry = new THREE.OctahedronGeometry(12, 0);
                break;
            case 'disk':
                geometry = new THREE.CylinderGeometry(10, 10, 2, 32);
                break;
            case 'pill':
                geometry = new THREE.CapsuleGeometry(7, 18, 6, 16);
                break;
            default:
                geometry = new THREE.BoxGeometry(10, 10, 10);
                break;
        }

        return new THREE.Mesh(geometry, material);
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
        const material = new THREE.MeshPhongMaterial({ color: color || Math.random() * 0xffffff });
        let mesh;

        const composite = this.createCompositeMesh(type.toLowerCase(), material);
        mesh = composite || this.createSolidMesh(type.toLowerCase(), material);

        mesh.position.set(position.x, position.y, position.z);
        mesh.userData.shapeType = type.toLowerCase();
        mesh.userData.colorHex = material.color.getHex();
        
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
        this.selectedObject = mesh;
        this.transformControl.attach(mesh);
        return mesh;
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
        this.selectedObject = null;
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
            mesh.userData.shapeType = 'stroke';
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            this.objects3D.push(mesh);
        });

        this.is3DMode = true;
    }
}
