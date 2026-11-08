import { useEffect, useRef } from "react";
import * as THREE from "three";

export type HeroSceneTheme = "light" | "dark";

/**
 * Ambient 3D scene for the marketing hero: a slow "data globe" made of
 * particles, a faint wireframe shell, orbital rings and drifting satellites.
 *
 * The scene is transparent and uses theme-aware ink/paper colors, so it sits
 * directly on the page background with no glow, halo or vignette. It pauses
 * when off-screen or when the tab is hidden, and renders a single static frame
 * for reduced motion.
 */
export default function HeroScene({
  className,
  theme = "light",
}: {
  className?: string;
  theme?: HeroSceneTheme;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const dark = theme === "dark";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      return; // no WebGL — the CSS fallback ring keeps the layout intact
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 7.4);

    const globe = new THREE.Group();
    scene.add(globe);

    /* ---------- round point sprite (white; tinted per-vertex / per-material) ---------- */
    const dotCanvas = document.createElement("canvas");
    dotCanvas.width = dotCanvas.height = 64;
    const dotCtx = dotCanvas.getContext("2d");
    if (dotCtx) {
      const g = dotCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.45, "rgba(255,255,255,0.85)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      dotCtx.fillStyle = g;
      dotCtx.fillRect(0, 0, 64, 64);
    }
    const dotTexture = new THREE.CanvasTexture(dotCanvas);

    /* ---------- palette ---------- */
    const ink = new THREE.Color(dark ? "#f4f4f5" : "#18181b");
    const accent = new THREE.Color(dark ? "#93c5fd" : "#3b82f6");
    const faint = new THREE.Color(dark ? "#8b8b95" : "#9ca3af");

    /* ---------- particle shell (fibonacci sphere) ---------- */
    const isSmall = window.innerWidth < 720;
    const count = isSmall ? 950 : 1900;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const radius = 2.18;
    const golden = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      const jitter = 1 + (Math.random() - 0.5) * 0.02;

      positions[i * 3] = Math.cos(theta) * ring * radius * jitter;
      positions[i * 3 + 1] = y * radius * jitter;
      positions[i * 3 + 2] = Math.sin(theta) * ring * radius * jitter;

      const isAccent = Math.random() < 0.08;
      const tint = isAccent ? accent : ink;
      const strength = isAccent ? 1 : dark ? 0.55 + Math.random() * 0.4 : 0.45 + Math.random() * 0.5;
      colors[i * 3] = tint.r * strength;
      colors[i * 3 + 1] = tint.g * strength;
      colors[i * 3 + 2] = tint.b * strength;
    }

    const shellGeo = new THREE.BufferGeometry();
    shellGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    shellGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const shellMat = new THREE.PointsMaterial({
      size: 0.055,
      map: dotTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });
    const shell = new THREE.Points(shellGeo, shellMat);
    globe.add(shell);

    /* ---------- faint wireframe shell ---------- */
    const wireGeo = new THREE.WireframeGeometry(new THREE.SphereGeometry(2.09, 22, 14));
    const wireMat = new THREE.LineBasicMaterial({
      color: dark ? 0x9ca3af : 0x9ca3af,
      transparent: true,
      opacity: dark ? 0.14 : 0.16,
      depthWrite: false,
    });
    const wire = new THREE.LineSegments(wireGeo, wireMat);
    globe.add(wire);

    /* ---------- orbital rings + satellites ---------- */
    const ringGroup = new THREE.Group();
    globe.add(ringGroup);
    const pivots: THREE.Group[] = [];
    const ringSpecs: Array<{ radius: number; rot: [number, number, number]; speed: number }> = [
      { radius: 2.55, rot: [1.24, 0.18, 0.1], speed: 0.42 },
      { radius: 2.92, rot: [0.62, 0.9, -0.24], speed: -0.3 },
      { radius: 3.32, rot: [-0.9, 0.2, 0.5], speed: 0.22 },
    ];

    ringSpecs.forEach((spec, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(spec.radius, 0.0045, 3, 220),
        new THREE.MeshBasicMaterial({
          color: index === 1 ? accent.getHex() : faint.getHex(),
          transparent: true,
          opacity: (index === 0 ? 0.5 : 0.34) * (dark ? 1.1 : 1),
        })
      );
      ring.rotation.set(...spec.rot);
      ringGroup.add(ring);

      const pivot = new THREE.Group();
      pivot.rotation.set(...spec.rot);
      ringGroup.add(pivot);

      const satellite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: dotTexture,
          color: index === 1 ? accent.getHex() : ink.getHex(),
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          blending: THREE.NormalBlending,
        })
      );
      const size = index === 0 ? 0.24 : 0.16;
      satellite.scale.set(size, size, 1);
      satellite.position.x = spec.radius;
      pivot.add(satellite);
      pivots.push(pivot);
    });

    /* ---------- outer dust ---------- */
    const dustCount = isSmall ? 260 : 460;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const r = 3.4 + Math.random() * 2.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      dustPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      dustPos[i * 3 + 1] = r * Math.cos(phi);
      dustPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        size: 0.035,
        map: dotTexture,
        color: faint.getHex(),
        transparent: true,
        opacity: dark ? 0.5 : 0.36,
        depthWrite: false,
        blending: THREE.NormalBlending,
        sizeAttenuation: true,
      })
    );
    globe.add(dust);

    /* ---------- sizing ---------- */
    const resize = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (reduceMotion) renderer.render(scene, camera);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    /* ---------- interaction ---------- */
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let scrollY = window.scrollY;

    const onPointerMove = (event: PointerEvent) => {
      const nx = (event.clientX / window.innerWidth) * 2 - 1;
      const ny = (event.clientY / window.innerHeight) * 2 - 1;
      pointer.tx = Math.max(-1, Math.min(1, nx));
      pointer.ty = Math.max(-1, Math.min(1, ny));
    };
    const onScroll = () => {
      scrollY = window.scrollY;
    };

    let raf = 0;
    let visible = true;
    const timer = new THREE.Timer();

    const frame = (timestamp?: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;

      timer.update(timestamp);
      const delta = Math.min(timer.getDelta(), 0.05);
      const t = timer.getElapsed();

      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;

      globe.rotation.y += delta * 0.11;
      globe.rotation.x = Math.sin(t * 0.16) * 0.05 + pointer.y * 0.16;
      globe.rotation.z = Math.sin(t * 0.1) * 0.02;
      globe.position.y = Math.sin(t * 0.45) * 0.05 - Math.min(scrollY, 900) * 0.0007;

      pivots.forEach((pivot, index) => {
        pivot.rotation.z += delta * ringSpecs[index].speed;
      });

      camera.position.x = pointer.x * 0.32;
      camera.position.y = -pointer.y * 0.22;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0 }
    );
    intersection.observe(host);

    if (reduceMotion) {
      renderer.render(scene, camera);
    } else {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      raf = requestAnimationFrame(frame);
    }

    /* ---------- teardown ---------- */
    return () => {
      cancelAnimationFrame(raf);
      intersection.disconnect();
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      timer.dispose();

      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (!material) return;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      });

      dotTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [theme]);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
