/**
 * 3D Bird Engine — Realistic Eagle Flight
 * ─────────────────────────────────────────
 * Loads eagle.glb via GLTFLoader (Three.js r128 CDN).
 * Implements Craig-Reynolds-style steering toward cinematic waypoints,
 * banking turns, particle effects (fireflies, snow, petals),
 * and microphone / click scare response.
 */

document.addEventListener("DOMContentLoaded", () => {
  /* ─────────────────────────────────────────────
   * 1. SCENE, CAMERA, RENDERER
   * ───────────────────────────────────────────── */
  const canvas = document.getElementById("bird-canvas");
  if (!canvas) {
    console.error("[3d-bird] #bird-canvas not found");
    return;
  }

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    1,
    5000
  );
  camera.position.set(0, 0, 1000);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setClearColor(0x000000, 0); // transparent background

  /* ─────────────────────────────────────────────
   * 2. LIGHTING — bright enough to show real textures
   * ───────────────────────────────────────────── */
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xffeeb1, 0x080820, 1.0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
  dirLight.position.set(300, 500, 400);
  dirLight.castShadow = false;
  scene.add(dirLight);

  // Secondary fill light from below-left to avoid harsh shadows
  const fillLight = new THREE.DirectionalLight(0xc4e0ff, 0.6);
  fillLight.position.set(-200, -100, 300);
  scene.add(fillLight);

  /* ─────────────────────────────────────────────
   * 3. EAGLE MODEL (eagle.glb)
   * ───────────────────────────────────────────── */
  let bird = null;
  let mixer = null;
  const clock = new THREE.Clock();

  const loader = new THREE.GLTFLoader();
  loader.load(
    "eagle.glb",
    (gltf) => {
      bird = gltf.scene;
      bird.scale.set(0.15, 0.15, 0.15);

      // Keep original materials, just ensure double-sided rendering
      bird.traverse((child) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material)
            ? child.material
            : [child.material];
          mats.forEach((mat) => {
            mat.side = THREE.DoubleSide;
          });
        }
      });

      scene.add(bird);

      // Play ALL animations (wing flap, etc.)
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(bird);
        gltf.animations.forEach((clip) => {
          const action = mixer.clipAction(clip);
          action.play();
        });
      }

      // Place bird at the first waypoint
      bird.position.copy(waypoints[0]);
      console.log("[3d-bird] Eagle loaded — animations:", gltf.animations.length);
    },
    undefined,
    (err) => console.error("[3d-bird] Failed to load eagle.glb:", err)
  );

  /* ─────────────────────────────────────────────
   * 4. CINEMATIC WAYPOINTS & FLIGHT PHYSICS
   * ───────────────────────────────────────────── */

  // Waypoints define a cinematic circuit.
  // x, y stay within roughly ±500 so the bird is visible.
  // z ranges 200-600 (distance from camera at z=1000 → appears 400-800 away).
  const waypoints = [
    new THREE.Vector3(-400, 200, 500),   // upper-left, mid depth
    new THREE.Vector3(100, 350, 350),    // upper-center, closer
    new THREE.Vector3(450, 150, 450),    // right, mid height
    new THREE.Vector3(350, -100, 250),   // right-low, close pass
    new THREE.Vector3(0, -250, 400),     // bottom-center, gentle dive
    new THREE.Vector3(-350, -150, 550),  // left-low, far
    new THREE.Vector3(-450, 100, 300),   // left, close banking turn
    new THREE.Vector3(-200, 300, 600),   // upper-left, far soaring
    new THREE.Vector3(250, 280, 350),    // upper-right, closer
    new THREE.Vector3(400, 0, 500),      // right-center, mid depth
  ];

  let currentWaypointIndex = 0;
  const velocity = new THREE.Vector3(0, 0, 0);
  const maxSpeed = 4.5;
  const maxForce = 0.12;
  const arrivalRadius = 60; // distance to consider "arrived"

  // Scare state
  let isScared = false;
  let scareTimer = 0;
  let scareTarget = null;

  /**
   * Craig Reynolds SEEK with ARRIVAL behaviour.
   * Returns a steering force vector toward the target.
   */
  const seek = (position, target) => {
    const desired = new THREE.Vector3().subVectors(target, position);
    const dist = desired.length();

    // Arrival: slow down when close
    let speed = maxSpeed;
    if (dist < arrivalRadius * 3) {
      speed = maxSpeed * (dist / (arrivalRadius * 3));
    }
    desired.normalize().multiplyScalar(speed);

    // Steering = desired - velocity
    const steer = new THREE.Vector3().subVectors(desired, velocity);
    if (steer.length() > maxForce) {
      steer.normalize().multiplyScalar(maxForce);
    }
    return steer;
  };

  /**
   * Update flight physics each frame.
   */
  const updateFlight = (dt) => {
    if (!bird) return;

    const target = isScared && scareTarget ? scareTarget : waypoints[currentWaypointIndex];

    // Steering
    const steer = seek(bird.position, target);
    velocity.add(steer);

    // Clamp speed
    if (velocity.length() > maxSpeed) {
      velocity.normalize().multiplyScalar(maxSpeed);
    }

    // Move bird
    bird.position.add(velocity);

    // ── Orient bird to face velocity direction ──
    if (velocity.lengthSq() > 0.001) {
      const forward = velocity.clone().normalize();
      const lookTarget = bird.position.clone().add(forward.multiplyScalar(100));
      bird.lookAt(lookTarget);

      // Banking: roll proportional to lateral (x) velocity
      const lateralRatio = THREE.MathUtils.clamp(velocity.x / maxSpeed, -1, 1);
      const bankAngle = -lateralRatio * Math.PI * 0.35; // max ±63°
      bird.rotation.z = THREE.MathUtils.lerp(bird.rotation.z, bankAngle, 0.05);
    }

    // ── Waypoint arrival check ──
    if (!isScared) {
      const dist = bird.position.distanceTo(waypoints[currentWaypointIndex]);
      if (dist < arrivalRadius) {
        currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.length;
      }
    }

    // ── Scare countdown ──
    if (isScared) {
      scareTimer -= dt;
      if (scareTimer <= 0) {
        isScared = false;
        scareTarget = null;
      }
    }

    // ── Boundary enforcement: softly push the bird back if it drifts out ──
    const bx = 600, by = 450, bzMin = 150, bzMax = 700;
    const pushStrength = 0.15;
    if (bird.position.x > bx) velocity.x -= pushStrength;
    if (bird.position.x < -bx) velocity.x += pushStrength;
    if (bird.position.y > by) velocity.y -= pushStrength;
    if (bird.position.y < -by) velocity.y += pushStrength;
    if (bird.position.z < bzMin) velocity.z += pushStrength;
    if (bird.position.z > bzMax) velocity.z -= pushStrength;
  };

  /* ─────────────────────────────────────────────
   * 5. PARTICLE SYSTEMS
   * ───────────────────────────────────────────── */

  // ── 5a. Firefly / magical dust particles ──
  const fireflyCount = 200;
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  const fireflySpeeds = []; // per-particle drift vectors
  for (let i = 0; i < fireflyCount; i++) {
    fireflyPositions[i * 3] = (Math.random() - 0.5) * 1200;
    fireflyPositions[i * 3 + 1] = (Math.random() - 0.5) * 800;
    fireflyPositions[i * 3 + 2] = Math.random() * 700;
    fireflySpeeds.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.15
      )
    );
  }
  const fireflyGeo = new THREE.BufferGeometry();
  fireflyGeo.setAttribute("position", new THREE.BufferAttribute(fireflyPositions, 3));

  const fireflyMat = new THREE.PointsMaterial({
    color: 0xffd966,
    size: 4,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const fireflyPoints = new THREE.Points(fireflyGeo, fireflyMat);
  scene.add(fireflyPoints);

  const updateFireflies = () => {
    const pos = fireflyGeo.attributes.position.array;
    for (let i = 0; i < fireflyCount; i++) {
      const s = fireflySpeeds[i];
      pos[i * 3] += s.x;
      pos[i * 3 + 1] += s.y;
      pos[i * 3 + 2] += s.z;

      // Wrap around
      if (pos[i * 3] > 600) pos[i * 3] = -600;
      if (pos[i * 3] < -600) pos[i * 3] = 600;
      if (pos[i * 3 + 1] > 400) pos[i * 3 + 1] = -400;
      if (pos[i * 3 + 1] < -400) pos[i * 3 + 1] = 400;
      if (pos[i * 3 + 2] > 700) pos[i * 3 + 2] = 0;
      if (pos[i * 3 + 2] < 0) pos[i * 3 + 2] = 700;
    }
    fireflyGeo.attributes.position.needsUpdate = true;
  };

  // ── 5b. Snow particles ──
  const snowCount = 300;
  const snowPositions = new Float32Array(snowCount * 3);
  const snowSpeeds = [];
  for (let i = 0; i < snowCount; i++) {
    snowPositions[i * 3] = (Math.random() - 0.5) * 1400;
    snowPositions[i * 3 + 1] = Math.random() * 900 - 200;
    snowPositions[i * 3 + 2] = Math.random() * 700;
    snowSpeeds.push({
      vy: -(0.3 + Math.random() * 0.5),           // fall speed
      vx: (Math.random() - 0.5) * 0.15,            // lateral drift
      wobble: Math.random() * Math.PI * 2,         // phase offset for wobble
      wobbleSpeed: 0.01 + Math.random() * 0.02,
    });
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPositions, 3));

  const snowMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 3,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const snowPoints = new THREE.Points(snowGeo, snowMat);
  scene.add(snowPoints);

  const updateSnow = () => {
    const pos = snowGeo.attributes.position.array;
    for (let i = 0; i < snowCount; i++) {
      const s = snowSpeeds[i];
      s.wobble += s.wobbleSpeed;

      pos[i * 3] += s.vx + Math.sin(s.wobble) * 0.2; // gentle lateral wobble
      pos[i * 3 + 1] += s.vy;

      // Reset when below screen
      if (pos[i * 3 + 1] < -500) {
        pos[i * 3] = (Math.random() - 0.5) * 1400;
        pos[i * 3 + 1] = 500 + Math.random() * 100;
        pos[i * 3 + 2] = Math.random() * 700;
      }
    }
    snowGeo.attributes.position.needsUpdate = true;
  };

  // ── 5c. Petal / flower particles ──
  const petalCount = 50;
  const petalPositions = new Float32Array(petalCount * 3);
  const petalSpeeds = [];
  for (let i = 0; i < petalCount; i++) {
    petalPositions[i * 3] = (Math.random() - 0.5) * 1400;
    petalPositions[i * 3 + 1] = Math.random() * 900 - 200;
    petalPositions[i * 3 + 2] = Math.random() * 600 + 50;
    petalSpeeds.push({
      vx: 0.3 + Math.random() * 0.4,   // drift rightward
      vy: -(0.2 + Math.random() * 0.3), // drift downward (diagonal)
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.015 + Math.random() * 0.02,
      wobbleAmp: 0.5 + Math.random() * 0.5,
    });
  }
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute("position", new THREE.BufferAttribute(petalPositions, 3));

  // Soft pink color with larger size
  const petalMat = new THREE.PointsMaterial({
    color: 0xffb6c1,
    size: 6,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const petalPoints = new THREE.Points(petalGeo, petalMat);
  scene.add(petalPoints);

  const updatePetals = () => {
    const pos = petalGeo.attributes.position.array;
    for (let i = 0; i < petalCount; i++) {
      const s = petalSpeeds[i];
      s.wobble += s.wobbleSpeed;

      pos[i * 3] += s.vx + Math.sin(s.wobble) * s.wobbleAmp;
      pos[i * 3 + 1] += s.vy + Math.cos(s.wobble) * 0.15;

      // Reset when out of bounds
      if (pos[i * 3] > 750 || pos[i * 3 + 1] < -500) {
        pos[i * 3] = -750;
        pos[i * 3 + 1] = 300 + Math.random() * 200;
        pos[i * 3 + 2] = Math.random() * 600 + 50;
      }
    }
    petalGeo.attributes.position.needsUpdate = true;
  };

  /* ─────────────────────────────────────────────
   * 6. INTERACTIVE SOUND & CLICK RESPONSE
   * ───────────────────────────────────────────── */

  /**
   * Trigger the "scared" state: bird flies to a far temporary waypoint.
   */
  const scareBird = () => {
    if (!bird || isScared) return;
    isScared = true;
    scareTimer = 3.0; // seconds

    // Pick a rapid escape direction opposite to current velocity, far away
    const escapeDir = velocity.clone().negate().normalize();
    if (escapeDir.lengthSq() < 0.01) {
      escapeDir.set(
        (Math.random() - 0.5) * 2,
        1,
        (Math.random() - 0.5) * 2
      ).normalize();
    }
    scareTarget = bird.position.clone().add(escapeDir.multiplyScalar(500));

    // Clamp scare target within reasonable bounds
    scareTarget.x = THREE.MathUtils.clamp(scareTarget.x, -600, 600);
    scareTarget.y = THREE.MathUtils.clamp(scareTarget.y, -400, 400);
    scareTarget.z = THREE.MathUtils.clamp(scareTarget.z, 150, 700);

    // Boost speed temporarily
    velocity.multiplyScalar(2.5);
  };

  // ── Microphone listener ──
  const setupMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const volumeThreshold = 180; // 0-255 scale
      let cooldown = 0;

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        // Average volume across frequency bins
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;

        cooldown -= 1 / 60;
        if (avg > volumeThreshold && cooldown <= 0) {
          scareBird();
          cooldown = 4; // don't re-trigger for 4 seconds
        }
        requestAnimationFrame(checkVolume);
      };
      checkVolume();
      console.log("[3d-bird] Microphone active");
    } catch (e) {
      console.warn("[3d-bird] Microphone access denied or unavailable:", e.message);
    }
  };
  setupMicrophone();

  // ── Click / touch listener ──
  // Only scare the bird if the click/touch is NOT on the navigation UI
  const scareOnInteract = (e) => {
    const target = e.target;
    if (target.closest('.menu-button') || target.closest('.nav') || 
        target.closest('.menu') || target.closest('.header') ||
        target.closest('.osmo-ui') || target.closest('[data-menu-toggle]')) {
      return; // Don't scare bird when interacting with UI
    }
    scareBird();
  };
  document.addEventListener("click", scareOnInteract);
  document.addEventListener("touchstart", scareOnInteract);

  /* ─────────────────────────────────────────────
   * 7. WINDOW RESIZE
   * ───────────────────────────────────────────── */
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ─────────────────────────────────────────────
   * 8. ANIMATION LOOP
   * ───────────────────────────────────────────── */
  const animate = () => {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();

    // Update wing-flap animations
    if (mixer) mixer.update(dt);

    // Update flight physics
    updateFlight(dt);

    // Update particles
    updateFireflies();
    updateSnow();
    updatePetals();

    // Render
    renderer.render(scene, camera);
  };

  animate();
  console.log("[3d-bird] Engine started");
});
