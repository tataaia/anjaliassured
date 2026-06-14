document.addEventListener("DOMContentLoaded", () => {
    // 1. Scene Setup
    const canvas = document.getElementById('bird-canvas');
    if (!canvas) return;

    // Make canvas overlay the screen
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '5'; // Above fluid, below text
    canvas.style.pointerEvents = 'none';

    const scene = new THREE.Scene();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
    directionalLight.position.set(200, 500, 300);
    scene.add(directionalLight);
    
    // Add point light to simulate sun/glowing refractions on glass
    const pointLight = new THREE.PointLight(0x00a896, 3, 1000);
    pointLight.position.set(0, 100, 200);
    scene.add(pointLight);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 3000);
    camera.position.set(0, 0, 800);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // 2. The True Glass Material
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.2,
        roughness: 0.05,
        transmission: 1.0, // Glass refraction
        ior: 1.5,
        thickness: 2.0,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide
    });
    
    const darkGlass = new THREE.MeshPhysicalMaterial({
        color: 0x111111,
        metalness: 0.8,
        roughness: 0.1,
        transmission: 0.9,
        ior: 1.6,
        thickness: 1.0,
        transparent: true
    });

    // 3. Procedural Eagle Architecture
    class ProceduralEagle {
        constructor() {
            this.mesh = new THREE.Group();
            
            // Eagle Body
            const bodyGeom = new THREE.CylinderGeometry(15, 30, 100, 8);
            bodyGeom.rotateX(Math.PI / 2);
            this.body = new THREE.Mesh(bodyGeom, glassMaterial);
            this.mesh.add(this.body);

            // Tail
            const tailGeom = new THREE.BoxGeometry(40, 5, 60);
            tailGeom.translate(0, 0, 30);
            this.tail = new THREE.Mesh(tailGeom, glassMaterial);
            this.tail.position.z = 50;
            this.body.add(this.tail);

            // Head
            const headGeom = new THREE.BoxGeometry(25, 25, 35);
            this.head = new THREE.Mesh(headGeom, glassMaterial);
            this.head.position.set(0, 10, -60);
            this.body.add(this.head);

            // Beak
            const beakGeom = new THREE.ConeGeometry(10, 30, 4);
            beakGeom.rotateX(Math.PI / 2);
            const beak = new THREE.Mesh(beakGeom, darkGlass);
            beak.position.set(0, -5, -25);
            this.head.add(beak);

            // Eyes
            const eyeGeom = new THREE.SphereGeometry(3, 8, 8);
            const eyeR = new THREE.Mesh(eyeGeom, darkGlass);
            eyeR.position.set(12, 5, -10);
            const eyeL = eyeR.clone();
            eyeL.position.set(-12, 5, -10);
            this.head.add(eyeR);
            this.head.add(eyeL);

            // Wings setup
            this.wings = { left: new THREE.Group(), right: new THREE.Group() };
            this.buildWing(this.wings.left, 1);
            this.buildWing(this.wings.right, -1);
            
            this.wings.left.position.set(20, 0, -20);
            this.wings.right.position.set(-20, 0, -20);
            
            this.body.add(this.wings.left);
            this.body.add(this.wings.right);

            // Physics properties
            this.velocity = new THREE.Vector3(0, 0, 0);
            this.acceleration = new THREE.Vector3(0, 0, 0);
            this.maxSpeed = 12;
            this.maxForce = 0.5;
            this.target = new THREE.Vector3(0, 0, 0);
        }

        buildWing(wingGroup, side) {
            // Inner Wing
            const innerGeom = new THREE.BoxGeometry(100, 5, 40);
            innerGeom.translate(50 * side, 0, 0);
            const inner = new THREE.Mesh(innerGeom, glassMaterial);
            wingGroup.add(inner);
            wingGroup.inner = inner;

            // Outer Wing (attached to inner)
            const outerGroup = new THREE.Group();
            outerGroup.position.set(100 * side, 0, 0);
            inner.add(outerGroup);
            wingGroup.outerGroup = outerGroup;

            const outerGeom = new THREE.BoxGeometry(120, 3, 30);
            outerGeom.translate(60 * side, 0, -10);
            const outer = new THREE.Mesh(outerGeom, glassMaterial);
            outerGroup.add(outer);
            
            // Add individual feathers to outer wing for detailing
            for(let i=0; i<5; i++) {
                const featherGeom = new THREE.BoxGeometry(15, 1, 60);
                featherGeom.translate(0, 0, 30);
                const feather = new THREE.Mesh(featherGeom, glassMaterial);
                feather.position.set((20 + i*20) * side, -2, 0);
                feather.rotation.y = (Math.PI / 12) * side * (i/5);
                outerGroup.add(feather);
            }
        }

        update(time) {
            // 1. Aerodynamic Flapping Math
            const flapSpeed = 5;
            // Main shoulder flap
            const angle = Math.sin(time * flapSpeed);
            this.wings.left.rotation.z = angle * 0.5;
            this.wings.right.rotation.z = -angle * 0.5;

            // Elbow phase shift (lag behind shoulder for fluid aerodynamics)
            const outerAngle = Math.sin(time * flapSpeed - 1.0);
            this.wings.left.outerGroup.rotation.z = outerAngle * 0.6;
            this.wings.right.outerGroup.rotation.z = -outerAngle * 0.6;

            // Tail stabilization
            this.tail.rotation.x = Math.sin(time * 2) * 0.1;

            // 2. Flight Physics Engine (Steering behavior towards target)
            const desired = new THREE.Vector3().subVectors(this.target, this.mesh.position);
            const dist = desired.length();
            desired.normalize();
            
            // Arrive behavior
            if (dist < 100) {
                desired.multiplyScalar(this.maxSpeed * (dist / 100));
            } else {
                desired.multiplyScalar(this.maxSpeed);
            }

            const steer = new THREE.Vector3().subVectors(desired, this.velocity);
            steer.clampLength(0, this.maxForce);
            
            this.acceleration.add(steer);
            this.velocity.add(this.acceleration);
            this.mesh.position.add(this.velocity);
            this.acceleration.multiplyScalar(0); // Reset

            // 3. Dynamic Banking & Rotation based on velocity
            // Point towards velocity
            if (this.velocity.lengthSq() > 0.1) {
                const targetRotY = Math.atan2(this.velocity.x, this.velocity.z);
                const targetRotX = Math.atan2(-this.velocity.y, Math.sqrt(this.velocity.x*this.velocity.x + this.velocity.z*this.velocity.z));
                
                // Smoothly interpolate rotation
                this.mesh.rotation.y += (targetRotY - this.mesh.rotation.y) * 0.1;
                this.mesh.rotation.x += (targetRotX - this.mesh.rotation.x) * 0.1;

                // Bank into turns (Z rotation)
                const bankAngle = -this.velocity.x * 0.05;
                this.mesh.rotation.z += (bankAngle - this.mesh.rotation.z) * 0.1;
            }
        }
    }

    const eagle = new ProceduralEagle();
    eagle.mesh.position.set(0, 0, 0);
    scene.add(eagle.mesh);

    // 4. Connect Physics Target to Scroll
    let scrollTargetY = 0;
    
    // Instead of timeline, we map scroll directly to physics target
    window.addEventListener('scroll', () => {
        const scrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        
        // Map scroll to 3D space
        // When scroll is 0, eagle is high up and far right
        // When scroll is 1, eagle is low down and close
        const targetX = 400 - (scrollPercent * 800); // 400 to -400
        const targetY = 200 - (scrollPercent * 400); // 200 to -200
        const targetZ = -200 + (scrollPercent * 500); // Fly towards camera

        eagle.target.set(targetX, targetY, targetZ);
    });

    // 5. Animation Loop
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const time = clock.getElapsedTime();
        
        eagle.update(time);
        
        // Add a gentle floating breeze to the target when not scrolling
        eagle.target.y += Math.sin(time) * 2;
        eagle.target.x += Math.cos(time * 0.5) * 1;
        
        renderer.render(scene, camera);
    }
    animate();

    // 6. Handle Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});
