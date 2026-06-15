/**
 * 3D Bird Engine v3 — Multiple Autonomous Eagles
 * ────────────────────────────────────────────────
 * Based on real eagle aerodynamics research:
 * - Thermal soaring (circling), ridge soaring (gliding)
 * - Banking proportional to lateral velocity
 * - Landing = stall + wing spread + slow approach to ground
 * - Takeoff = powerful flapping burst upward
 * - Separation steering so birds never collide
 * - Scare response: birds fly AWAY (get smaller) then return
 * - Periodic eagle cry sounds
 */

document.addEventListener("DOMContentLoaded", () => {
  /* ─────────────────────────────────────────────
   * 1. SCENE, CAMERA, RENDERER
   * ───────────────────────────────────────────── */
  const canvas = document.getElementById("bird-canvas");
  if (!canvas) return;

  const scene = new THREE.Scene();
  // Soft sky-blue fog for depth
  scene.fog = new THREE.FogExp2(0xe8e4df, 0.0008);

  const camera = new THREE.PerspectiveCamera(
    55, window.innerWidth / window.innerHeight, 1, 8000
  );
  camera.position.set(0, 120, 900);
  camera.lookAt(0, 80, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.setClearColor(0x000000, 0);

  /* ─────────────────────────────────────────────
   * 2. LIGHTING
   * ───────────────────────────────────────────── */
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3d5c1e, 0.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
  sun.position.set(400, 600, 300);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc4e0ff, 0.5);
  fill.position.set(-300, -100, 400);
  scene.add(fill);

  /* ─────────────────────────────────────────────
   * 3. GREEN GROUND PLANE
   * ───────────────────────────────────────────── */
  const groundGeo = new THREE.PlaneGeometry(6000, 6000);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x4a7c2e });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -200;
  scene.add(ground);

  // Darker grass patches for texture
  for (let i = 0; i < 8; i++) {
    const patchGeo = new THREE.CircleGeometry(80 + Math.random() * 120, 16);
    const patchMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color().setHSL(0.28, 0.5 + Math.random() * 0.3, 0.2 + Math.random() * 0.15)
    });
    const patch = new THREE.Mesh(patchGeo, patchMat);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set((Math.random() - 0.5) * 3000, -199, (Math.random() - 0.5) * 2000);
    scene.add(patch);
  }

  /* ─────────────────────────────────────────────
   * 4. EAGLE SOUND SYSTEM
   * ───────────────────────────────────────────── */
  // We generate an eagle-like cry using Web Audio API oscillators
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  const playEagleCry = () => {
    // Create a sharp, descending screech
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.3);
    osc.frequency.exponentialRampToValueAtTime(2400, audioCtx.currentTime + 0.5);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.9);

    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.0);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 1.0);
  };

  // Play eagle cry every 15-40 seconds randomly
  const scheduleNextCry = () => {
    const delay = 15000 + Math.random() * 25000;
    setTimeout(() => {
      playEagleCry();
      scheduleNextCry();
    }, delay);
  };
  scheduleNextCry();

  /* ─────────────────────────────────────────────
   * 5. BIRD AI CLASS — Each bird has its own brain
   * ───────────────────────────────────────────── */
  const BIRD_STATES = {
    FLYING: 'flying',
    SOARING: 'soaring',    // circling/gliding
    LANDING: 'landing',
    GROUNDED: 'grounded',
    TAKEOFF: 'takeoff',
    SCARED: 'scared'
  };

  class BirdAI {
    constructor(id, waypointSet, startPos) {
      this.id = id;
      this.model = null;
      this.mixer = null;
      this.state = BIRD_STATES.FLYING;

      // Physics
      this.position = startPos.clone();
      this.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 3, 0.5, (Math.random() - 0.5) * 2
      );
      this.maxSpeed = 3.5 + Math.random() * 1.5; // Each bird slightly different speed
      this.maxForce = 0.08 + Math.random() * 0.04;

      // Waypoints — each bird has its OWN route
      this.waypoints = waypointSet;
      this.currentWP = 0;

      // Timers
      this.stateTimer = 0;
      this.groundTime = 0; // How long to stay grounded
      this.landingTarget = null;

      // Scare
      this.scareTarget = null;
      this.scareTimer = 0;

      // Soaring
      this.soarAngle = Math.random() * Math.PI * 2;
      this.soarCenter = new THREE.Vector3();
      this.soarRadius = 150 + Math.random() * 100;

      // Decision timer — birds make decisions periodically
      this.decisionTimer = 5 + Math.random() * 10;

      // Flap speed multiplier
      this.flapSpeed = 1.0;
    }

    setModel(model, animations) {
      this.model = model;
      this.model.position.copy(this.position);
      scene.add(this.model);

      if (animations && animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.model);
        animations.forEach(clip => {
          const action = this.mixer.clipAction(clip);
          action.play();
        });
      }
    }

    // Craig Reynolds SEEK
    seek(target) {
      const desired = new THREE.Vector3().subVectors(target, this.position);
      const dist = desired.length();
      let speed = this.maxSpeed;

      // Arrival slowdown
      if (dist < 80) speed = this.maxSpeed * (dist / 80);

      desired.normalize().multiplyScalar(speed);
      const steer = new THREE.Vector3().subVectors(desired, this.velocity);
      if (steer.length() > this.maxForce) steer.normalize().multiplyScalar(this.maxForce);
      return steer;
    }

    // Separation from other birds — avoid collisions
    separate(allBirds) {
      const desiredSep = 200;
      const steer = new THREE.Vector3();
      let count = 0;
      for (const other of allBirds) {
        if (other === this) continue;
        const d = this.position.distanceTo(other.position);
        if (d > 0 && d < desiredSep) {
          const diff = new THREE.Vector3().subVectors(this.position, other.position);
          diff.normalize().divideScalar(d);
          steer.add(diff);
          count++;
        }
      }
      if (count > 0) {
        steer.divideScalar(count);
        steer.normalize().multiplyScalar(this.maxSpeed);
        steer.sub(this.velocity);
        if (steer.length() > this.maxForce) steer.normalize().multiplyScalar(this.maxForce * 1.5);
      }
      return steer;
    }

    // Make autonomous decisions
    makeDecision() {
      if (this.state === BIRD_STATES.SCARED || this.state === BIRD_STATES.LANDING) return;

      const roll = Math.random();

      if (this.state === BIRD_STATES.GROUNDED) {
        // 70% chance to take off after ground time expires
        if (roll < 0.7) {
          this.state = BIRD_STATES.TAKEOFF;
          this.stateTimer = 2.0;
          this.flapSpeed = 2.5; // Fast flapping for takeoff
        }
        return;
      }

      if (this.state === BIRD_STATES.FLYING || this.state === BIRD_STATES.SOARING) {
        if (roll < 0.15) {
          // 15% chance to decide to land
          this.state = BIRD_STATES.LANDING;
          this.landingTarget = new THREE.Vector3(
            (Math.random() - 0.5) * 1500,
            -190, // Just above ground
            (Math.random() - 0.5) * 800
          );
          this.flapSpeed = 0.5; // Slow flapping for landing
        } else if (roll < 0.45) {
          // 30% chance to start thermal soaring (circling)
          this.state = BIRD_STATES.SOARING;
          this.soarCenter.copy(this.position);
          this.soarCenter.y = this.position.y + 50;
          this.soarAngle = Math.atan2(
            this.position.z - this.soarCenter.z,
            this.position.x - this.soarCenter.x
          );
          this.stateTimer = 8 + Math.random() * 12; // Soar for 8-20 seconds
          this.flapSpeed = 0.3; // Almost no flapping while soaring
        } else {
          // 55% chance: continue flying, advance waypoint
          this.state = BIRD_STATES.FLYING;
          this.currentWP = (this.currentWP + 1) % this.waypoints.length;
          this.flapSpeed = 1.0;
        }
      }
    }

    scare() {
      if (this.state === BIRD_STATES.SCARED) return;

      playEagleCry(); // Bird screeches when scared

      this.state = BIRD_STATES.SCARED;
      this.scareTimer = 4.0;
      this.flapSpeed = 3.0; // Frantic flapping

      // Fly AWAY — increase Z (move further from camera = smaller)
      const escapeDir = this.velocity.clone().normalize();
      if (escapeDir.lengthSq() < 0.01) {
        escapeDir.set(0, 1, 1).normalize();
      }
      // Mix in upward and backward direction
      escapeDir.y = Math.abs(escapeDir.y) + 0.5;
      escapeDir.z += 1.0; // Move further from camera
      escapeDir.normalize();

      this.scareTarget = this.position.clone().add(escapeDir.multiplyScalar(600));
      this.scareTarget.y = THREE.MathUtils.clamp(this.scareTarget.y, 0, 500);
      this.scareTarget.z = THREE.MathUtils.clamp(this.scareTarget.z, 200, 1500);

      // Boost current velocity
      this.velocity.multiplyScalar(2.0);
    }

    update(dt, allBirds) {
      if (!this.model) return;

      // Update animation mixer (wing flap speed)
      if (this.mixer) {
        this.mixer.update(dt * this.flapSpeed);
      }

      // Decision timer
      this.decisionTimer -= dt;
      if (this.decisionTimer <= 0) {
        this.makeDecision();
        this.decisionTimer = 6 + Math.random() * 15;
      }

      // State machine
      const steer = new THREE.Vector3();

      switch (this.state) {
        case BIRD_STATES.FLYING: {
          const wpTarget = this.waypoints[this.currentWP];
          steer.add(this.seek(wpTarget));
          steer.add(this.separate(allBirds));

          // Arrived at waypoint?
          if (this.position.distanceTo(wpTarget) < 60) {
            this.currentWP = (this.currentWP + 1) % this.waypoints.length;
          }
          this.flapSpeed = THREE.MathUtils.lerp(this.flapSpeed, 1.2, 0.02);
          break;
        }

        case BIRD_STATES.SOARING: {
          // Circular thermal soaring
          this.soarAngle += dt * 0.3; // Slow circle
          const soarTarget = new THREE.Vector3(
            this.soarCenter.x + Math.cos(this.soarAngle) * this.soarRadius,
            this.soarCenter.y + Math.sin(dt * 0.5) * 20,
            this.soarCenter.z + Math.sin(this.soarAngle) * this.soarRadius
          );
          steer.add(this.seek(soarTarget));
          steer.add(this.separate(allBirds));

          this.stateTimer -= dt;
          if (this.stateTimer <= 0) {
            this.state = BIRD_STATES.FLYING;
            this.flapSpeed = 1.0;
          }
          this.flapSpeed = THREE.MathUtils.lerp(this.flapSpeed, 0.3, 0.02);
          break;
        }

        case BIRD_STATES.LANDING: {
          steer.add(this.seek(this.landingTarget));
          this.flapSpeed = THREE.MathUtils.lerp(this.flapSpeed, 0.4, 0.03);

          // Slow down as approaching ground
          if (this.position.y < -150) {
            this.velocity.multiplyScalar(0.95);
          }
          if (this.position.y <= -185) {
            // Landed!
            this.state = BIRD_STATES.GROUNDED;
            this.velocity.set(0, 0, 0);
            this.position.y = -190;
            this.groundTime = 5 + Math.random() * 15; // Stay 5-20 seconds
            this.flapSpeed = 0.0; // Stop flapping
          }
          break;
        }

        case BIRD_STATES.GROUNDED: {
          this.velocity.set(0, 0, 0);
          this.groundTime -= dt;
          this.flapSpeed = THREE.MathUtils.lerp(this.flapSpeed, 0.0, 0.1);
          if (this.groundTime <= 0) {
            this.state = BIRD_STATES.TAKEOFF;
            this.stateTimer = 2.0;
            this.flapSpeed = 2.5;
          }
          break;
        }

        case BIRD_STATES.TAKEOFF: {
          // Powerful upward thrust
          this.velocity.y += 0.25;
          this.velocity.x += (Math.random() - 0.5) * 0.1;
          this.velocity.z += (Math.random() - 0.5) * 0.05;
          this.flapSpeed = THREE.MathUtils.lerp(this.flapSpeed, 2.5, 0.05);

          this.stateTimer -= dt;
          if (this.stateTimer <= 0 || this.position.y > 50) {
            this.state = BIRD_STATES.FLYING;
            this.flapSpeed = 1.2;
          }
          break;
        }

        case BIRD_STATES.SCARED: {
          steer.add(this.seek(this.scareTarget));
          this.flapSpeed = THREE.MathUtils.lerp(this.flapSpeed, 3.0, 0.05);
          this.scareTimer -= dt;
          if (this.scareTimer <= 0) {
            this.state = BIRD_STATES.FLYING;
            this.flapSpeed = 1.2;
          }
          break;
        }
      }

      // Apply steering
      this.velocity.add(steer);

      // Clamp speed (higher when scared)
      const currentMax = this.state === BIRD_STATES.SCARED ? this.maxSpeed * 2.5 : this.maxSpeed;
      if (this.velocity.length() > currentMax) {
        this.velocity.normalize().multiplyScalar(currentMax);
      }

      // Apply velocity
      this.position.add(this.velocity);

      // ── BOUNDARY ENFORCEMENT ──
      // Keep birds in a visible area but allow depth variation
      const bx = 700, byUp = 500, byDown = -195, bzMin = -200, bzMax = 1400;
      const push = 0.12;
      if (this.position.x > bx) this.velocity.x -= push;
      if (this.position.x < -bx) this.velocity.x += push;
      if (this.position.y > byUp) this.velocity.y -= push;
      if (this.state !== BIRD_STATES.LANDING && this.state !== BIRD_STATES.GROUNDED) {
        if (this.position.y < -100) this.velocity.y += push;
      }
      if (this.position.z > bzMax) this.velocity.z -= push;
      if (this.position.z < bzMin) this.velocity.z += push;

      // ── ORIENT BIRD ──
      this.model.position.copy(this.position);

      if (this.velocity.lengthSq() > 0.01 && this.state !== BIRD_STATES.GROUNDED) {
        const forward = this.velocity.clone().normalize();
        const lookTarget = this.position.clone().add(forward.multiplyScalar(200));
        this.model.lookAt(lookTarget);

        // Banking: roll proportional to lateral velocity
        const lateralRatio = THREE.MathUtils.clamp(this.velocity.x / this.maxSpeed, -1, 1);
        const bankAngle = -lateralRatio * Math.PI * 0.4;
        this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, bankAngle, 0.04);
      }
    }
  }

  /* ─────────────────────────────────────────────
   * 6. CREATE 4 BIRDS WITH UNIQUE ROUTES
   * ───────────────────────────────────────────── */

  // 4 unique waypoint circuits — no overlapping paths
  const routes = [
    // Bird 1: Wide left circuit, higher altitude
    [
      new THREE.Vector3(-500, 250, 400),
      new THREE.Vector3(-200, 300, 250),
      new THREE.Vector3(100, 200, 350),
      new THREE.Vector3(-100, 150, 500),
      new THREE.Vector3(-400, 100, 350),
      new THREE.Vector3(-350, 280, 200),
    ],
    // Bird 2: Right side circuit, mid altitude
    [
      new THREE.Vector3(400, 150, 300),
      new THREE.Vector3(250, 100, 450),
      new THREE.Vector3(500, 50, 350),
      new THREE.Vector3(350, 200, 200),
      new THREE.Vector3(150, 250, 350),
      new THREE.Vector3(300, 180, 500),
    ],
    // Bird 3: Center circuit, lower, closer to camera
    [
      new THREE.Vector3(0, 80, 200),
      new THREE.Vector3(200, 50, 300),
      new THREE.Vector3(100, 120, 150),
      new THREE.Vector3(-200, 70, 250),
      new THREE.Vector3(-100, 130, 350),
      new THREE.Vector3(50, 100, 200),
    ],
    // Bird 4: Far background circuit, high soaring
    [
      new THREE.Vector3(-300, 350, 600),
      new THREE.Vector3(200, 400, 700),
      new THREE.Vector3(400, 300, 550),
      new THREE.Vector3(100, 350, 800),
      new THREE.Vector3(-200, 280, 650),
      new THREE.Vector3(-400, 380, 750),
    ],
  ];

  const startPositions = [
    new THREE.Vector3(-400, 200, 400),
    new THREE.Vector3(350, 150, 350),
    new THREE.Vector3(0, 100, 250),
    new THREE.Vector3(-200, 350, 650),
  ];

  const birds = [];
  for (let i = 0; i < 4; i++) {
    birds.push(new BirdAI(i, routes[i], startPositions[i]));
  }

  /* ─────────────────────────────────────────────
   * 7. LOAD EAGLE MODEL & CLONE PROPERLY FOR EACH BIRD
   * Uses THREE.SkeletonUtils.clone() for correct skinned mesh cloning
   * ───────────────────────────────────────────── */
  const loader = new THREE.GLTFLoader();

  loader.load("eagle.glb", (gltf) => {
    const originalModel = gltf.scene;
    const animations = gltf.animations;

    birds.forEach((bird, idx) => {
      // SkeletonUtils.clone properly duplicates SkinnedMesh + Skeleton + Bones
      const clone = THREE.SkeletonUtils.clone(originalModel);
      clone.scale.set(0.25, 0.25, 0.25);

      // Ensure double-sided rendering
      clone.traverse(child => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
          child.material.side = THREE.DoubleSide;
        }
      });

      bird.setModel(clone, animations);
    });

    console.log("[3d-bird] 4 eagles loaded (SkeletonUtils), animations:", animations.length);
  }, undefined, (err) => {
    console.error("[3d-bird] Failed to load eagle.glb:", err);
  });

  /* ─────────────────────────────────────────────
   * 8. PARTICLE SYSTEMS
   * ───────────────────────────────────────────── */

  // Golden dust particles
  const dustCount = 150;
  const dustPos = new Float32Array(dustCount * 3);
  const dustVel = [];
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 1400;
    dustPos[i * 3 + 1] = Math.random() * 600 - 100;
    dustPos[i * 3 + 2] = Math.random() * 800;
    dustVel.push(new THREE.Vector3(
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.15,
      (Math.random() - 0.5) * 0.1
    ));
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xffd966, size: 3.5, transparent: true, opacity: 0.6,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });
  scene.add(new THREE.Points(dustGeo, dustMat));

  const updateDust = () => {
    const pos = dustGeo.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      pos[i * 3] += dustVel[i].x;
      pos[i * 3 + 1] += dustVel[i].y;
      pos[i * 3 + 2] += dustVel[i].z;
      if (pos[i * 3] > 700) pos[i * 3] = -700;
      if (pos[i * 3] < -700) pos[i * 3] = 700;
      if (pos[i * 3 + 1] > 500) pos[i * 3 + 1] = -100;
      if (pos[i * 3 + 1] < -100) pos[i * 3 + 1] = 500;
    }
    dustGeo.attributes.position.needsUpdate = true;
  };

  // Petals
  const petalCount = 40;
  const petalPos = new Float32Array(petalCount * 3);
  const petalVel = [];
  for (let i = 0; i < petalCount; i++) {
    petalPos[i * 3] = (Math.random() - 0.5) * 1400;
    petalPos[i * 3 + 1] = Math.random() * 700;
    petalPos[i * 3 + 2] = Math.random() * 600 + 50;
    petalVel.push({
      vx: 0.2 + Math.random() * 0.3,
      vy: -(0.15 + Math.random() * 0.25),
      wobble: Math.random() * Math.PI * 2,
      ws: 0.012 + Math.random() * 0.02
    });
  }
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute("position", new THREE.BufferAttribute(petalPos, 3));
  const petalMat = new THREE.PointsMaterial({
    color: 0xffb6c1, size: 5, transparent: true, opacity: 0.7,
    depthWrite: false, sizeAttenuation: true
  });
  scene.add(new THREE.Points(petalGeo, petalMat));

  const updatePetals = () => {
    const pos = petalGeo.attributes.position.array;
    for (let i = 0; i < petalCount; i++) {
      const s = petalVel[i];
      s.wobble += s.ws;
      pos[i * 3] += s.vx + Math.sin(s.wobble) * 0.4;
      pos[i * 3 + 1] += s.vy;
      if (pos[i * 3] > 750 || pos[i * 3 + 1] < -210) {
        pos[i * 3] = -750;
        pos[i * 3 + 1] = 400 + Math.random() * 200;
      }
    }
    petalGeo.attributes.position.needsUpdate = true;
  };

  /* ─────────────────────────────────────────────
   * 9. INTERACTIVE: SCARE ALL BIRDS
   * ───────────────────────────────────────────── */
  const scareAllBirds = () => {
    birds.forEach(b => b.scare());
  };

  const scareOnInteract = (e) => {
    const target = e.target;
    if (target.closest('.menu-button') || target.closest('.nav') ||
        target.closest('.menu') || target.closest('.header') ||
        target.closest('.osmo-ui') || target.closest('[data-menu-toggle]')) {
      return;
    }
    // Resume audio context on user gesture
    if (audioCtx.state === 'suspended') audioCtx.resume();
    scareAllBirds();
  };
  document.addEventListener("click", scareOnInteract);
  document.addEventListener("touchstart", scareOnInteract);

  // Microphone
  const setupMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let cooldown = 0;
      const check = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        cooldown -= 1 / 60;
        if (sum / data.length > 160 && cooldown <= 0) {
          scareAllBirds();
          cooldown = 5;
        }
        requestAnimationFrame(check);
      };
      check();
    } catch (e) {
      console.warn("[3d-bird] Mic unavailable:", e.message);
    }
  };
  setupMic();

  /* ─────────────────────────────────────────────
   * 10. RESIZE
   * ───────────────────────────────────────────── */
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ─────────────────────────────────────────────
   * 11. ANIMATION LOOP
   * ───────────────────────────────────────────── */
  const clock = new THREE.Clock();
  const animate = () => {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    // Update all birds
    birds.forEach(bird => bird.update(dt, birds));

    // Particles
    updateDust();
    updatePetals();

    renderer.render(scene, camera);
  };

  animate();
  console.log("[3d-bird] Multi-bird engine started — 4 autonomous eagles");
});
