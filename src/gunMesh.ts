import * as THREE from 'three';

export function createGunMesh(skin: string = "default"): THREE.Group {
  const gunGroup = new THREE.Group();
  
  // Default colors
  let gunMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  let darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  let woodMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 }); // Optional wooden part color
  let scopeColor = 0x111111;

  // Godzilla Skin
  if (skin === "godzilla") {
    gunMat = new THREE.MeshStandardMaterial({ 
      color: 0x111b24, // Very dark teal/blue-black
      roughness: 0.6,
      metalness: 0.8
    });
    darkMat = new THREE.MeshStandardMaterial({ 
      color: 0x050a0f, // Almost black
      roughness: 0.8,
      metalness: 0.9
    });
    // Replace wood with glowing cyan
    woodMat = new THREE.MeshStandardMaterial({ 
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 1.0
    });
    scopeColor = 0x00ffff;
  }

  // Main Body
  const bodyGeom = new THREE.BoxGeometry(0.15, 0.25, 1.2);
  const body = new THREE.Mesh(bodyGeom, gunMat);
  body.position.set(0, 0, -0.2);
  gunGroup.add(body);

  // Barrel
  const barrelGeom = new THREE.BoxGeometry(0.08, 0.08, 1.2);
  const barrel = new THREE.Mesh(barrelGeom, darkMat);
  barrel.position.set(0, 0.05, -1.3);
  gunGroup.add(barrel);
  
  if (skin === "godzilla") {
    // Add godzilla spikes on top of the barrel, moved forward and lower so they don't block the scope
    const spikeGeom = new THREE.ConeGeometry(0.03, 0.15, 4);
    for(let i=0; i<3; i++) {
      const spike = new THREE.Mesh(spikeGeom, woodMat);
      spike.position.set(0, 0.10, -0.8 - i * 0.3);
      gunGroup.add(spike);
    }
    
    // Glowing side panels
    const panelGeom = new THREE.PlaneGeometry(0.05, 0.6);
    const leftPanel = new THREE.Mesh(panelGeom, woodMat);
    leftPanel.position.set(-0.076, 0.02, -0.2);
    leftPanel.rotation.y = -Math.PI / 2;
    gunGroup.add(leftPanel);
    
    const rightPanel = new THREE.Mesh(panelGeom, woodMat);
    rightPanel.position.set(0.076, 0.02, -0.2);
    rightPanel.rotation.y = Math.PI / 2;
    gunGroup.add(rightPanel);
  }

  // Muzzle Flash
  const flashGeom = new THREE.PlaneGeometry(0.6, 0.6);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const flash1 = new THREE.Mesh(flashGeom, flashMat);
  const flash2 = new THREE.Mesh(flashGeom, flashMat);
  flash2.rotation.x = Math.PI / 2;

  const muzzleFlash = new THREE.Group();
  muzzleFlash.add(flash1);
  muzzleFlash.add(flash2);
  muzzleFlash.position.set(0, 0.05, -2.0); // At the end of barrel
  muzzleFlash.visible = false;

  const flashLight = new THREE.PointLight(0xffaa00, 0, 5);
  flashLight.position.set(0, 0.05, -2.1);

  gunGroup.add(muzzleFlash);
  gunGroup.add(flashLight);

  gunGroup.userData.muzzleFlash = muzzleFlash;
  gunGroup.userData.flashLight = flashLight;
  gunGroup.userData.flashTimer = 0;

  // Magazine
  const magGeom = new THREE.BoxGeometry(0.1, 0.4, 0.25);
  const mag = new THREE.Mesh(magGeom, darkMat);
  mag.position.set(0, -0.25, -0.4);
  mag.rotation.x = 0.1;
  gunGroup.add(mag);

  // Grip/Handle
  const gripGeom = new THREE.BoxGeometry(0.12, 0.35, 0.2);
  const grip = new THREE.Mesh(gripGeom, gunMat);
  grip.position.set(0, -0.25, 0.2);
  grip.rotation.x = -0.2;
  gunGroup.add(grip);

  // Stock
  const stockGeom = new THREE.BoxGeometry(0.12, 0.25, 0.8);
  const stock = new THREE.Mesh(stockGeom, woodMat);
  stock.position.set(0, -0.05, 0.6);
  gunGroup.add(stock);

  // Scope Mount / Handle connecting scope to gun
  const scopeMountGeom = new THREE.BoxGeometry(0.04, 0.15, 0.2);
  const scopeMount = new THREE.Mesh(scopeMountGeom, darkMat);
  scopeMount.position.set(0, 0.15, -0.1);
  gunGroup.add(scopeMount);

  // Scope/Sight
  const scopeGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 16);
  const scope = new THREE.Mesh(scopeGeom, darkMat);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.22, -0.1);
  gunGroup.add(scope);
  
  if (skin === "godzilla") {
    // Add spikes around the scope
    const scopeSpikeGeom = new THREE.ConeGeometry(0.015, 0.08, 4);
    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(scopeSpikeGeom, woodMat);
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const radius = 0.07;
      spike.position.set(
        Math.cos(angle) * radius,
        0.22 + Math.sin(angle) * radius,
        -0.15
      );
      // Point the spikes outward
      spike.rotation.z = angle - Math.PI / 2;
      spike.rotation.x = -Math.PI / 6; // slightly tilt forward
      gunGroup.add(spike);
    }
  }

  return gunGroup;
}
