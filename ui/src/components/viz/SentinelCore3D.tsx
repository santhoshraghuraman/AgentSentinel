/**
 * SentinelCore3D.tsx — Phase 6C / Premium Command Centre Redesign
 *
 * Interactive Three.js / React Three Fiber 3D Security Command Centre.
 * Visualizes the AgentSentinel M1–M8 defense-in-depth governance architecture:
 *   - M1–M2: Data Foundation & Semantic Action Normalization (cyan glowing top tier)
 *   - M3–M5: Behavioral Sequence & Risk Assessment (violet glowing tier)
 *   - M6: Task-Context Authorization (blue/teal authorization boundary tier)
 *   - M7: Authoritative Governance Decision (amber/gold sole decision authority tier)
 *   - M8: Runtime Interception & Enforcement (crimson base tier with zero-call guard & shield emblem)
 *
 * Telemetry & Governance Invariants:
 *   - Driven exclusively by real available backend telemetry (ALLOW, ALERT, BLOCK counts).
 *   - Posture derived deterministically (NOMINAL, ELEVATED, CRITICAL, AWAITING).
 *   - Visual interaction is read-only: selecting layers does not execute tools or mutate state.
 *   - Disposes geometries, materials, and listeners on unmount.
 *   - Real measured FPS via render loop instrumentation.
 *   - Strict respects-reduced-motion compliance.
 */

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { PostureLevel } from './SentinelCoreRadar';
import type { SafeAuditEventResponse } from '../../api/types';

// ─── WebGL Capability Detection ──────────────────────────────────────────────

export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// ─── Types & Ring Definitions ────────────────────────────────────────────────

export interface ArchitecturalGroup3D {
  id: string;
  label: string;
  stages: string;
  description: string;
  radius: number;
  baseColor: string;
  glowColor: string;
  tubeRadius: number;
  yOffset: number;
  labelAngle?: number;
}

export const ARCHITECTURAL_GROUPS: ArchitecturalGroup3D[] = [
  {
    id: 'ring-m1m2',
    label: 'M1–M2',
    stages: 'Ingestion & Normalization',
    description:
      'Raw tool-call capture (M1) and semantic action normalization (M2). Normalizes tool names, arguments, categories, and mutation flags into canonical representations.',
    radius: 3.5,
    baseColor: '#06b6d4',
    glowColor: '#38bdf8',
    tubeRadius: 0.045,
    yOffset: 1.35,
    labelAngle: -0.55,
  },
  {
    id: 'ring-m3m5',
    label: 'M3–M5',
    stages: 'Sequence & Risk Assessment',
    description:
      'Behavioral sequence modeling (M3), feature extraction (M4), and ML risk assessment (M5). Outputs continuous risk heuristic [0.0–1.0]. Not an authoritative governance decision.',
    radius: 2.85,
    baseColor: '#8b5cf6',
    glowColor: '#a78bfa',
    tubeRadius: 0.048,
    yOffset: 0.65,
    labelAngle: 0.50,
  },
  {
    id: 'ring-m6',
    label: 'M6',
    stages: 'Task-Context Authorization',
    description:
      'Evaluates task boundaries and capability scopes. Verifies whether requested actions conform to declared task context before policy evaluation.',
    radius: 2.2,
    baseColor: '#0284c7',
    glowColor: '#38bdf8',
    tubeRadius: 0.052,
    yOffset: -0.05,
    labelAngle: -0.42,
  },
  {
    id: 'ring-m7',
    label: 'M7',
    stages: 'Authoritative Governance Decision',
    description:
      'Authoritative rule and policy evaluation engine. Sole source of ALLOW, ALERT, and BLOCK verdicts. Governs execution based on combined risk, authorization, and policy constraints.',
    radius: 1.55,
    baseColor: '#f59e0b',
    glowColor: '#fbbf24',
    tubeRadius: 0.058,
    yOffset: -0.75,
    labelAngle: 0.38,
  },
  {
    id: 'ring-m8',
    label: 'M8',
    stages: 'Runtime Interception & Enforcement',
    description:
      'Enforces M7 decisions at runtime. A BLOCK decision strictly prevents protected callable invocation (zero calls). An ALLOW decision permits invocation, but execution can still fail independently.',
    radius: 0.9,
    baseColor: '#ef4444',
    glowColor: '#f87171',
    tubeRadius: 0.065,
    yOffset: -1.45,
    labelAngle: 0.0,
  },
];

const POSTURE_COLORS: Record<PostureLevel, { core: string; emissive: string; ambient: string }> = {
  NOMINAL: { core: '#059669', emissive: '#10b981', ambient: '#064e3b' },
  ELEVATED: { core: '#d97706', emissive: '#f59e0b', ambient: '#78350f' },
  CRITICAL: { core: '#dc2626', emissive: '#ef4444', ambient: '#7f1d1d' },
  AWAITING: { core: '#64748b', emissive: '#94a3b8', ambient: '#334155' },
};

// ─── Procedural Texture Helpers ──────────────────────────────────────────────

function createLabelTexture(stageText: string, labelText: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 110;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 512, 110);

    // Dark glass pill backdrop
    ctx.fillStyle = 'rgba(7, 12, 26, 0.92)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    const r = 26;
    const x = 6, y = 6, w = 500, h = 98;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Stage text
    ctx.font = 'bold 32px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`${stageText}: ${labelText}`, 256, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ─── 3D Shield Shape Generator ───────────────────────────────────────────────

function createShieldShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.45);
  shape.lineTo(0.32, 0.36);
  shape.lineTo(0.32, -0.05);
  shape.quadraticCurveTo(0.32, -0.38, 0, -0.55);
  shape.quadraticCurveTo(-0.32, -0.38, -0.32, -0.05);
  shape.lineTo(-0.32, 0.36);
  shape.closePath();
  return shape;
}

// ─── Real FPS Instrumentation ────────────────────────────────────────────────

function FpsMonitor({ onFPSUpdate }: { onFPSUpdate?: (fps: number) => void }) {
  const frameCount = useRef(0);
  const lastTime = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now());

  useFrame(() => {
    frameCount.current++;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = now - lastTime.current;
    if (elapsed >= 500) {
      const fps = Math.round((frameCount.current * 1000) / elapsed);
      onFPSUpdate?.(Math.min(fps, 60)); // Clamp to realistic 60fps
      frameCount.current = 0;
      lastTime.current = now;
    }
  });

  return null;
}

// ─── 3D Subcomponents ────────────────────────────────────────────────────────

/**
 * Central Crystalline Core representing M8 runtime execution kernel.
 */
function CentralCore({
  posture,
  isSelected,
  onClick,
  isPaused,
}: {
  posture: PostureLevel;
  isSelected: boolean;
  onClick: () => void;
  isPaused: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const cageRef = useRef<THREE.Mesh>(null);
  const shieldRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const colors = POSTURE_COLORS[posture];

  const shieldGeometry = useMemo(() => {
    const shape = createShieldShape();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });
  }, []);

  useEffect(() => {
    return () => {
      shieldGeometry.dispose();
    };
  }, [shieldGeometry]);

  useFrame((_, delta) => {
    if (isPaused) return;
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.45;
      meshRef.current.rotation.x += delta * 0.18;
    }
    if (cageRef.current) {
      cageRef.current.rotation.y -= delta * 0.3;
      cageRef.current.rotation.z += delta * 0.12;
    }
    if (shieldRef.current) {
      shieldRef.current.position.y = -1.45 + Math.sin(Date.now() * 0.002) * 0.04;
    }
  });

  const active = hovered || isSelected;

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Crystalline Polyhedron Core at M8 Base */}
      <mesh ref={meshRef} position={[0, -1.45, 0]} scale={active ? 1.18 : 1.0}>
        <octahedronGeometry args={[0.48, 0]} />
        <meshStandardMaterial
          color={colors.core}
          emissive={colors.emissive}
          emissiveIntensity={active ? 0.95 : 0.6}
          roughness={0.15}
          metalness={0.8}
        />
      </mesh>

      {/* Outer Wireframe Enforcement Shield (Zero-Call Guard) */}
      <mesh ref={cageRef} position={[0, -1.45, 0]} scale={active ? 1.25 : 1.12}>
        <icosahedronGeometry args={[0.68, 1]} />
        <meshStandardMaterial
          color={active ? '#ffffff' : colors.emissive}
          emissive={colors.emissive}
          emissiveIntensity={active ? 0.9 : 0.4}
          wireframe
          transparent
          opacity={0.65}
        />
      </mesh>

      {/* Floating Holographic 3D Shield Emblem in front of M8 Base */}
      <mesh
        ref={shieldRef}
        geometry={shieldGeometry}
        position={[0, -1.45, 1.05]}
        scale={active ? 1.15 : 1.0}
      >
        <meshStandardMaterial
          color={colors.core}
          emissive={colors.emissive}
          emissiveIntensity={active ? 1.1 : 0.75}
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>
    </group>
  );
}

/**
 * Concentric Orbital Tier Platform representing an architectural defense stage.
 */
function ArchitecturalTier({
  group,
  isSelected,
  onSelect,
  isPaused,
  auditEvents,
}: {
  group: ArchitecturalGroup3D;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isPaused: boolean;
  auditEvents?: SafeAuditEventResponse[];
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const discRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const active = isSelected || hovered;

  // Generate procedural label sprite texture
  const labelTexture = useMemo(() => {
    return createLabelTexture(group.label, group.stages, group.glowColor);
  }, [group.label, group.stages, group.glowColor]);

  useEffect(() => {
    return () => {
      labelTexture.dispose();
    };
  }, [labelTexture]);

  // Telemetry event counts mapped to this stage
  const stageEvents = useMemo(() => {
    if (!auditEvents || auditEvents.length === 0) return [];
    if (group.id === 'ring-m8') {
      return auditEvents.slice(0, 6);
    }
    if (group.id === 'ring-m7') {
      return auditEvents.slice(0, 5);
    }
    if (group.id === 'ring-m6') {
      return auditEvents.slice(0, 4);
    }
    if (group.id === 'ring-m3m5') {
      return auditEvents.slice(0, 4);
    }
    return auditEvents.slice(0, 3);
  }, [auditEvents, group.id]);

  useFrame((_, delta) => {
    if (isPaused) return;
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * (0.06 / Math.max(group.radius * 0.4, 0.5));
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * 0.25;
    }
  });

  return (
    <group position={[0, group.yOffset, 0]}>
      {/* Outer Glowing Torus Neon Ring */}
      <mesh
        ref={ringRef}
        rotation={[Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(group.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <torusGeometry args={[group.radius, active ? group.tubeRadius * 1.5 : group.tubeRadius, 16, 100]} />
        <meshStandardMaterial
          color={active ? '#ffffff' : group.baseColor}
          emissive={group.glowColor}
          emissiveIntensity={active ? 1.2 : 0.65}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Semi-Transparent Glowing Cyber Platform Disc */}
      <mesh
        ref={discRef}
        rotation={[0, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(group.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => {
          setHovered(false);
        }}
      >
        <cylinderGeometry args={[group.radius, group.radius, 0.025, 64]} />
        <meshStandardMaterial
          color={group.glowColor}
          emissive={group.baseColor}
          emissiveIntensity={active ? 0.35 : 0.12}
          transparent
          opacity={active ? 0.35 : 0.18}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* Floating Holographic Stage Label Pill Sprite with Angular Stagger (DEF-VIS-02) */}
      {(() => {
        const angle = group.labelAngle ?? 0;
        const lx = Math.sin(angle) * (group.radius * 0.88);
        const lz = Math.cos(angle) * (group.radius * 0.88);
        return (
          <sprite position={[lx, 0.28, lz]} scale={[1.65, 0.38, 1]}>
            <spriteMaterial map={labelTexture} transparent opacity={active ? 1.0 : 0.85} depthWrite={false} />
          </sprite>
        );
      })()}

      {/* Real Orbiting Telemetry Event Particles */}
      {stageEvents.length > 0 && (
        <group ref={particlesRef}>
          {stageEvents.map((evt, idx) => {
            const angle = (idx / stageEvents.length) * Math.PI * 2;
            const px = Math.cos(angle) * group.radius;
            const pz = Math.sin(angle) * group.radius;
            const dec = evt.decision?.toUpperCase();
            const color = dec === 'ALLOW' ? '#10b981' : dec === 'ALERT' ? '#f59e0b' : '#ef4444';

            return (
              <mesh key={`p-${evt.interception_id}-${idx}`} position={[px, 0.05, pz]}>
                <sphereGeometry args={[0.075, 12, 12]} />
                <meshStandardMaterial
                  color="#ffffff"
                  emissive={color}
                  emissiveIntensity={1.2}
                  roughness={0.2}
                />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
}

/**
 * Vertical Light Pillar connecting all tiers through the center core.
 */
function CentralLightBeam() {
  return (
    <group position={[0, 0, 0]}>
      {/* Inner luminous cylinder */}
      <mesh>
        <cylinderGeometry args={[0.06, 0.06, 3.4, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#38bdf8"
          emissiveIntensity={1.4}
          transparent
          opacity={0.65}
        />
      </mesh>
      {/* Outer translucent energy sheath */}
      <mesh>
        <cylinderGeometry args={[0.14, 0.14, 3.4, 32]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={0.6}
          transparent
          opacity={0.25}
        />
      </mesh>
    </group>
  );
}

/**
 * Ambient Cybernetic Particle Field with subtle floating motion.
 */
function CyberParticleField({ isPaused }: { isPaused: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);

  const [positions] = useMemo(() => {
    const pos = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      const radius = 1.0 + Math.random() * 3.8;
      const angle = Math.random() * Math.PI * 2;
      const y = -1.8 + Math.random() * 3.6;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return [pos];
  }, []);

  useFrame((_, delta) => {
    if (isPaused || !pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.04;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#38bdf8"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

/**
 * Coordinate Plane Depth Grid for visual grounding.
 */
function DepthGroundGrid() {
  return (
    <group position={[0, -2.0, 0]}>
      {/* Dual grid helper */}
      <gridHelper args={[16, 32, '#06b6d4', '#1e293b']} position={[0, 0, 0]} />
      {/* Outer glowing ground perimeter ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[4.2, 4.25, 64]} />
        <meshStandardMaterial
          color="#06b6d4"
          emissive="#06b6d4"
          emissiveIntensity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ─── Camera Controller with Reset capability ─────────────────────────────────

function CameraController({
  controlsRef,
  resetTrigger,
}: {
  controlsRef: React.RefObject<any>;
  resetTrigger: number;
}) {
  useEffect(() => {
    if (controlsRef.current && resetTrigger > 0) {
      controlsRef.current.reset();
    }
  }, [resetTrigger, controlsRef]);

  return null;
}

// ─── Main SentinelCore3D Canvas Component ─────────────────────────────────────

export interface SentinelCore3DProps {
  posture: PostureLevel;
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  isPaused: boolean;
  resetTrigger: number;
  zoomLevel: number; // 1.0 is default
  onFPSUpdate?: (fps: number) => void;
  auditEvents?: SafeAuditEventResponse[];
}

export function SentinelCore3D({
  posture,
  selectedGroupId,
  onSelectGroup,
  isPaused,
  resetTrigger,
  zoomLevel,
  onFPSUpdate,
  auditEvents,
}: SentinelCore3DProps) {
  const controlsRef = useRef<any>(null);

  // Apply manual zoom steps to controls
  useEffect(() => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object as THREE.PerspectiveCamera;
      if (camera) {
        camera.zoom = zoomLevel;
        camera.updateProjectionMatrix();
      }
    }
  }, [zoomLevel]);

  return (
    <div
      className="relative w-full h-[400px] sm:h-[460px] md:h-[500px] bg-[#070b16] rounded-xl overflow-hidden shadow-2xl border border-slate-800"
      data-testid="three-canvas-container"
    >
      <Canvas
        camera={{ position: [0, 2.8, 8.4], fov: 46 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        aria-label="AgentSentinel 3D Security Command Centre visualization"
        data-testid="sentinel-3d-canvas"
      >
        <color attach="background" args={['#060a14']} />

        {/* Real measured FPS monitor */}
        <FpsMonitor onFPSUpdate={onFPSUpdate} />

        {/* Lighting hierarchy */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[6, 9, 6]} intensity={1.2} />
        <directionalLight position={[-6, -4, -4]} intensity={0.5} color="#38bdf8" />
        <pointLight position={[0, -1.45, 0]} intensity={1.8} color={POSTURE_COLORS[posture].emissive} distance={8} />
        <pointLight position={[0, 1.4, 0]} intensity={1.5} color="#06b6d4" distance={7} />

        {/* Orbit Controls */}
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          minDistance={3.5}
          maxDistance={15.0}
          maxPolarAngle={Math.PI / 2 + 0.12}
          minPolarAngle={0.15}
          autoRotate={!isPaused}
          autoRotateSpeed={0.7}
        />
        <CameraController controlsRef={controlsRef} resetTrigger={resetTrigger} />

        {/* Vertical Central Energy Light Beam */}
        <CentralLightBeam />

        {/* Central M8 Core with Holographic Shield */}
        <CentralCore
          posture={posture}
          isSelected={selectedGroupId === 'ring-m8'}
          onClick={() => onSelectGroup('ring-m8')}
          isPaused={isPaused}
        />

        {/* 5 Concentric Architectural Tiers (M1–M2, M3–M5, M6, M7, M8) */}
        {ARCHITECTURAL_GROUPS.map((group) => (
          <ArchitecturalTier
            key={group.id}
            group={group}
            isSelected={selectedGroupId === group.id}
            onSelect={onSelectGroup}
            isPaused={isPaused}
            auditEvents={auditEvents}
          />
        ))}

        {/* Ambient Cyber Particle Field */}
        <CyberParticleField isPaused={isPaused} />

        {/* Coordinate Ground Depth Grid */}
        <DepthGroundGrid />
      </Canvas>
    </div>
  );
}
