/**
 * 3D Bird Engine v5 — Premium Autonomous Eagles
 * ────────────────────────────────────────────────
 * - Mobile Optimized: Dynamically adjusts boundaries, particle counts, and scales for phones
 * - Smooth quaternion flight interpolation (no sudden turns)
 * - 120 dynamic waypoint nodes covering all viewport corners (100+ path variations)
 * - Smaller ground with procedural light/dark green grass texture & 3D low-poly grass tufts
 * - Dynamic cuckoo/koyal voice synthesis (Web Audio API sine sweeps)
 * - Scare panic alarm sound and custom escape behavior (zooms back and downsized)
 * - SkeletonUtils.clone() for animation compatibility
 */

document.addEventListener("DOMContentLoaded", () => {
  /* ─────────────────────────────────────────────
   * 1. SCENE, CAMERA, RENDERER
   * ───────────────────────────────────────────── */
  const canvas = document.getElementById("bird-canvas");
  if (!canvas) return;

  const isMobile = window.innerWidth < 768;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xe8e4df, isMobile ? 0.001 : 0.0006);

  const camera = new THREE.PerspectiveCamera(
    isMobile ? 60 : 50, // Wider FOV on mobile
    window.innerWidth / window.innerHeight, 
    1, 
    8000
  );
  camera.position.set(0, isMobile ? 60 : 80, isMobile ? 800 : 950);
  camera.lookAt(0, 30, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.setClearColor(0x000000, 0);

  /* ─────────────────────────────────────────────
   * 2. LIGHTING
   * ───────────────────────────────────────────── */
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x4a7c2e, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
  sun.position.set(300, 600, 200);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc4e0ff, 0.6);
  fill.position.set(-300, -50, 400);
  scene.add(fill);

  /* ─────────────────────────────────────────────
   * 3. PROCEDURAL GRASS GROUND & 3D TUFTS
   * ───────────────────────────────────────────── */
  const groundSize = isMobile ? 1200 : 1800;
  const groundY = isMobile ? -230 : -270; // Positioned lower to cover less vertical screen area

  // Procedural Canvas Grass Texture
  const grassCanvas = document.createElement("canvas");
  grassCanvas.width = 256;
  grassCanvas.height = 256;
  const ctx = grassCanvas.getContext("2d");
  
  // Base dark green field color
  ctx.fillStyle = "#2d4d1e";
  ctx.fillRect(0, 0, 256, 256);
  
  // Paint 12,000 fine grass blades in light and dark green tones
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const len = 4 + Math.random() * 6;
    const angle = (Math.random() - 0.5) * 0.25;
    
    ctx.strokeStyle = Math.random() > 0.45 ? "#5c8c43" : "#7fb85d"; // Light/medium grass greens
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(angle) * len, y - len);
    ctx.stroke();
  }

  const grassTexture = new THREE.CanvasTexture(grassCanvas);
  grassTexture.wrapS = THREE.RepeatWrapping;
  grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(10, 10);

  const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
  const groundMat = new THREE.MeshLambertMaterial({ 
    map: grassTexture,
    roughness: 0.9
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = groundY;
  scene.add(ground);

  // Scatter low-poly 3D grass blades
  const grassGroup = new THREE.Group();
  scene.add(grassGroup);

  const bladeGeo = new THREE.ConeGeometry(1.0, 14, 3);
  bladeGeo.translate(0, 7, 0); // Origin at base

  const grassCount = isMobile ? 80 : 220;
  for (let i = 0; i < grassCount; i++) {
    const bladeMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color().setHSL(0.24 + Math.random() * 0.08, 0.65, 0.22 + Math.random() * 0.2)
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    const gx = (Math.random() - 0.5) * (groundSize - 150);
    const gz = (Math.random() - 0.5) * (groundSize - 150);
    
    blade.position.set(gx, groundY - 1, gz);
    const scale = 0.4 + Math.random() * 0.7;
    blade.scale.set(scale, scale, scale);
    blade.rotation.x = (Math.random() - 0.5) * 0.35;
    blade.rotation.z = (Math.random() - 0.5) * 0.35;
    blade.rotation.y = Math.random() * Math.PI;
    
    grassGroup.add(blade);
  }

  /* ─────────────────────────────────────────────
   * 4. MELODIOUS BIRD SOUND SYSTEM (KOYAL)
   * ───────────────────────────────────────────── */
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Gentle, sweet cuckoo "ku-oo..."
  const playKoyalCall = () => {
    if (audioCtx.state === 'suspended') return;
    const now = audioCtx.currentTime;

    // First syllable "ku"
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(620, now);
    osc1.frequency.exponentialRampToValueAtTime(800, now + 0.16);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.06, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc1.start(now);
    osc1.stop(now + 0.16);

    // Second syllable "oo" (slightly higher, longer)
    const start2 = now + 0.13;
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(780, start2);
    osc2.frequency.exponentialRampToValueAtTime(920, start2 + 0.24);

    gain2.gain.setValueAtTime(0.001, start2);
    gain2.gain.linearRampToValueAtTime(0.07, start2 + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, start2 + 0.26);

    osc2.start(start2);
    osc2.stop(start2 + 0.26);
  };

  // High-pitched scared alarm chirps
  const playPanicChirp = () => {
    if (audioCtx.state === 'suspended') return;
    const now = audioCtx.currentTime;

    for (let i = 0; i < 3; i++) {
      const offset = now + i * 0.12;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, offset);
      osc.frequency.exponentialRampToValueAtTime(750, offset + 0.1);

      gain.gain.setValueAtTime(0.001, offset);
      gain.gain.linearRampToValueAtTime(0.05, offset + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, offset + 0.1);

      osc.start(offset);
      osc.stop(offset + 0.1);
    }
  };

  // Play natural koyal call periodically
  const scheduleNextKoyal = () => {
    const delay = 12000 + Math.random() * 18000;
    setTimeout(() => {
      playKoyalCall();
      scheduleNextKoyal();
    }, delay);
  };
  scheduleNextKoyal();

  /* ─────────────────────────────────────────────
   * 5. 120 WAYPOINTS (COVERING ALL CORNERS)
   * ───────────────────────────────────────────── */
  const waypointPool = [];
  const quads = [
    { minX: -550, maxX: -200, minY: 150, maxY: 380, minZ: 100, maxZ: 700 }, // Top-Left
    { minX: 200, maxX: 550, minY: 150, maxY: 380, minZ: 100, maxZ: 700 },  // Top-Right
    { minX: -550, maxX: -200, minY: -50, maxY: 100, minZ: 100, maxZ: 700 }, // Bottom-Left
    { minX: 200, maxX: 550, minY: -50, maxY: 100, minZ: 100, maxZ: 700 },  // Bottom-Right
    { minX: -150, maxX: 150, minY: 220, maxY: 400, minZ: 150, maxZ: 600 },  // Center-High
    { minX: -180, maxX: 180, minY: -60, maxY: 80, minZ: 200, maxZ: 500 }   // Center-Low
  ];

  // Adjust coordinates for mobile viewports to keep birds in frame
  const scaleX = isMobile ? 0.45 : 1.0;
  const scaleY = isMobile ? 0.75 : 1.0;
  const scaleZ = isMobile ? 0.65 : 1.0;

  for (let i = 0; i < 120; i++) {
    const q = quads[i % quads.length];
    waypointPool.push(new THREE.Vector3(
      (q.minX + Math.random() * (q.maxX - q.minX)) * scaleX,
      (q.minY + Math.random() * (q.maxY - q.minY)) * scaleY,
      (q.minZ + Math.random() * (q.maxZ - q.minZ)) * scaleZ
    ));
  }

  /* ─────────────────────────────────────────────
   * 6. BIRD AI BRAIN CLASS
   * ───────────────────────────────────────────── */
  const BIRD_STATES = {
    FLYING: 'flying',
    SOARING: 'soaring',
    LANDING: 'landing',
    GROUNDED: 'grounded',
    TAKEOFF: 'takeoff',
    SCARED: 'scared'
  };

  class BirdAI {
    constructor(id, startPos) {
      this.id = id;
      this.model = null;
      this.mixer = null;
      this.action = null;
      this.state = BIRD_STATES.FLYING;

      // Physics
      this.position = startPos.clone();
      this.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2, 0.4, (Math.random() - 0.5) * 2
      );
      this.maxSpeed = (isMobile ? 2.5 : 3.2) + Math.random() * 0.8;
      this.maxForce = (isMobile ? 0.04 : 0.05) + Math.random() * 0.02;

      // Routes (quadrant shuffled for full screen coverage)
      this.waypoints = [];
      this.currentWP = 0;
      this.generateNewPath();

      // Timers & State Properties
      this.stateTimer = 0;
      this.groundTime = 0;
      this.landingTarget = null;
      this.scareTarget = null;
      this.scareTimer = 0;

      // Soaring state settings
      this.soarAngle = Math.random() * Math.PI * 2;
      this.soarCenter = new THREE.Vector3();
      this.soarRadius = (isMobile ? 80 : 140) + Math.random() * 60;

      this.decisionTimer = 4 + Math.random() * 8;
    }

    generateNewPath() {
      const pathPoints = [];
      const quadIndices = [0, 1, 2, 3, 4, 5];
      // Shuffle quadrants
      for (let i = quadIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [quadIndices[i], quadIndices[j]] = [quadIndices[j], quadIndices[i]];
      }
      // Pick waypoint from each quadrant
      for (let i = 0; i < 6; i++) {
        const qIdx = quadIndices[i];
        const candidates = waypointPool.filter((wp, idx) => idx % 6 === qIdx);
        const pt = candidates[Math.floor(Math.random() * candidates.length)];
        pathPoints.push(pt.clone());
      }
      this.waypoints = pathPoints;
      this.currentWP = 0;
    }

    setModel(model, animations) {
      this.model = model;
      this.model.position.copy(this.position);
      scene.add(this.model);

      if (animations && animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.model);
        // Play Take 001
        this.action = this.mixer.clipAction(animations[0]);
        this.action.play();
      }
    }

    seek(target) {
      const desired = new THREE.Vector3().subVectors(target, this.position);
      const dist = desired.length();
      let speed = this.maxSpeed;
      if (dist < 80) speed = this.maxSpeed * (dist / 80);

      desired.normalize().multiplyScalar(speed);
      const steer = new THREE.Vector3().subVectors(desired, this.velocity);
      if (steer.length() > this.maxForce) steer.normalize().multiplyScalar(this.maxForce);
      return steer;
    }

    separate(allBirds) {
      const minDistance = isMobile ? 120 : 220;
      const steer = new THREE.Vector3();
      let count = 0;
      for (const other of allBirds) {
        if (other === this) continue;
        const d = this.position.distanceTo(other.position);
        if (d > 0 && d < minDistance) {
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
        if (steer.length() > this.maxForce) steer.normalize().multiplyScalar(this.maxForce * 1.4);
      }
      return steer;
    }

    makeDecision() {
      if (this.state === BIRD_STATES.SCARED || this.state === BIRD_STATES.LANDING) return;

      const roll = Math.random();

      if (this.state === BIRD_STATES.GROUNDED) {
        if (roll < 0.8) {
          this.state = BIRD_STATES.TAKEOFF;
          this.stateTimer = 2.2;
        }
        return;
      }

      if (this.state === BIRD_STATES.FLYING || this.state === BIRD_STATES.SOARING) {
        if (roll < 0.12) {
          // Select landing position on green grass ground
          this.state = BIRD_STATES.LANDING;
          this.landingTarget = new THREE.Vector3(
            (Math.random() - 0.5) * (groundSize - 200),
            groundY + (isMobile ? 8 : 12),
            (Math.random() - 0.5) * (groundSize - 200)
          );
        } else if (roll < 0.38) {
          // Soaring glide circle
          this.state = BIRD_STATES.SOARING;
          this.soarCenter.copy(this.position);
          this.soarCenter.y = THREE.MathUtils.clamp(this.position.y + 40, isMobile ? 60 : 100, isMobile ? 250 : 350);
          this.soarAngle = Math.atan2(
            this.position.z - this.soarCenter.z,
            this.position.x - this.soarCenter.x
          );
          this.stateTimer = 5 + Math.random() * 8;
        } else {
          this.state = BIRD_STATES.FLYING;
          this.generateNewPath();
        }
      }
    }

    scare() {
      if (this.state === BIRD_STATES.SCARED) return;

      playPanicChirp();

      this.state = BIRD_STATES.SCARED;
      this.scareTimer = 3.0;

      // Fly back and up (shrinking size / zooming away)
      const scareVector = new THREE.Vector3(
        (Math.random() - 0.5) * (isMobile ? 250 : 500),
        (isMobile ? 200 : 280) + Math.random() * 100,
        (isMobile ? 650 : 900) + Math.random() * 300 // Zoom further back into space
      );
      this.scareTarget = scareVector;
      this.velocity.multiplyScalar(2.0);
    }

    update(dt, allBirds) {
      if (!this.model) return;

      // Dynamic Animation Blending & Wing Flap Control
      let targetTimeScale = 1.0;
      let pauseAnimation = false;

      // AI Logic Update
      this.decisionTimer -= dt;
      if (this.decisionTimer <= 0) {
        this.makeDecision();
        this.decisionTimer = 5 + Math.random() * 8;
      }

      const steer = new THREE.Vector3();

      switch (this.state) {
        case BIRD_STATES.FLYING:
          const wpTarget = this.waypoints[this.currentWP];
          steer.add(this.seek(wpTarget));
          steer.add(this.separate(allBirds));

          if (this.position.distanceTo(wpTarget) < (isMobile ? 45 : 70)) {
            this.currentWP++;
            if (this.currentWP >= this.waypoints.length) {
              this.generateNewPath();
            }
          }
          targetTimeScale = 1.1;
          break;

        case BIRD_STATES.SOARING:
          // Circular soaring path
          this.soarAngle += dt * 0.32;
          const soarWP = new THREE.Vector3(
            this.soarCenter.x + Math.cos(this.soarAngle) * this.soarRadius,
            this.soarCenter.y + Math.sin(dt * 0.4) * 12,
            this.soarCenter.z + Math.sin(this.soarAngle) * this.soarRadius
          );
          steer.add(this.seek(soarWP));
          steer.add(this.separate(allBirds));

          this.stateTimer -= dt;
          if (this.stateTimer <= 0) {
            this.state = BIRD_STATES.FLYING;
          }
          targetTimeScale = 0.12; // Slow wings open glide
          break;

        case BIRD_STATES.LANDING:
          steer.add(this.seek(this.landingTarget));
          
          if (this.position.y < groundY + 80) {
            this.velocity.multiplyScalar(0.95); // Decelerate on landing approach
            targetTimeScale = 0.25; // spread wings for landing stall
          } else {
            targetTimeScale = 0.65;
          }

          if (this.position.y <= groundY + (isMobile ? 9 : 13)) {
            this.state = BIRD_STATES.GROUNDED;
            this.velocity.set(0, 0, 0);
            this.position.y = groundY + (isMobile ? 8 : 12);
            this.groundTime = 3 + Math.random() * 6;
          }
          break;

        case BIRD_STATES.GROUNDED:
          this.velocity.set(0, 0, 0);
          this.groundTime -= dt;
          pauseAnimation = true; // Fold wings on ground
          if (this.groundTime <= 0) {
            this.state = BIRD_STATES.TAKEOFF;
            this.stateTimer = 1.8;
          }
          break;

        case BIRD_STATES.TAKEOFF:
          // Lift upward rapidly
          this.velocity.y += 0.28;
          this.velocity.x += (Math.random() - 0.5) * 0.12;
          targetTimeScale = 2.4; // High frequency takeoff flap

          this.stateTimer -= dt;
          if (this.stateTimer <= 0 || this.position.y > 40) {
            this.state = BIRD_STATES.FLYING;
          }
          break;

        case BIRD_STATES.SCARED:
          steer.add(this.seek(this.scareTarget));
          targetTimeScale = 2.8; // Frantic panic flaps
          this.scareTimer -= dt;
          if (this.scareTimer <= 0) {
            this.state = BIRD_STATES.FLYING;
            this.generateNewPath();
          }
          break;
      }

      // Physics Integration
      this.velocity.add(steer);

      const maxSpeedClamp = this.state === BIRD_STATES.SCARED ? this.maxSpeed * 2.0 : this.maxSpeed;
      if (this.velocity.length() > maxSpeedClamp) {
        this.velocity.normalize().multiplyScalar(maxSpeedClamp);
      }

      // Prevent flying backwards relative to camera setup
      if (this.state !== BIRD_STATES.GROUNDED && this.velocity.length() < (isMobile ? 1.2 : 1.8)) {
        this.velocity.normalize().multiplyScalar(isMobile ? 1.2 : 1.8);
      }

      this.position.add(this.velocity);

      // ── MOBILE VIEWPORT BOUNDARY ENFORCEMENT ──
      const bx = isMobile ? 260 : 650;
      const byUp = isMobile ? 320 : 450;
      const bzMin = isMobile ? 120 : 50;
      const bzMax = isMobile ? 750 : 1300;
      const push = 0.14;

      if (this.position.x > bx) this.velocity.x -= push;
      if (this.position.x < -bx) this.velocity.x += push;
      if (this.position.y > byUp) this.velocity.y -= push;
      
      if (this.state !== BIRD_STATES.LANDING && this.state !== BIRD_STATES.GROUNDED) {
        if (this.position.y < groundY + 80) this.velocity.y += push;
      }
      if (this.position.z > bzMax) this.velocity.z -= push;
      if (this.position.z < bzMin) this.velocity.z += push;

      // ── SMOOTH ROTATION INTERPOLATION (SLERP) ──
      this.model.position.copy(this.position);

      if (this.velocity.lengthSq() > 0.01 && this.state !== BIRD_STATES.GROUNDED) {
        const dummy = new THREE.Object3D();
        dummy.position.copy(this.position);
        
        const forward = this.velocity.clone().normalize();
        const lookTarget = this.position.clone().add(forward);
        dummy.lookAt(lookTarget);

        // Apply banking roll angle based on turn velocity
        const lateralRatio = THREE.MathUtils.clamp(this.velocity.x / this.maxSpeed, -1, 1);
        const bankAngle = -lateralRatio * Math.PI * 0.35;
        dummy.rotateZ(bankAngle);

        this.model.quaternion.slerp(dummy.quaternion, 0.08); // Smooth turn transition
      }

      // Update mixer timeScale smoothly
      if (this.mixer) {
        if (pauseAnimation) {
          this.action.paused = true;
          this.action.time = 0; // Neutral wings folded frame
        } else {
          this.action.paused = false;
          this.mixer.update(dt * targetTimeScale);
        }
      }
    }
  }

  /* ─────────────────────────────────────────────
   * 7. SPAWN BIRDS IN VISIBLE CAMERA RANGE
   * ───────────────────────────────────────────── */
  const startPositions = isMobile ? [
    new THREE.Vector3(-180, 120, 400),
    new THREE.Vector3(180, 100, 380),
    new THREE.Vector3(-80, 150, 450),
    new THREE.Vector3(80, 160, 320)
  ] : [
    new THREE.Vector3(-450, 180, 450),
    new THREE.Vector3(450, 150, 400),
    new THREE.Vector3(-150, 220, 500),
    new THREE.Vector3(150, 250, 350)
  ];

  const birds = [];
  for (let i = 0; i < 4; i++) {
    birds.push(new BirdAI(i, startPositions[i]));
  }

  // Load Eagle GLTF
  const loader = new THREE.GLTFLoader();
  loader.load("eagle.glb", (gltf) => {
    const originalModel = gltf.scene;
    const animations = gltf.animations;

    birds.forEach((bird, idx) => {
      // Use SkeletonUtils to clone bones/animation weights correctly
      const clone = THREE.SkeletonUtils.clone(originalModel);
      clone.scale.set(isMobile ? 0.16 : 0.24, isMobile ? 0.16 : 0.24, isMobile ? 0.16 : 0.24); // Scale down slightly on mobile

      // Keep original model colors & set DoubleSide
      clone.traverse(child => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
          child.material.side = THREE.DoubleSide;
        }
      });

      bird.setModel(clone, animations);
    });

    console.log("[3d-bird] 4 eagles loaded successfully");
  }, undefined, (err) => {
    console.error("[3d-bird] Load error eagle.glb:", err);
  });

  /* ─────────────────────────────────────────────
   * 8. MAGICAL PARTICLES SYSTEM
   * ───────────────────────────────────────────── */
  const dustCount = isMobile ? 40 : 120;
  const dustPos = new Float32Array(dustCount * 3);
  const dustVel = [];
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * (isMobile ? 600 : 1400);
    dustPos[i * 3 + 1] = Math.random() * (isMobile ? 350 : 500) - 100;
    dustPos[i * 3 + 2] = Math.random() * (isMobile ? 500 : 800);
    dustVel.push(new THREE.Vector3(
      (Math.random() - 0.5) * 0.15,
      (Math.random() - 0.5) * 0.12,
      (Math.random() - 0.5) * 0.08
    ));
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xffd966, size: isMobile ? 2.5 : 3.2, transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });
  scene.add(new THREE.Points(dustGeo, dustMat));

  const updateDust = () => {
    const pos = dustGeo.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      pos[i * 3] += dustVel[i].x;
      pos[i * 3 + 1] += dustVel[i].y;
      pos[i * 3 + 2] += dustVel[i].z;
      if (pos[i * 3] > (isMobile ? 350 : 700)) pos[i * 3] = isMobile ? -350 : -700;
      if (pos[i * 3] < (isMobile ? -350 : -700)) pos[i * 3] = isMobile ? 350 : 700;
      if (pos[i * 3 + 1] > (isMobile ? 350 : 450)) pos[i * 3 + 1] = -100;
      if (pos[i * 3 + 1] < -100) pos[i * 3 + 1] = isMobile ? 350 : 450;
    }
    dustGeo.attributes.position.needsUpdate = true;
  };

  // Flying flower petals
  const petalCount = isMobile ? 12 : 35;
  const petalPos = new Float32Array(petalCount * 3);
  const petalVel = [];
  for (let i = 0; i < petalCount; i++) {
    petalPos[i * 3] = (Math.random() - 0.5) * (isMobile ? 600 : 1400);
    petalPos[i * 3 + 1] = Math.random() * (isMobile ? 400 : 600);
    petalPos[i * 3 + 2] = Math.random() * 600 + 50;
    petalVel.push({
      vx: 0.15 + Math.random() * 0.25,
      vy: -(0.12 + Math.random() * 0.2),
      wobble: Math.random() * Math.PI * 2,
      ws: 0.01 + Math.random() * 0.015
    });
  }
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute("position", new THREE.BufferAttribute(petalPos, 3));
  const petalMat = new THREE.PointsMaterial({
    color: 0xffb6c1, size: isMobile ? 3.5 : 4.5, transparent: true, opacity: 0.65,
    depthWrite: false, sizeAttenuation: true
  });
  scene.add(new THREE.Points(petalGeo, petalMat));

  const updatePetals = () => {
    const pos = petalGeo.attributes.position.array;
    for (let i = 0; i < petalCount; i++) {
      const s = petalVel[i];
      s.wobble += s.ws;
      pos[i * 3] += s.vx + Math.sin(s.wobble) * 0.35;
      pos[i * 3 + 1] += s.vy;
      if (pos[i * 3] > (isMobile ? 400 : 750) || pos[i * 3 + 1] < groundY) {
        pos[i * 3] = isMobile ? -400 : -750;
        pos[i * 3 + 1] = (isMobile ? 300 : 400) + Math.random() * 150;
      }
    }
    petalGeo.attributes.position.needsUpdate = true;
  };

  /* ─────────────────────────────────────────────
   * 9. INTERACTIVE SCARE SYSTEM
   * ───────────────────────────────────────────── */
  const scareAllBirds = () => {
    birds.forEach(b => b.scare());
  };

  const scareOnInteract = (e) => {
    const target = e.target;
    // Don't trigger scare on clicking menus or UI buttons
    if (target.closest('.menu-button') || target.closest('.nav') ||
        target.closest('.menu') || target.closest('.header') ||
        target.closest('.osmo-ui') || target.closest('[data-menu-toggle]')) {
      return;
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    scareAllBirds();
  };
  document.addEventListener("click", scareOnInteract);
  document.addEventListener("touchstart", scareOnInteract);

  // Microphonic voice triggers
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
        if (sum / data.length > 155 && cooldown <= 0) {
          scareAllBirds();
          cooldown = 4.5;
        }
        requestAnimationFrame(check);
      };
      check();
    } catch (e) {
      console.warn("[3d-bird] Mic scare listener inactive:", e.message);
    }
  };
  // Avoid auto microphone requesting on mobile immediately to keep loading clean
  if (!isMobile) {
    setupMic();
  }

  /* ─────────────────────────────────────────────
   * 10. RESIZE HANDLER
   * ───────────────────────────────────────────── */
  window.addEventListener("resize", () => {
    const isMobileNow = window.innerWidth < 768;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = isMobileNow ? 60 : 50;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ─────────────────────────────────────────────
   * 11. MAIN ENGINE LOOP
   * ───────────────────────────────────────────── */
  const clock = new THREE.Clock();
  const animate = () => {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    birds.forEach(bird => bird.update(dt, birds));
    updateDust();
    updatePetals();

    renderer.render(scene, camera);
  };

  animate();
  console.log("[3d-bird] Premium Multi-Eagle engine running.");
});
