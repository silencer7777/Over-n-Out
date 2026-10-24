import * as THREE from 'three';

// Builds the arena: dusk-lit compound, perimeter walls, cover crates.
// Returns collision data + lists used by shooting / bot line-of-sight.
export function buildWorld(scene) {
  scene.background = new THREE.Color(0x111a26);
  scene.fog = new THREE.Fog(0x111a26, 40, 130);

  scene.add(new THREE.HemisphereLight(0x8fb4d8, 0x1c2417, 0.9));
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.6);
  sun.position.set(-30, 42, -18);
  scene.add(sun);

  // Stars
  {
    const n = 500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.15, r = 220;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe4ff, size: 0.9, fog: false })));
  }

  const colliders = [];   // THREE.Box3 list for movement collision
  const shootables = [];  // meshes the player's raycast can hit

  // Ground — concrete with a painted grid
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    const c = cv.getContext('2d');
    c.fillStyle = '#3a4149'; c.fillRect(0, 0, 512, 512);
    c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 512); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(512, i); c.stroke(); }
    c.fillStyle = 'rgba(57,255,106,0.10)'; c.beginPath(); c.arc(256, 256, 70, 0, Math.PI * 2); c.fill();
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(8, 8);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.name = 'ground';
    scene.add(ground); shootables.push(ground);
  }

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x55606c, roughness: 0.85 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x6d5a33, roughness: 0.9 });
  const crateMat2 = new THREE.MeshStandardMaterial({ color: 0x44586b, roughness: 0.9 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x707a86, roughness: 0.8, emissive: 0x0d2b16 });

  function solid(x, z, w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h / 2, z);
    scene.add(m); shootables.push(m);
    colliders.push(new THREE.Box3().setFromObject(m));
    return m;
  }

  // Perimeter (arena is 100 x 100, playable to ±48)
  solid(0, -50, 102, 7, 2, wallMat); solid(0, 50, 102, 7, 2, wallMat);
  solid(-50, 0, 2, 7, 102, wallMat); solid(50, 0, 2, 7, 102, wallMat);

  // Cover layout — crates, barriers, pillars (fixed layout = fair fights)
  const cover = [
    [-14, -10, 4, 2.2, 4], [14, -12, 4, 2.2, 4], [-22, 8, 5, 2.2, 2.4], [22, 10, 5, 2.2, 2.4],
    [0, -26, 6, 2.2, 3], [0, 26, 6, 2.2, 3], [-34, -26, 4, 4.4, 4], [34, -26, 4, 4.4, 4],
    [-34, 28, 4, 4.4, 4], [34, 28, 4, 4.4, 4], [-8, 14, 3, 2.2, 3], [9, -2, 3, 2.2, 3],
    [-16, -30, 3, 2.2, 3], [18, 30, 3, 2.2, 3], [0, 0, 3.2, 3.2, 3.2], [-26, -2, 2.4, 2.2, 6],
    [26, -4, 2.4, 2.2, 6], [-6, -16, 5, 1.1, 2], [7, 18, 5, 1.1, 2],
  ];
  cover.forEach(([x, z, w, h, d], i) => solid(x, z, w, h, d, i % 3 === 0 ? crateMat2 : crateMat));
  // Emissive pillars at the corners of mid
  [[-12, -22], [12, -22], [-12, 22], [12, 22]].forEach(([x, z]) => solid(x, z, 1.6, 5.5, 1.6, pillarMat));

  const spawnPoints = [
    new THREE.Vector3(-42, 0, -42), new THREE.Vector3(42, 0, -42),
    new THREE.Vector3(-42, 0, 42), new THREE.Vector3(42, 0, 42),
    new THREE.Vector3(0, 0, -44), new THREE.Vector3(0, 0, 44),
  ];

  return { colliders, shootables, spawnPoints, bounds: 47 };
}

// Push a point (with radius) out of every collider on the XZ plane.
export function collide(pos, radius, colliders, bounds) {
  pos.x = Math.max(-bounds + radius, Math.min(bounds - radius, pos.x));
  pos.z = Math.max(-bounds + radius, Math.min(bounds - radius, pos.z));
  for (const b of colliders) {
    const nx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
    const nz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Center inside the box: push out along the smallest penetration axis (XZ only)
        const pl = pos.x - b.min.x, pr = b.max.x - pos.x, pb = pos.z - b.min.z, pf = b.max.z - pos.z;
        const m = Math.min(pl, pr, pb, pf);
        if (m === pl) pos.x = b.min.x - radius; else if (m === pr) pos.x = b.max.x + radius;
        else if (m === pb) pos.z = b.min.z - radius; else pos.z = b.max.z + radius;
      }
    }
  }
}
