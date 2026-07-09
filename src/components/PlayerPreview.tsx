import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { createGunMesh } from "../gunMesh";

interface PlayerPreviewProps {
  skin: string;
  teamColor?: number;
}

function generateClothesTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 256, 256);
  // Add some camouflage/fabric pattern
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)";
    ctx.fillRect(
      Math.random() * 256,
      Math.random() * 256,
      Math.random() * 40 + 10,
      Math.random() * 40 + 10,
    );
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const clothesTexture = generateClothesTexture();

function createCharacterMesh(teamColor: number): THREE.Mesh {
  const hitboxGeom = new THREE.BoxGeometry(1.5, 3.2, 1.5);
  const invisibleMat = new THREE.MeshBasicMaterial({ visible: false });
  const parentMesh = new THREE.Mesh(hitboxGeom, invisibleMat);

  const skinColor = 0xffccbb;
  const darkColor = 0x333333;

  const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
  const clothesMat = new THREE.MeshLambertMaterial({
    color: teamColor,
    map: clothesTexture,
  });
  const darkMat = new THREE.MeshLambertMaterial({
    color: darkColor,
    map: clothesTexture,
  });

  // Head
  const headGeom = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  const head = new THREE.Mesh(headGeom, skinMat);
  head.position.set(0, 1.1, 0);
  head.rotation.set(-0.2, -0.15, 0);

  const eyeGeom = new THREE.BoxGeometry(0.15, 0.15, 0.1);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
  leftEye.position.set(-0.2, 0.1, -0.401);
  const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
  rightEye.position.set(0.2, 0.1, -0.401);
  head.add(leftEye);
  head.add(rightEye);
  
  parentMesh.add(head);

  // Torso
  const torsoGeom = new THREE.BoxGeometry(1.0, 1.2, 0.5);
  const torso = new THREE.Mesh(torsoGeom, clothesMat);
  torso.position.set(0, 0.1, 0);
  parentMesh.add(torso);

  // Arms (pivot at shoulders)
  const armGeom = new THREE.BoxGeometry(0.4, 1.2, 0.4);
  armGeom.translate(0, -0.6, 0);

  const leftArm = new THREE.Mesh(armGeom, skinMat);
  leftArm.position.set(-0.65, 0.6, 0);
  leftArm.rotation.set(1.23, -0.78, 0);
  parentMesh.add(leftArm);

  const rightArm = new THREE.Mesh(armGeom, skinMat);
  rightArm.position.set(0.65, 0.6, 0);
  rightArm.rotation.set(1.22, 0.42, 0);
  parentMesh.add(rightArm);

  // Legs (pivot at hips)
  const legGeom = new THREE.BoxGeometry(0.45, 1.0, 0.45);
  legGeom.translate(0, -0.5, 0);

  const leftLeg = new THREE.Mesh(legGeom, darkMat);
  leftLeg.position.set(-0.25, -0.5, 0);
  leftLeg.rotation.set(0.1, 0, -0.1);
  parentMesh.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeom, darkMat);
  rightLeg.position.set(0.25, -0.5, 0);
  rightLeg.rotation.set(-0.05, 0, 0.1);
  parentMesh.add(rightLeg);

  return parentMesh;
}

export const PlayerPreview: React.FC<PlayerPreviewProps> = ({ skin, teamColor = 0x0055ff }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    // Position camera to look at the character
    camera.position.set(0, 0, 5.5);
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

    // Character
    const character = createCharacterMesh(teamColor);
    
    // Add Gun
    const gun = createGunMesh(skin);
    gun.position.set(0.15, 0.2, -0.9);
    character.add(gun);

    // Center character
    const box = new THREE.Box3().setFromObject(character);
    const center = box.getCenter(new THREE.Vector3());
    character.position.set(-center.x, -center.y, -center.z);
    
    // Slight rotation to look better in lobby (character faces -Z by default, so add PI to face +Z)
    character.rotation.y = Math.PI + Math.PI / 8;

    scene.add(character);

    let animationFrameId: number;
    let time = 0;
    
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      time += 0.02;
      
      // Gentle breathing animation
      character.position.y = -center.y + Math.sin(time) * 0.05;
      
      renderer.render(scene, camera);
    };
    animate();

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
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [skin]);

  return <div ref={mountRef} className="w-[150px] h-[200px] pointer-events-none" />;
};
