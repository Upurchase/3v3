import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { createGunMesh } from "../gunMesh";

interface GunThumbnailProps {
  skin: string;
}

export const GunThumbnail: React.FC<GunThumbnailProps> = ({ skin }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(2, 0.5, 2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
    
    const fillLight = new THREE.DirectionalLight(0xaaccff, 0.4);
    fillLight.position.set(-5, 0, -5);
    scene.add(fillLight);

    // Gun
    const gun = createGunMesh(skin);
    
    // Center the gun
    const box = new THREE.Box3().setFromObject(gun);
    const center = box.getCenter(new THREE.Vector3());
    gun.position.sub(center); // Center the geometry

    // Angle it slightly
    gun.rotation.y = -Math.PI / 4;
    gun.rotation.x = Math.PI / 12;

    scene.add(gun);

    renderer.render(scene, camera);

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.render(scene, camera);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [skin]);

  return <div ref={mountRef} className="w-full h-full pointer-events-none" />;
};
