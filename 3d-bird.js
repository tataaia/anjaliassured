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

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(0, 0, 500);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // 2. The Glass Material
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.05,
        transmission: 1.0, // This makes it look like glass!
        ior: 1.5,
        thickness: 0.5,
        transparent: true,
        opacity: 1
    });

    // 3. Load the 3D Bird
    let mixer;
    let birdModel;
    const loader = new THREE.GLTFLoader();
    
    loader.load('Stork.glb', (gltf) => {
        birdModel = gltf.scene;
        
        // Apply Glass Material to the bird meshes
        birdModel.traverse((child) => {
            if (child.isMesh) {
                child.material = glassMaterial;
            }
        });

        // Set initial scale and position
        birdModel.scale.set(1.5, 1.5, 1.5);
        birdModel.position.set(-300, 200, -100);
        birdModel.rotation.y = Math.PI / 4; // Face slightly right
        scene.add(birdModel);

        // Setup the Wing Flapping Animation
        mixer = new THREE.AnimationMixer(birdModel);
        if (gltf.animations && gltf.animations.length > 0) {
            // Play the first animation (flying)
            const action = mixer.clipAction(gltf.animations[0]);
            action.setEffectiveTimeScale(1.5); // Flap a bit faster
            action.play();
        }

        // Setup GSAP Scroll Path
        setupScrollAnimation(birdModel);

    }, undefined, (error) => {
        console.error("Error loading bird model:", error);
    });

    // GSAP ScrollTrigger path
    function setupScrollAnimation(model) {
        gsap.registerPlugin(ScrollTrigger);

        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: "body",
                start: "top top",
                end: "bottom bottom",
                scrub: 1.5 // Smooth catch-up
            }
        });

        // Path 1: Fly towards the center
        tl.to(model.position, { x: 0, y: 0, z: 200, duration: 1 }, 0)
          .to(model.rotation, { z: -Math.PI/6, x: Math.PI/8, duration: 1 }, 0); // Bank right
          
        // Path 2: Swoop down and left
        tl.to(model.position, { x: 300, y: -200, z: 50, duration: 1 }, 1)
          .to(model.rotation, { z: Math.PI/6, y: Math.PI/2, duration: 1 }, 1); // Bank left

        // Path 3: Dive deep into background
        tl.to(model.position, { x: -100, y: 100, z: -300, duration: 1 }, 2)
          .to(model.rotation, { z: 0, x: -Math.PI/4, duration: 1 }, 2);
    }

    // 4. Animation Loop
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        
        const delta = clock.getDelta();
        if (mixer) {
            mixer.update(delta); // Continuously flap wings!
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
