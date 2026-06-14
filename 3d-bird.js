document.addEventListener("DOMContentLoaded", () => {
    // 1. Scene Setup
    const canvas = document.getElementById('bird-canvas');
    if (!canvas) return;

    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '5'; // Above fluid, below text
    canvas.style.pointerEvents = 'none'; // Click through to fluid

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 3000);
    camera.position.set(0, 0, 800);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // 2. The Flapping Vertex Shader & Glass Fragment Shader
    const vertexShader = `
        uniform float time;
        varying vec2 vUv;

        void main() {
            vUv = uv;
            vec3 pos = position;
            
            // Distance from center of the image (the eagle's body)
            float distFromCenter = abs(uv.x - 0.5);
            
            // Flap parameters
            float flapAmplitude = 180.0; // How high/low wings go
            float flapSpeed = 4.5;
            
            // Phase offset creates a fluid wave (tips lag behind shoulders)
            float phaseOffset = distFromCenter * 3.0; 
            
            // Apply sine wave only to the wings (smoothstep ensures body stays still)
            float flap = sin(time * flapSpeed - phaseOffset) * flapAmplitude;
            pos.z += flap * smoothstep(0.05, 0.5, distFromCenter);
            
            // Add a gentle whole-body breathing/hovering effect
            pos.y += sin(time * 2.0) * 15.0;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `;

    const fragmentShader = `
        uniform sampler2D map;
        varying vec2 vUv;

        void main() {
            vec4 texColor = texture2D(map, vUv);
            
            // Boost brightness for the glass glow effect
            texColor.rgb *= 1.4; 
            
            // Fade out the very hard edges if necessary (optional)
            // But AdditiveBlending will handle the black background perfectly
            
            gl_FragColor = texColor;
        }
    `;

    // 3. Load the High-Res Image as a Texture
    const textureLoader = new THREE.TextureLoader();
    const uniforms = {
        time: { value: 0.0 },
        map: { value: null }
    };

    class ShaderEagle {
        constructor() {
            this.mesh = new THREE.Group();
            
            textureLoader.load('eagle.png', (texture) => {
                uniforms.map.value = texture;
                
                // Use a dense PlaneGeometry so it has enough vertices to bend smoothly
                // Image ratio adjustment (assuming standard 1:1 generation, adjust if needed)
                const geometry = new THREE.PlaneGeometry(600, 600, 64, 64);
                
                const material = new THREE.ShaderMaterial({
                    uniforms: uniforms,
                    vertexShader: vertexShader,
                    fragmentShader: fragmentShader,
                    transparent: true,
                    side: THREE.DoubleSide,
                    // AdditiveBlending perfectly removes the black background and brightens the glass
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });

                const eaglePlane = new THREE.Mesh(geometry, material);
                
                // Tilt it slightly forward so it looks like it's flying horizontally
                eaglePlane.rotation.x = -Math.PI / 6; 
                
                this.mesh.add(eaglePlane);
            });

            // Physics properties
            this.velocity = new THREE.Vector3(0, 0, 0);
            this.acceleration = new THREE.Vector3(0, 0, 0);
            this.maxSpeed = 15;
            this.maxForce = 0.6;
            this.target = new THREE.Vector3(0, 0, 0);
        }

        update() {
            // Flight Physics Engine (Steering behavior towards target)
            const desired = new THREE.Vector3().subVectors(this.target, this.mesh.position);
            const dist = desired.length();
            desired.normalize();
            
            // Arrive behavior (slow down as it gets close)
            if (dist < 150) {
                desired.multiplyScalar(this.maxSpeed * (dist / 150));
            } else {
                desired.multiplyScalar(this.maxSpeed);
            }

            const steer = new THREE.Vector3().subVectors(desired, this.velocity);
            steer.clampLength(0, this.maxForce);
            
            this.acceleration.add(steer);
            this.velocity.add(this.acceleration);
            this.mesh.position.add(this.velocity);
            this.acceleration.multiplyScalar(0); // Reset

            // Dynamic Banking & Rotation based on velocity
            if (this.velocity.lengthSq() > 0.1) {
                // Look toward movement direction (Y axis rotation)
                const targetRotY = Math.atan2(this.velocity.x, this.velocity.z);
                
                // Pitch up/down based on vertical velocity (X axis rotation)
                const horizontalVel = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
                const targetRotX = Math.atan2(-this.velocity.y, horizontalVel);
                
                // Smoothly interpolate rotations
                this.mesh.rotation.y += (targetRotY - this.mesh.rotation.y) * 0.08;
                this.mesh.rotation.x += (targetRotX - this.mesh.rotation.x) * 0.08;

                // Bank into turns (Z rotation) like a real bird/aircraft
                const bankAngle = -this.velocity.x * 0.05;
                this.mesh.rotation.z += (bankAngle - this.mesh.rotation.z) * 0.08;
            }
        }
    }

    const eagle = new ShaderEagle();
    eagle.mesh.position.set(0, 400, -200); // Start high up
    scene.add(eagle.mesh);

    // 4. Connect Physics Target to Scroll
    window.addEventListener('scroll', () => {
        // Calculate scroll percentage
        const scrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        
        // Map scroll percentage to a 3D target path
        // 0% = high up, far right
        // 50% = middle, swooping left
        // 100% = close to camera, diving down
        const targetX = 500 - (scrollPercent * 1000); // 500 to -500
        const targetY = 300 - (scrollPercent * 600);  // 300 to -300
        const targetZ = -400 + (scrollPercent * 600); // -400 to 200 (flies closer)

        eagle.target.set(targetX, targetY, targetZ);
    });

    // 5. Animation Loop
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const time = clock.getElapsedTime();
        
        // Update the shader time uniform so the wings flap
        uniforms.time.value = time;
        
        // Update physics and banking
        eagle.update();
        
        // Add a gentle wind breeze to the target when not scrolling
        eagle.target.y += Math.sin(time) * 3;
        eagle.target.x += Math.cos(time * 0.7) * 2;
        
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
