import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import helvetikerFont from "three/examples/fonts/helvetiker_regular.typeface.json";

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

    replaceSelectedShape(type, color, finish = 'gloss') {
        const selected = this.selectedObject;
        if (!selected) return null;

        const position = selected.position.clone();
        const rotation = selected.rotation.clone();
        const scale = selected.scale.clone();
        const shapeType = type || selected.userData?.shapeType || 'box';
        const shapeColor = color ?? selected.userData?.colorHex ?? 0xffffff;

        this.removeObject(selected);
        const replacement = this.addShape(shapeType, shapeColor, position, finish);
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

    buildMaterial(color, finish = 'gloss') {
        const baseColor = new THREE.Color(color || 0xffffff);
        switch (finish) {
            case 'matte':
                return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.95, metalness: 0.02 });
            case 'metal':
                return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.25, metalness: 0.95 });
            case 'glass':
                return new THREE.MeshPhysicalMaterial({ color: baseColor, roughness: 0.1, metalness: 0.05, transmission: 0.7, transparent: true, opacity: 0.75, clearcoat: 1 });
            case 'gloss':
            default:
                return new THREE.MeshPhongMaterial({ color: baseColor, shininess: 120, specular: 0xffffff });
        }
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
            case 'flower': {
                const center = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 16), new THREE.MeshPhongMaterial({ color: 0xfacc15 }));
                const petalMaterial = new THREE.MeshPhongMaterial({ color: 0xff6b6b });
                for (let i = 0; i < 6; i++) {
                    const petal = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), petalMaterial);
                    const angle = (Math.PI * 2 / 6) * i;
                    petal.position.set(Math.cos(angle) * 6, Math.sin(angle) * 3, Math.sin(angle) * 6);
                    group.add(petal);
                }
                group.add(center);
                mesh = group;
                break;
            }
            case 'star': {
                const shape = new THREE.Shape();
                for (let i = 0; i < 10; i++) {
                    const angle = (Math.PI / 5) * i - Math.PI / 2;
                    const radius = i % 2 === 0 ? 10 : 4.5;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    if (i === 0) shape.moveTo(x, y);
                    else shape.lineTo(x, y);
                }
                shape.closePath();
                mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 4, bevelEnabled: true, bevelThickness: 1, bevelSize: 0.7 }), material);
                break;
            }
            case 'shield': {
                const shape = new THREE.Shape();
                shape.moveTo(0, 14);
                shape.lineTo(-10, 10);
                shape.lineTo(-8, -8);
                shape.lineTo(0, -14);
                shape.lineTo(8, -8);
                shape.lineTo(10, 10);
                shape.closePath();
                mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: true, bevelThickness: 1, bevelSize: 0.6 }), material);
                break;
            }
            case 'arrow': {
                const shape = new THREE.Shape();
                shape.moveTo(-10, -4);
                shape.lineTo(2, -4);
                shape.lineTo(2, -10);
                shape.lineTo(14, 0);
                shape.lineTo(2, 10);
                shape.lineTo(2, 4);
                shape.lineTo(-10, 4);
                shape.closePath();
                mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 4, bevelEnabled: true, bevelThickness: 1, bevelSize: 0.5 }), material);
                break;
            }
            case 'leaf': {
                const shape = new THREE.Shape();
                shape.moveTo(0, 16);
                shape.quadraticCurveTo(14, 8, 10, 0);
                shape.quadraticCurveTo(14, -8, 0, -16);
                shape.quadraticCurveTo(-14, -8, -10, 0);
                shape.quadraticCurveTo(-14, 8, 0, 16);
                mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: true, bevelThickness: 0.7, bevelSize: 0.4 }), material);
                break;
            }
            case 'moon': {
                const outer = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 16), material);
                const inner = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), new THREE.MeshPhongMaterial({ color: 0x000000 }));
                inner.position.set(4, 0, 0);
                group.add(outer, inner);
                mesh = group;
                break;
            }
            case 'sun': {
                const core = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshPhongMaterial({ color: 0xffd60a }));
                group.add(core);
                for (let i = 0; i < 8; i++) {
                    const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 12, 8), new THREE.MeshPhongMaterial({ color: 0xffb703 }));
                    const angle = (Math.PI * 2 / 8) * i;
                    ray.rotation.z = Math.PI / 2;
                    ray.position.set(Math.cos(angle) * 12, Math.sin(angle) * 12, 0);
                    ray.rotation.y = angle;
                    group.add(ray);
                }
                mesh = group;
                break;
            }
            case 'building': {
                const mainBody = new THREE.Mesh(new THREE.BoxGeometry(20, 28, 18), material);
                const roofBase = new THREE.Mesh(new THREE.BoxGeometry(22, 3, 20), new THREE.MeshPhongMaterial({ color: 0x333333 }));
                roofBase.position.y = 16;
                group.add(mainBody, roofBase);
                for (let row = 0; row < 4; row++) {
                    for (let col = 0; col < 3; col++) {
                        const window = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 0.5), new THREE.MeshPhongMaterial({ color: 0x87ceeb }));
                        window.position.set(-6 + col * 6, 2 + row * 6.5, 9.5);
                        group.add(window);
                    }
                }
                mesh = group;
                break;
            }
            case 'skyscraper': {
                const body = new THREE.Mesh(new THREE.BoxGeometry(16, 50, 14), material);
                const rooftop = new THREE.Mesh(new THREE.ConeGeometry(10, 8, 4), new THREE.MeshPhongMaterial({ color: 0xaaaaaa }));
                rooftop.position.y = 29;
                group.add(body, rooftop);
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 4; col++) {
                        const window = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 0.4), new THREE.MeshPhongMaterial({ color: 0xffff99 }));
                        window.position.set(-5 + col * 4, -10 + row * 6, 7.2);
                        group.add(window);
                    }
                }
                mesh = group;
                break;
            }
            case 'shop': {
                const body = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 10), material);
                const storefront = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 0.2), new THREE.MeshPhongMaterial({ color: 0x1a1a1a }));
                storefront.position.set(0, -2, 5.1);
                const window = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 0.1), new THREE.MeshPhongMaterial({ color: 0xccffff }));
                window.position.set(0, 0, 5.15);
                const door = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 0.1), new THREE.MeshPhongMaterial({ color: 0x8b4513 }));
                door.position.set(-4, -2, 5.15);
                group.add(body, storefront, window, door);
                mesh = group;
                break;
            }
            case 'streetlamp': {
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 24, 8), material);
                const head = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 1, 8), new THREE.MeshPhongMaterial({ color: 0xffff99 }));
                head.position.y = 13;
                const light = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 16), new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0xffff99 }));
                light.position.y = 13.5;
                group.add(pole, head, light);
                mesh = group;
                break;
            }
            case 'fountain': {
                const base = new THREE.Mesh(new THREE.CylinderGeometry(12, 14, 2, 32), material);
                const basin = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 0.5, 32), new THREE.MeshPhongMaterial({ color: 0x6b9bd1 }));
                basin.position.y = 1.5;
                const center = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 6, 16), new THREE.MeshPhongMaterial({ color: 0xcccccc }));
                center.position.y = 3.5;
                const spout = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshPhongMaterial({ color: 0x6b9bd1 }));
                spout.position.y = 8;
                group.add(base, basin, center, spout);
                mesh = group;
                break;
            }
            case 'bridge': {
                const deck = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 14), material);
                const pillarL = new THREE.Mesh(new THREE.BoxGeometry(2, 16, 4), new THREE.MeshPhongMaterial({ color: 0x666666 }));
                const pillarR = pillarL.clone();
                pillarL.position.set(-14, -7, 0);
                pillarR.position.set(14, -7, 0);
                const arch = new THREE.Mesh(new THREE.TorusGeometry(10, 2, 12, 32, Math.PI), new THREE.MeshPhongMaterial({ color: 0x999999 }));
                arch.position.set(0, 4, 0);
                group.add(deck, pillarL, pillarR, arch);
                mesh = group;
                break;
            }
            case 'tower': {
                const base = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 6, 16), material);
                const mid = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 18, 16), new THREE.MeshPhongMaterial({ color: 0x999999 }));
                mid.position.y = 12;
                const top = new THREE.Mesh(new THREE.ConeGeometry(5, 10, 16), new THREE.MeshPhongMaterial({ color: 0xff6666 }));
                top.position.y = 28;
                group.add(base, mid, top);
                mesh = group;
                break;
            }
            case 'wall': {
                for (let row = 0; row < 3; row++) {
                    for (let col = 0; col < 4; col++) {
                        const brick = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 2.2), new THREE.MeshPhongMaterial({ color: 0x8b4513 }));
                        brick.position.set(-9 + col * 6, -4 + row * 6, 0);
                        group.add(brick);
                    }
                }
                mesh = group;
                break;
            }
            case 'door': {
                const frame = new THREE.Mesh(new THREE.BoxGeometry(6, 10, 0.5), new THREE.MeshPhongMaterial({ color: 0x666666 }));
                const door = new THREE.Mesh(new THREE.BoxGeometry(5, 9, 0.3), new THREE.MeshPhongMaterial({ color: 0x8b4513 }));
                door.position.z = 0.2;
                const knob = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshPhongMaterial({ color: 0xffaa00 }));
                knob.position.set(2, 0, 0.5);
                group.add(frame, door, knob);
                mesh = group;
                break;
            }
            case 'window': {
                const frame = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 0.5), new THREE.MeshPhongMaterial({ color: 0x333333 }));
                const pane1 = new THREE.Mesh(new THREE.BoxGeometry(3.8, 5.8, 0.1), new THREE.MeshPhongMaterial({ color: 0x87ceeb }));
                pane1.position.set(-2, 0, 0.2);
                const pane2 = pane1.clone();
                pane2.position.set(2, 0, 0.2);
                group.add(frame, pane1, pane2);
                mesh = group;
                break;
            }
            case 'stairs': {
                const stairs = new THREE.Group();
                for (let i = 0; i < 6; i++) {
                    const step = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 4), material);
                    step.position.set(0, -4 + i * 2.2, i * 2.8);
                    stairs.add(step);
                }
                mesh = stairs;
                break;
            }
            case 'fence': {
                const fence = new THREE.Group();
                for (let i = 0; i < 4; i++) {
                    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 12, 8), material);
                    post.position.x = -9 + i * 6;
                    const rail = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 0.5), new THREE.MeshPhongMaterial({ color: 0x8b4513 }));
                    rail.position.set(-6 + i * 6, 2, 0);
                    fence.add(post, rail);
                }
                mesh = fence;
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
            case 'arch':
                geometry = new THREE.TorusGeometry(10, 4, 12, 24, Math.PI);
                break;
            case 'wave':
                geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
                    new THREE.Vector3(-12, 0, 0),
                    new THREE.Vector3(-6, 8, 0),
                    new THREE.Vector3(0, -8, 0),
                    new THREE.Vector3(6, 8, 0),
                    new THREE.Vector3(12, 0, 0)
                ]), 48, 1.2, 8, false);
                break;
            case 'cross':
                geometry = new THREE.BoxGeometry(6, 24, 6);
                break;
            default:
                geometry = new THREE.BoxGeometry(10, 10, 10);
                break;
        }

        return new THREE.Mesh(geometry, material);
    }

    addShape(type, color, position = null, finish = 'gloss') {
        if (!position) {
            position = {
                x: (Math.random() - 0.5) * 50,
                y: 0,
                z: (Math.random() - 0.5) * 50
            };
        }
        this.is3DMode = true;
        const material = this.buildMaterial(color || Math.random() * 0xffffff, finish);
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

    addTextObject(text, color = 0xffffff, position = null, finish = 'gloss') {
        if (!text) return null;
        const safeText = String(text).slice(0, 32);
        const group = new THREE.Group();
        const geometry = new TextGeometry(safeText, {
            font: helvetikerFont,
            size: 8,
            depth: 2.5,
            curveSegments: 10,
            bevelEnabled: true,
            bevelThickness: 0.35,
            bevelSize: 0.15,
            bevelSegments: 2
        });
        geometry.computeBoundingBox();
        geometry.center();
        const textMesh = new THREE.Mesh(geometry, this.buildMaterial(color, finish));
        const textWidth = geometry.boundingBox ? geometry.boundingBox.max.x - geometry.boundingBox.min.x + 8 : 40;
        const backing = new THREE.Mesh(
            new THREE.BoxGeometry(textWidth, 12, 1.5),
            new THREE.MeshPhongMaterial({ color: 0x111111, transparent: true, opacity: 0.35 })
        );
        backing.position.z = -1.8;
        group.add(backing, textMesh);

        if (!position) {
            position = { x: 0, y: 0, z: 0 };
        }

        group.position.set(position.x, position.y, position.z);
        group.userData.shapeType = 'text';
        group.userData.colorHex = color;
        group.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        this.scene.add(group);
        this.objects3D.push(group);
        this.selectedObject = group;
        this.transformControl.attach(group);
        return group;
    }

    getStrokeBounds(stroke) {
        const points = stroke?.points || [];
        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const width = Math.max(8, maxX - minX);
        const height = Math.max(8, maxY - minY);
        return {
            minX,
            maxX,
            minY,
            maxY,
            width,
            height,
            centerX: minX + width / 2,
            centerY: minY + height / 2
        };
    }

    buildShapeFromStroke(stroke) {
        const bounds = this.getStrokeBounds(stroke);
        const shape = new THREE.Shape();
        const centerX = bounds.centerX;
        const centerY = bounds.centerY;
        const scaleX = 0.28;
        const scaleY = 0.28;
        const toLocal = (point) => new THREE.Vector2((point.x - centerX) * scaleX, -(point.y - centerY) * scaleY);
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1] || start;

        switch (stroke.tool) {
            case 'line': {
                const points = [start, end].map(toLocal);
                const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
                    new THREE.Vector3(points[0].x, points[0].y, 0),
                    new THREE.Vector3(points[1].x, points[1].y, 0)
                ]), 12, Math.max(0.5, (stroke.baseSize || 4) * 0.08), 8, false);
                return { geometry, center: new THREE.Vector3(centerX, centerY, 0) };
            }
            case 'circle':
                shape.absellipse(0, 0, bounds.width * scaleX * 0.5, bounds.height * scaleY * 0.5, 0, Math.PI * 2, false, 0);
                break;
            case 'rectangle':
            case 'square':
                shape.moveTo(-bounds.width * scaleX * 0.5, -bounds.height * scaleY * 0.5);
                shape.lineTo(bounds.width * scaleX * 0.5, -bounds.height * scaleY * 0.5);
                shape.lineTo(bounds.width * scaleX * 0.5, bounds.height * scaleY * 0.5);
                shape.lineTo(-bounds.width * scaleX * 0.5, bounds.height * scaleY * 0.5);
                shape.closePath();
                break;
            case 'triangle':
                shape.moveTo(0, -bounds.height * scaleY * 0.5);
                shape.lineTo(-bounds.width * scaleX * 0.5, bounds.height * scaleY * 0.5);
                shape.lineTo(bounds.width * scaleX * 0.5, bounds.height * scaleY * 0.5);
                shape.closePath();
                break;
            case 'diamond':
                shape.moveTo(0, -bounds.height * scaleY * 0.5);
                shape.lineTo(-bounds.width * scaleX * 0.5, 0);
                shape.lineTo(0, bounds.height * scaleY * 0.5);
                shape.lineTo(bounds.width * scaleX * 0.5, 0);
                shape.closePath();
                break;
            case 'hexagon':
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6;
                    const px = Math.cos(angle) * bounds.width * scaleX * 0.5;
                    const py = Math.sin(angle) * bounds.height * scaleY * 0.5;
                    if (i === 0) shape.moveTo(px, py);
                    else shape.lineTo(px, py);
                }
                shape.closePath();
                break;
            case 'star':
                for (let i = 0; i < 10; i++) {
                    const angle = (Math.PI / 5) * i - Math.PI / 2;
                    const radius = i % 2 === 0 ? Math.max(bounds.width, bounds.height) * 0.35 : Math.max(bounds.width, bounds.height) * 0.16;
                    const px = Math.cos(angle) * radius * 0.28;
                    const py = Math.sin(angle) * radius * 0.28;
                    if (i === 0) shape.moveTo(px, py);
                    else shape.lineTo(px, py);
                }
                shape.closePath();
                break;
            case 'heart': {
                const w = bounds.width * scaleX * 0.5;
                const h = bounds.height * scaleY * 0.5;
                shape.moveTo(0, h);
                shape.bezierCurveTo(-w * 1.2, h * 0.2, -w * 1.3, -h * 0.8, 0, -h * 0.2);
                shape.bezierCurveTo(w * 1.3, -h * 0.8, w * 1.2, h * 0.2, 0, h);
                shape.closePath();
                break;
            }
            default:
                return { geometry: null, center: new THREE.Vector3(centerX, centerY, 0) };
        }

        const depth = Math.max(1.2, (stroke.baseSize || 6) * 0.35);
        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth,
            bevelEnabled: true,
            bevelThickness: depth * 0.15,
            bevelSize: depth * 0.08,
            bevelSegments: 2,
            curveSegments: 16
        });
        geometry.center();
        return { geometry, center: new THREE.Vector3(centerX, centerY, 0) };
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

    updateObjectScale(height, width, depth) {
        if (!this.selectedObject) return;
        this.selectedObject.scale.y = Math.max(0.1, height);
        this.selectedObject.scale.x = Math.max(0.1, width);
        this.selectedObject.scale.z = Math.max(0.1, depth);
    }

    updateObjectColor(colorHex) {
        if (!this.selectedObject) return;
        this.selectedObject.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.color.setHex(colorHex));
                } else {
                    child.material.color.setHex(colorHex);
                }
            }
        });
        this.selectedObject.userData.colorHex = colorHex;
    }

    updateObjectOpacity(opacity) {
        if (!this.selectedObject) return;
        this.selectedObject.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => {
                        m.opacity = opacity;
                        m.transparent = opacity < 1;
                    });
                } else {
                    child.material.opacity = opacity;
                    child.material.transparent = opacity < 1;
                }
            }
        });
    }

    getSelectedObjectProperties() {
        if (!this.selectedObject) return null;
        return {
            height: this.selectedObject.scale.y,
            width: this.selectedObject.scale.x,
            depth: this.selectedObject.scale.z,
            color: this.selectedObject.userData.colorHex || 0xffffff,
            opacity: this.selectedObject.material?.opacity ?? 1
        };
    }

    convertStrokesTo3D(strokes) {
        if (!strokes || strokes.length === 0) return;
        const w = window.innerWidth;
        const h = window.innerHeight;

        strokes.forEach((stroke) => {
            if (!stroke.points || stroke.points.length < 2) return;

            const strokeResult = this.buildShapeFromStroke(stroke);
            let geometry = strokeResult.geometry;
            if (!geometry) {
                const points = stroke.points.map((p) => {
                    const nx = ((p.x / w) - 0.5) * 200;
                    const ny = -((p.y / h) - 0.5) * 100;
                    return new THREE.Vector3(nx, ny, 0);
                });
                const curve = new THREE.CatmullRomCurve3(points);
                const tubeRadius = Math.max(0.5, (stroke.baseSize || 6) * 0.15);
                geometry = new THREE.TubeGeometry(curve, points.length * 2, tubeRadius, 8, false);
            }
            const color = stroke.color && stroke.color !== 'erase' ? new THREE.Color(stroke.color) : new THREE.Color(0x8b5a2b);
            const material = new THREE.MeshPhongMaterial({ color, shininess: 80 });
            const mesh = new THREE.Mesh(geometry, material);
            const center = strokeResult.center || new THREE.Vector3();
            mesh.position.set(((center.x / w) - 0.5) * 200, -((center.y / h) - 0.5) * 100, 0);
            mesh.userData.shapeType = 'stroke';
            mesh.userData.strokeTool = stroke.tool || 'pen';
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            this.objects3D.push(mesh);
        });

        this.is3DMode = true;
    }
}
