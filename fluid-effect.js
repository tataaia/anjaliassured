// Ultra-Premium Three.js WebGL Hologram and Organic Glass Phoenix
// Optimized for maximum visibility and realistic organic flight physics (waving wings)

(function () {
    const canvas = document.getElementById('fluid-canvas');
    if (!canvas) return;

    if (typeof THREE === 'undefined') {
        setTimeout(arguments.callee, 100);
        return;
    }

    // --- Shader Source for Highly Visible Iridescent Glass ---
    const vertexShader = `
        uniform float uTime;
        uniform vec2 uMouse;
        uniform float uNoiseFreq;
        uniform float uNoiseAmp;
        uniform float uScrollFactor;
        
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;
        varying vec2 vMatcapUV;

        // 3D Simplex Noise by Ian McEwan
        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
        
        float snoise(vec3 v){ 
            const vec2 C = vec2(1.0/6.0, 1.0/3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy));
            vec3 x0 = v - i + dot(i, C.xxx);
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min(g.xyz, l.zxy);
            vec3 i2 = max(g.xyz, l.zxy);
            vec3 x1 = x0 - i1 + 1.0 * C.xxx;
            vec3 x2 = x0 - i2 + 2.0 * C.xxx;
            vec3 x3 = x0 - D.yyy;
            i = mod(i, 289.0); 
            vec4 p = permute(permute(permute( 
                        i.z + vec4(0.0, i1.z, i2.z, 1.0))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0)) 
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
            float n_ = 1.0/7.0;
            vec3 ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_);
            vec4 x = x_ * ns.x + ns.yyyy;
            vec4 y = y_ * ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4(x.xy, y.xy);
            vec4 b1 = vec4(x.zw, y.zw);
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
            vec3 p0 = vec3(a0.xy, h.x);
            vec3 p1 = vec3(a0.zw, h.y);
            vec3 p2 = vec3(a1.xy, h.z);
            vec3 p3 = vec3(a1.zw, h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        void main() {
            vNormal = normalize(normalMatrix * normal);
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            
            vec3 noisePos = position * uNoiseFreq + vec3(0.0, uTime * 0.15, uTime * 0.1);
            float noiseVal = snoise(noisePos);
            
            float distToMouse = distance(position.xy, vec2(uMouse.x * 3.0, uMouse.y * 3.0));
            float mouseRipple = sin(distToMouse * 5.0 - uTime * 4.0) * smoothstep(4.0, 0.0, distToMouse) * 0.5;
            
            vec3 displaced = position + normal * (noiseVal * uNoiseAmp + mouseRipple);
            vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
            vViewDir = normalize(-mvPosition.xyz);
            
            vec3 r = reflect(normalize(mvPosition.xyz), vNormal);
            float m = 2.0 * sqrt(pow(r.x, 2.0) + pow(r.y, 2.0) + pow(r.z + 1.0, 2.0));
            vMatcapUV = r.xy / m + 0.5;

            gl_Position = projectionMatrix * mvPosition;
        }
    `;

    const fragmentShader = `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;
        varying vec2 vMatcapUV;
        uniform float uTime;
        
        void main() {
            vec3 normalVec = normalize(vNormal);
            vec3 viewVec = normalize(vViewDir);
            
            float fresnel = pow(1.0 - max(dot(normalVec, viewVec), 0.0), 2.2); // Stronger fresnel
            
            // Specular highlights
            float spec = smoothstep(0.28, 0.01, distance(vMatcapUV, vec2(0.75, 0.75))) * 0.95;
            
            // Vibrant glass gradients (Pink, Cyan, Magenta, Purple)
            vec3 colorPink = vec3(0.98, 0.4, 0.85);
            vec3 colorCyan = vec3(0.25, 0.88, 0.98);
            vec3 colorViolet = vec3(0.6, 0.35, 0.95);
            vec3 colorMagenta = vec3(0.95, 0.2, 0.75);
            
            float colorWave = sin(uTime * 0.2 + vWorldPos.x * 0.35) * 0.5 + 0.5;
            
            vec3 baseColor = mix(colorViolet, colorCyan, vMatcapUV.x);
            baseColor = mix(baseColor, colorPink, colorWave);
            baseColor = mix(baseColor, colorMagenta, fresnel);
            
            // Brighter composition for higher visibility
            vec3 finalColor = baseColor * 1.1 + vec3(spec) * 0.9;
            finalColor += vec3(1.0) * fresnel * 1.2; // Extra bright glass rim glow
            
            float alpha = smoothstep(0.01, 0.85, fresnel * 0.9 + 0.25); // Higher base opacity
            
            gl_FragColor = vec4(finalColor, alpha);
        }
    `;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 9.5;

    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    let time = 0;
    const mouse = new THREE.Vector2(0, 0);
    const targetMouse = new THREE.Vector2(0, 0);
    let scrollPercent = 0;

    window.addEventListener('mousemove', (e) => {
        targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }, { passive: true });

    window.addEventListener('scroll', () => {
        const h = document.documentElement;
        const b = document.body;
        const st = 'scrollTop';
        const sh = 'scrollHeight';
        scrollPercent = (h[st] || b[st]) / ((h[sh] || b[sh]) - h.clientHeight);
    }, { passive: true });

    // --- Custom Shader Material ---
    const hologramMaterial = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uMouse: { value: new THREE.Vector2(0, 0) },
            uNoiseFreq: { value: 0.3 },
            uNoiseAmp: { value: 0.7 },
            uScrollFactor: { value: 0 }
        },
        transparent: true,
        side: THREE.DoubleSide
    });

    // --- Center Liquid Blob ---
    const blobGeometry = new THREE.SphereGeometry(3.2, 80, 80);
    const blobMesh = new THREE.Mesh(blobGeometry, hologramMaterial);
    scene.add(blobMesh);

    // --- Highly Visible Glass Phoenix Model ---
    const phoenixGroup = new THREE.Group();

    // High brightness, high transmission physical material
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        roughness: 0.02,
        metalness: 0.1,
        transmission: 0.98,
        ior: 1.6, // Higher refraction index (more glassy)
        thickness: 2.5,
        flatShading: false,
        side: THREE.DoubleSide
    });

    // Internal glow lights tracking the phoenix closely
    const lightPink = new THREE.PointLight(0xff00bb, 6.0, 15);
    scene.add(lightPink);
    const lightCyan = new THREE.PointLight(0x00f0ff, 6.0, 15);
    scene.add(lightCyan);

    // Body: Sleek organic teardrop
    const bodyGeom = new THREE.SphereGeometry(0.38, 32, 32);
    bodyGeom.scale(1.0, 0.9, 3.5);
    const bodyMesh = new THREE.Mesh(bodyGeom, glassMaterial);
    phoenixGroup.add(bodyMesh);

    // Elegant curved neck
    const neckGeom = new THREE.SphereGeometry(0.24, 32, 32);
    neckGeom.scale(1.0, 1.4, 1.0);
    const neckMesh = new THREE.Mesh(neckGeom, glassMaterial);
    neckMesh.position.set(0, 0.25, 0.65);
    neckMesh.rotation.x = -0.3;
    phoenixGroup.add(neckMesh);

    // Head
    const headGeom = new THREE.SphereGeometry(0.25, 32, 32);
    const headMesh = new THREE.Mesh(headGeom, glassMaterial);
    headMesh.position.set(0, 0.45, 0.9);
    phoenixGroup.add(headMesh);

    // Beak
    const beakGeom = new THREE.ConeGeometry(0.06, 0.35, 16);
    beakGeom.rotateX(Math.PI / 2 + 0.2);
    const beakMesh = new THREE.Mesh(beakGeom, glassMaterial);
    beakMesh.position.set(0, 0.4, 1.15);
    phoenixGroup.add(beakMesh);

    // --- Organic Waving Wings (using plane geometry to bend in vertex calculations) ---
    const wingSegments = 32;
    const wingGeom = new THREE.PlaneGeometry(2.0, 0.8, wingSegments, wingSegments);
    
    // Position wings relative to pivots
    wingGeom.translate(-1.0, 0, 0); // Rotate around joint
    
    const leftWingPivot = new THREE.Group();
    leftWingPivot.position.set(-0.25, 0.1, 0.2);
    const leftWingMesh = new THREE.Mesh(wingGeom, glassMaterial);
    leftWingMesh.rotation.x = Math.PI / 2;
    leftWingPivot.add(leftWingMesh);
    phoenixGroup.add(leftWingPivot);

    const rightWingPivot = new THREE.Group();
    rightWingPivot.position.set(0.25, 0.1, 0.2);
    const rightWingMesh = new THREE.Mesh(wingGeom, glassMaterial);
    rightWingMesh.scale.x = -1; // Flip horizontally
    rightWingMesh.rotation.x = Math.PI / 2;
    rightWingPivot.add(rightWingMesh);
    phoenixGroup.add(rightWingPivot);

    // Sweeping tail ribbons
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0, -0.9);
    
    const tailGeom = new THREE.PlaneGeometry(0.2, 1.8, 8, 32);
    tailGeom.translate(0, -0.9, 0);
    tailGeom.rotateX(Math.PI / 2);

    const tail1 = new THREE.Mesh(tailGeom, glassMaterial);
    tailPivot.add(tail1);

    const tail2 = tail1.clone();
    tail2.position.set(-0.2, -0.05, 0);
    tail2.rotation.z = 0.15;
    tailPivot.add(tail2);

    const tail3 = tail1.clone();
    tail3.position.set(0.2, -0.05, 0);
    tail3.rotation.z = -0.15;
    tailPivot.add(tail3);

    phoenixGroup.add(tailPivot);

    // Scaling: 1.85x size for high visibility
    phoenixGroup.scale.set(1.85, 1.85, 1.85);
    scene.add(phoenixGroup);

    // --- Star Particles ---
    const starCount = 280;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starSpeeds = [];

    for (let i = 0; i < starCount; i++) {
        starPositions[i * 3] = (Math.random() - 0.5) * 18;
        starPositions[i * 3 + 1] = (Math.random() - 0.5) * 13;
        starPositions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2;

        starSpeeds.push({
            x: (Math.random() - 0.5) * 0.005,
            y: (Math.random() - 0.5) * 0.005 + 0.004,
            z: Math.random() * 0.005
        });
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const pCanvas = document.createElement('canvas');
    pCanvas.width = 16;
    pCanvas.height = 16;
    const pCtx = pCanvas.getContext('2d');
    const grad = pCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(235, 120, 255, 0.7)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    pCtx.fillStyle = grad;
    pCtx.arc(8, 8, 8, 0, Math.PI * 2);
    pCtx.fill();

    const starParticles = new THREE.Points(starGeometry, new THREE.PointsMaterial({
        size: 0.18,
        map: new THREE.CanvasTexture(pCanvas),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    }));
    scene.add(starParticles);

    // --- Spark Trail ---
    const trailLength = 45;
    const trailGeometry = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(trailLength * 3);
    const trailHistory = [];

    for (let i = 0; i < trailLength; i++) {
        trailHistory.push(new THREE.Vector3(0, 0, 0));
        trailPositions[i * 3] = 0;
        trailPositions[i * 3 + 1] = 0;
        trailPositions[i * 3 + 2] = 0;
    }

    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));

    const trailCanvas = document.createElement('canvas');
    trailCanvas.width = 16;
    trailCanvas.height = 16;
    const tCtx = trailCanvas.getContext('2d');
    const tGrad = tCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
    tGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    tGrad.addColorStop(0.4, 'rgba(0, 240, 255, 0.8)');
    tGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    tCtx.fillStyle = tGrad;
    tCtx.arc(8, 8, 8, 0, Math.PI * 2);
    tCtx.fill();

    const phoenixTrail = new THREE.Points(trailGeometry, new THREE.PointsMaterial({
        size: 0.28,
        map: new THREE.CanvasTexture(trailCanvas),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    }));
    scene.add(phoenixTrail);

    // --- Resize Handler ---
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // --- Flight Loop Physics variables ---
    let birdAngle = 0;
    const birdTargetPos = new THREE.Vector3(0, 0, 0);
    const birdCurrentPos = new THREE.Vector3(0, 0, 1.5);

    // --- Animation Loop ---
    function animate() {
        requestAnimationFrame(animate);

        time += 0.028;

        mouse.x += (targetMouse.x - mouse.x) * 0.07;
        mouse.y += (targetMouse.y - mouse.y) * 0.07;

        hologramMaterial.uniforms.uTime.value = time;
        hologramMaterial.uniforms.uMouse.value.copy(mouse);
        hologramMaterial.uniforms.uScrollFactor.value = scrollPercent;

        // Position lights inside/around the phoenix
        lightPink.position.x = birdCurrentPos.x + Math.sin(time * 2.0) * 1.5;
        lightPink.position.y = birdCurrentPos.y + Math.cos(time * 2.0) * 1.5;
        lightPink.position.z = birdCurrentPos.z + Math.cos(time) * 1.0;

        lightCyan.position.x = birdCurrentPos.x - Math.sin(time * 2.0) * 1.5;
        lightCyan.position.y = birdCurrentPos.y - Math.cos(time * 2.0) * 1.5;
        lightCyan.position.z = birdCurrentPos.z - Math.cos(time) * 1.0;

        // Animate Liquid Blob
        blobMesh.rotation.y = time * 0.1 + scrollPercent * 2.0;
        blobMesh.rotation.x = time * 0.05;
        
        const currentScale = 3.3 + Math.sin(time * 0.5) * 0.1 - scrollPercent * 0.8;
        blobMesh.scale.set(currentScale / 3.3, currentScale / 3.3, currentScale / 3.3);
        blobMesh.position.x = mouse.x * 0.9;
        blobMesh.position.y = Math.sin(time * 0.35) * 0.2 + mouse.y * 0.5 - scrollPercent * 1.0;

        // --- Realistic Waving Wing Flaps (Sine wave deformation along vertices) ---
        const flapRate = 12.0 + scrollPercent * 6.0;
        const leftWingPosArr = leftWingMesh.geometry.attributes.position.array;
        const rightWingPosArr = rightWingMesh.geometry.attributes.position.array;
        
        // Deform vertices along X to simulate organic bending/flapping wave
        for (let i = 0; i <= wingSegments; i++) {
            for (let j = 0; j <= wingSegments; j++) {
                const index = (i * (wingSegments + 1) + j) * 3;
                
                // Position X coordinate is the distance from the wing joint (0 to -2.0)
                const xVal = leftWingPosArr[index];
                
                // Sine wave flapping: larger movement at wingtips (high absolute X)
                const wave = Math.sin(time * flapRate + xVal * 1.8) * Math.abs(xVal) * 0.22;
                
                leftWingPosArr[index + 2] = wave; // Displace Z axis
                rightWingPosArr[index + 2] = wave;
            }
        }
        leftWingMesh.geometry.attributes.position.needsUpdate = true;
        rightWingMesh.geometry.attributes.position.needsUpdate = true;

        // Ripple waving tail feathers
        const tailPosArr = tail1.geometry.attributes.position.array;
        for (let i = 0; i < tailPosArr.length / 3; i++) {
            const yVal = tailPosArr[i * 3 + 1]; // Length along tail
            const wave = Math.sin(time * 6.0 + yVal * 2.5) * Math.abs(yVal) * 0.1;
            tailPosArr[i * 3 + 2] = wave;
        }
        tail1.geometry.attributes.position.needsUpdate = true;
        
        // Flight calculations
        birdAngle += 0.014 + scrollPercent * 0.01;
        const radiusX = (4.0 - scrollPercent * 1.6) + mouse.x * 1.5;
        const radiusY = (2.1 - scrollPercent * 0.8) + mouse.y * 1.0;

        birdTargetPos.x = Math.cos(birdAngle) * radiusX + mouse.x * 1.2;
        birdTargetPos.y = Math.sin(birdAngle * 1.5) * radiusY + mouse.y * 1.0 - scrollPercent * 4.5;
        birdTargetPos.z = 1.2 + Math.cos(birdAngle * 2.0) * 1.2 - scrollPercent * 2.0;

        birdCurrentPos.lerp(birdTargetPos, 0.04);
        phoenixGroup.position.copy(birdCurrentPos);

        const flightHeading = new THREE.Vector3(
            -Math.sin(birdAngle) * radiusX,
            Math.cos(birdAngle * 1.5) * 1.5 * radiusY,
            -Math.sin(birdAngle * 2.0) * 2.4
        ).normalize();

        const targetLook = birdCurrentPos.clone().add(flightHeading);
        phoenixGroup.lookAt(targetLook);
        phoenixGroup.rotateY(Math.PI);

        // Update trail
        trailHistory.pop();
        trailHistory.unshift(birdCurrentPos.clone().add(flightHeading.clone().multiplyScalar(-0.6)));

        const trailArr = phoenixTrail.geometry.attributes.position.array;
        for (let i = 0; i < trailLength; i++) {
            trailArr[i * 3] = trailHistory[i].x;
            trailArr[i * 3 + 1] = trailHistory[i].y;
            trailArr[i * 3 + 2] = trailHistory[i].z;
        }
        phoenixTrail.geometry.attributes.position.needsUpdate = true;

        // Stardust
        const starArr = starGeometry.attributes.position.array;
        for (let i = 0; i < starCount; i++) {
            const speedMultiplier = 1.0 + scrollPercent * 3.5;
            starArr[i * 3] += starSpeeds[i].x * speedMultiplier;
            starArr[i * 3 + 1] += starSpeeds[i].y * speedMultiplier;
            starArr[i * 3 + 2] += starSpeeds[i].z * speedMultiplier;

            if (starArr[i * 3 + 1] > 6.5) {
                starArr[i * 3 + 1] = -6.5;
                starArr[i * 3] = (Math.random() - 0.5) * 18;
            }
            if (Math.abs(starArr[i * 3]) > 11) {
                starArr[i * 3] = (Math.random() - 0.5) * 18;
            }
        }
        starGeometry.attributes.position.needsUpdate = true;
        starParticles.rotation.y = time * 0.015;

        // Camera parallax
        camera.position.x += (mouse.x * 1.5 - camera.position.x) * 0.05;
        camera.position.y += (mouse.y * 1.0 - camera.position.y) * 0.05 - scrollPercent * 2.0;
        camera.lookAt(0, -scrollPercent * 2.0, 0);

        renderer.render(scene, camera);
    }

    animate();

    // --- Storytelling Scroll Section Transitions ---
    document.addEventListener('DOMContentLoaded', () => {
        const sections = document.querySelectorAll('.hero, .section, .about-section, .blog-header, footer');
        
        const observerOptions = {
            root: null,
            threshold: 0.18,
            rootMargin: "0px 0px -100px 0px"
        };

        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('story-visible');
                    entry.target.classList.remove('story-exit');
                } else {
                    if (entry.boundingClientRect.top < 0) {
                        entry.target.classList.add('story-exit');
                    } else {
                        entry.target.classList.remove('story-exit');
                    }
                    entry.target.classList.remove('story-visible');
                }
            });
        }, observerOptions);

        sections.forEach(section => {
            sectionObserver.observe(section);
        });
    });

})();
