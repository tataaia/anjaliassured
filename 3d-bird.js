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
    canvas.style.pointerEvents = 'none'; // Click through to fluid

    const scene = new THREE.Scene();

    // Enhanced Lighting to show the REAL colors of the bird perfectly
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); // Brighter ambient
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(200, 500, 300);
    scene.add(directionalLight);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(0, 0, 800);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding; // Crucial for real textures to look right
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Physics Engine Properties
    const physics = {
        velocity: new THREE.Vector3(0, 0, 0),
        acceleration: new THREE.Vector3(0, 0, 0),
        maxSpeed: 15,
        maxForce: 0.8,
        target: new THREE.Vector3(0, 0, 0)
    };

    // 2. Load the Real 3D Eagle GLB (Preserving Original Colors & Animations)
    let mixer;
    let birdModel;
    const loader = new THREE.GLTFLoader();
    
    loader.load('eagle.glb', (gltf) => {
        birdModel = gltf.scene;
        
        // We do NOT override the material anymore! 
        // We let the real eagle textures shine.
        birdModel.traverse((child) => {
            if (child.isMesh && child.material) {
                // Just ensure materials are double sided so feathers don't disappear from behind
                child.material.side = THREE.DoubleSide;
                child.material.needsUpdate = true;
            }
        });

        // Setup scale and position based on typical sizing
        // If the eagle is too big/small, these might need tweaking, but standard is 1.5
        birdModel.scale.set(3.0, 3.0, 3.0); // Made slightly larger for visibility
        birdModel.position.set(-300, 200, -100);
        birdModel.rotation.y = Math.PI / 4; 
        scene.add(birdModel);

        // Setup the Skeletal Animation (Fix for "No Life / Static Body")
        mixer = new THREE.AnimationMixer(birdModel);
        if (gltf.animations && gltf.animations.length > 0) {
            // Play ALL animations available in the file to guarantee the wings flap
            gltf.animations.forEach((clip) => {
                const action = mixer.clipAction(clip);
                action.setEffectiveTimeScale(1.5); // Faster, more lively flapping
                action.play();
            });
        } else {
            console.warn("No animations found in eagle.glb!");
        }

    }, undefined, (error) => {
        console.error("Error loading eagle.glb! Ensure the file is valid.", error);
    });

    // 3. Connect Physics Target to Scroll
    window.addEventListener('scroll', () => {
        const scrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        
        // Map scroll to 3D space target for the physics engine to chase
        const targetX = 600 - (scrollPercent * 1200); 
        const targetY = 300 - (scrollPercent * 600);  
        const targetZ = -400 + (scrollPercent * 800); 

        physics.target.set(targetX, targetY, targetZ);
    });

    // 4. Animation Loop
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();
        
        // Update Native 3D Animation (Flapping Wings)
        if (mixer) {
            mixer.update(delta);
        }
        
        // Update Flight Physics
        if (birdModel) {
            const desired = new THREE.Vector3().subVectors(physics.target, birdModel.position);
            const dist = desired.length();
            desired.normalize();
            
            if (dist < 150) {
                desired.multiplyScalar(physics.maxSpeed * (dist / 150));
            } else {
                desired.multiplyScalar(physics.maxSpeed);
            }

            const steer = new THREE.Vector3().subVectors(desired, physics.velocity);
            steer.clampLength(0, physics.maxForce);
            
            physics.acceleration.add(steer);
            physics.velocity.add(physics.acceleration);
            birdModel.position.add(physics.velocity);
            physics.acceleration.multiplyScalar(0);

            // Dynamic Banking
            if (physics.velocity.lengthSq() > 0.1) {
                const targetRotY = Math.atan2(physics.velocity.x, physics.velocity.z);
                const targetRotX = Math.atan2(-physics.velocity.y, Math.sqrt(physics.velocity.x*physics.velocity.x + physics.velocity.z*physics.velocity.z));
                
                birdModel.rotation.y += (targetRotY - birdModel.rotation.y) * 0.1;
                birdModel.rotation.x += (targetRotX - birdModel.rotation.x) * 0.1;

                const bankAngle = -physics.velocity.x * 0.05;
                birdModel.rotation.z += (bankAngle - birdModel.rotation.z) * 0.1;
            }
            
            // Add a gentle floating breeze to the body itself to give extra life
            physics.target.y += Math.sin(time * 3) * 2;
        }
        
        renderer.render(scene, camera);
    }
    animate();

    // 5. Handle Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});
