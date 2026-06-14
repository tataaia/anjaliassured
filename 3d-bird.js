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

    // Add ambient and directional light for the glass refractions
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
    directionalLight.position.set(200, 500, 300);
    scene.add(directionalLight);

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
        metalness: 0.1,
        roughness: 0.0,
        transmission: 1.0, // This makes it look like pure glass!
        ior: 1.5,
        thickness: 1.0,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide
    });

    // Physics Engine Properties
    const physics = {
        velocity: new THREE.Vector3(0, 0, 0),
        acceleration: new THREE.Vector3(0, 0, 0),
        maxSpeed: 15,
        maxForce: 0.8,
        target: new THREE.Vector3(0, 0, 0)
    };

    // 3. Load the Real 3D Eagle GLB
    let mixer;
    let birdModel;
    const loader = new THREE.GLTFLoader();
    
    // We are loading 'eagle.glb' - the user needs to provide a hyper-realistic model
    loader.load('eagle.glb', (gltf) => {
        birdModel = gltf.scene;
        
        // Apply Glass Material to whatever the model's meshes are
        birdModel.traverse((child) => {
            if (child.isMesh) {
                // Keep original UV maps but replace material with our refracting glass
                child.material = glassMaterial;
            }
        });

        // Set initial scale and position
        // Note: Different models have different scales, we adjust to make it fit
        birdModel.scale.set(1.5, 1.5, 1.5);
        birdModel.position.set(-300, 200, -100);
        birdModel.rotation.y = Math.PI / 4; 
        scene.add(birdModel);

        // Setup the Skeletal Animation (Wing Flapping)
        mixer = new THREE.AnimationMixer(birdModel);
        if (gltf.animations && gltf.animations.length > 0) {
            // Play the first animation (flying/flapping)
            const action = mixer.clipAction(gltf.animations[0]);
            action.setEffectiveTimeScale(1.2); 
            action.play();
        }

    }, undefined, (error) => {
        console.error("Error loading eagle.glb! Make sure the file exists in the directory.", error);
    });

    // 4. Connect Physics Target to Scroll
    window.addEventListener('scroll', () => {
        const scrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        
        // Map scroll to 3D space target for the physics engine to chase
        const targetX = 500 - (scrollPercent * 1000); 
        const targetY = 300 - (scrollPercent * 600);  
        const targetZ = -400 + (scrollPercent * 600); 

        physics.target.set(targetX, targetY, targetZ);
    });

    // 5. Animation Loop
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();
        
        // Update Native 3D Animation (Wings)
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
            
            // Add a gentle floating breeze to the target
            physics.target.y += Math.sin(time) * 2;
            physics.target.x += Math.cos(time * 0.5) * 1;
        }
        
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
