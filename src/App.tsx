import { Viewer } from '@pascal-app/viewer';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { bootstrap, loadSceneFromUrl } from './scene';

const SCENES = [
  { id: 'empty-studio', label: '单身公寓 40㎡', target: [0, 1, 0], position: [11, 9, 11] },
  { id: 'two-bedroom', label: '两居 80㎡', target: [0, 1, 0], position: [12, 10, 12] },
  { id: 'garden-house', label: '带院平房', target: [0, 1, 0], position: [14, 11, 14] },
  { id: 'demo-3br', label: '生成:三室两厅', target: [4.8, 1.2, 3.9], position: [15, 11, 16] },
  { id: 'extracted', label: '识别:模板户型图', target: [4.8, 1.2, 4.5], position: [16, 12, 18] },
  { id: 'your-house-warm', label: '★ 奶油暖木', target: [4.4, 1.0, 8.8], position: [9.7, 1.65, 6.3] },
  { id: 'your-house-grey', label: '现代灰调', target: [4.4, 1.0, 8.8], position: [9.7, 1.65, 6.3] },
  { id: 'your-house-dark', label: '深色雅奢', target: [4.4, 1.0, 8.8], position: [9.7, 1.65, 6.3] },
];

const params = new URLSearchParams(location.search);
const numList = (raw: string | null) => {
  const parts = raw?.split(',').map(Number);
  return parts && parts.length === 3 && parts.every(Number.isFinite) ? parts : null;
};
const paramScene = params.get('scene');
const embedded = params.has('scene');
const paramPos = numList(params.get('pos'));
const paramTarget = numList(params.get('target'));

function CameraPose({ position }: { position: number[] }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.position.set(position[0], position[1], position[2]);
  }, [camera, position]);
  return null;
}

export default function App() {
  const [pluginsLoaded, setPluginsLoaded] = useState(false);
  const [activeId, setActiveId] = useState(paramScene ?? 'your-house-warm');
  const [status, setStatus] = useState('加载插件');
  const scene = SCENES.find((entry) => entry.id === activeId) ?? SCENES[SCENES.length - 1];
  const position = paramPos ?? scene.position;
  const target = paramTarget ?? scene.target;

  useEffect(() => {
    bootstrap().then(() => setPluginsLoaded(true));
  }, []);

  useEffect(() => {
    if (!pluginsLoaded) return;
    let cancelled = false;
    loadSceneFromUrl(`${import.meta.env.BASE_URL}scenes/${activeId}.json`)
      .then((count) => {
        if (!cancelled) setStatus(`${count} 个节点`);
      })
      .catch((error) => {
        if (!cancelled) setStatus(String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, pluginsLoaded]);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {pluginsLoaded ? (
        <Viewer
          sceneReadyKey={activeId}
          onSceneReadyChange={(ready) => {
            if (ready) (window as unknown as Record<string, unknown>).__sceneReady = true;
            setStatus((s) => (ready ? `${s} · 已渲染` : s));
          }}
        >
          <CameraPose position={position} />
          <OrbitControls makeDefault target={target} />
        </Viewer>
      ) : null}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
        }}
      >
        {!embedded && SCENES.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setActiveId(entry.id)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.2)',
              background: entry.id === activeId ? '#2d6cf6' : 'rgba(20,20,26,0.7)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {entry.label}
          </button>
        ))}
        {embedded && (
          <a
            href={`${import.meta.env.BASE_URL}design.html`}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(20,20,26,0.7)',
              color: '#fff',
              textDecoration: 'none',
            }}
          >
            ← 方案页
          </a>
        )}
        <span style={{ color: 'rgba(255,255,255,0.75)' }}>{status}</span>
      </div>
    </div>
  );
}
