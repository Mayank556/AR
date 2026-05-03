import React, { useEffect, useRef, useState } from 'react';
import './index.css';
import DrawingSystem from './utils/DrawingSystem';
import TrackingSystem from './utils/TrackingSystem';
import ARVRSystem from './utils/ARVRSystem';
import { saveStrokes, loadStrokes, listSessions } from './utils/apiService';

const DRAWING_TOOLS = [
  { label: 'Pen', value: 'pen' },
  { label: 'Line', value: 'line' },
  { label: 'Rectangle', value: 'rectangle' },
  { label: 'Circle', value: 'circle' },
  { label: 'Triangle', value: 'triangle' },
  { label: 'Diamond', value: 'diamond' },
  { label: 'Hexagon', value: 'hexagon' },
  { label: 'Star', value: 'star' },
  { label: 'Heart', value: 'heart' }
];

const BRUSH_STYLES = [
  { label: '3D Bead', value: 'bead' },
  { label: 'Solid Line', value: 'line' },
  { label: 'Neon Line', value: 'neon' },
  { label: 'Square', value: 'square' }
];

const COLOR_SWATCHES = [
  '#8b5a2b', '#ef4444', '#f59e0b', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'
];

const MATERIAL_PRESETS = [
  { label: 'Matte', value: 'matte' },
  { label: 'Gloss', value: 'gloss' },
  { label: 'Metal', value: 'metal' },
  { label: 'Glass', value: 'glass' }
];

const SHAPE_3D_OPTIONS = [
  { label: 'Cube', value: 'box' },
  { label: 'Sphere', value: 'sphere' },
  { label: 'Cylinder', value: 'cylinder' },
  { label: 'Cone', value: 'cone' },
  { label: 'Torus', value: 'torus' },
  { label: 'Torus Knot', value: 'torusknot' },
  { label: 'Prism', value: 'prism' },
  { label: 'Pyramid', value: 'pyramid' },
  { label: 'Capsule', value: 'capsule' },
  { label: 'Gem', value: 'gem' },
  { label: 'Heart', value: 'heart' },
  { label: 'Cloud', value: 'cloud' },
  { label: 'House', value: 'house' },
  { label: 'Tree', value: 'tree' },
  { label: 'Human', value: 'human' },
  { label: 'Rocket', value: 'rocket' },
  { label: 'Bus', value: 'bus' },
  { label: 'Boat', value: 'boat' },
  { label: 'Chair', value: 'chair' },
  { label: 'Table', value: 'table' },
  { label: 'Dodecahedron', value: 'dodecahedron' },
  { label: 'Icosahedron', value: 'icosahedron' },
  { label: 'Octahedron', value: 'octahedron' },
  { label: 'Flower', value: 'flower' },
  { label: 'Star', value: 'star' },
  { label: 'Shield', value: 'shield' },
  { label: 'Arrow', value: 'arrow' },
  { label: 'Leaf', value: 'leaf' },
  { label: 'Moon', value: 'moon' },
  { label: 'Sun', value: 'sun' },
  { label: 'Arch', value: 'arch' },
  { label: 'Wave', value: 'wave' },
  { label: 'Cross', value: 'cross' },
  { label: 'Building', value: 'building' },
  { label: 'Skyscraper', value: 'skyscraper' },
  { label: 'Shop', value: 'shop' },
  { label: 'Streetlamp', value: 'streetlamp' },
  { label: 'Fountain', value: 'fountain' },
  { label: 'Bridge', value: 'bridge' },
  { label: 'Tower', value: 'tower' },
  { label: 'Wall', value: 'wall' },
  { label: 'Door', value: 'door' },
  { label: 'Window', value: 'window' },
  { label: 'Stairs', value: 'stairs' },
  { label: 'Fence', value: 'fence' }
];

function App() {
  const [isDrawingMode, setIsDrawingMode] = useState(true);
  const [is3DMode, setIs3DMode] = useState(false);
  const [isToggled, setIsToggled] = useState(false);
  const [isFrontCam, setIsFrontCam] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('');
  const [sessions, setSessions] = useState([]);
  const [showCloud, setShowCloud] = useState(false);
  const [brushColor, setBrushColor] = useState('#8b5a2b');
  const [brushSize, setBrushSize] = useState(12);
  const [brushStyle, setBrushStyle] = useState('bead');
  const [drawingTool, setDrawingTool] = useState('pen');
  const [selected3DShape, setSelected3DShape] = useState('box');
  const [materialStyle, setMaterialStyle] = useState('gloss');
  const [showPropertyPanel, setShowPropertyPanel] = useState(false);
  const [selectedObjectProps, setSelectedObjectProps] = useState({ height: 1, width: 1, depth: 1, color: '#ffffff', opacity: 1 });

  // Refs for Canvases
  const videoRef = useRef(null);
  const bgCanvasRef = useRef(null);
  const videoCanvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const cursorCanvasRef = useRef(null);
  const threeCanvasRef = useRef(null);
  const workspaceRef = useRef(null);

  // Controllers
  const drawingSystemRef = useRef(null);
  const trackingSystemRef = useRef(null);
  const arvrSystemRef = useRef(null);

  useEffect(() => {
    // 1. Initialize Drawing System
      if (drawingCanvasRef.current && !drawingSystemRef.current) {
        drawingSystemRef.current = new DrawingSystem(drawingCanvasRef.current);
      }

    // 2. Initialize AR/VR System
    if (threeCanvasRef.current && bgCanvasRef.current && !arvrSystemRef.current) {
      try {
        arvrSystemRef.current = new ARVRSystem(threeCanvasRef.current, bgCanvasRef.current);
      } catch (e) {
        console.warn("Failed to init ARVR", e);
      }
    }

    // 3. Initialize Tracking System
    if (!trackingSystemRef.current) {
      trackingSystemRef.current = new TrackingSystem((data) => {
        handleGestureData(data);
      });
    }

    // 4. Start Camera Loop
    const tick = async () => {
      const vElem = videoRef.current;
      if (vElem && vElem.readyState >= 2 && trackingSystemRef.current) {
        try {
          await trackingSystemRef.current.hands.send({ image: vElem });
        } catch {
          // Drop frames silently
        }
      }
      requestAnimationFrame(tick);
    };
    tick();

    // Cleanup
    return () => {
      if (arvrSystemRef.current) arvrSystemRef.current.stop();
      if (window.camStream) window.camStream.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
    drawingSystemRef.current?.startParams(brushColor, brushSize, brushStyle, drawingTool);
  }, [brushColor, brushSize, brushStyle, drawingTool]);

  useEffect(() => {
    const startCam = async () => {
      if (window.camStream) window.camStream.getTracks().forEach(t => t.stop());
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: isFrontCam ? "user" : "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        window.camStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => videoRef.current.play();
        }
      } catch (e) {
        console.warn("Retrying without facingMode... ", e);
        try {
          const fallback = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
          window.camStream = fallback;
          if (videoRef.current) {
            videoRef.current.srcObject = fallback;
            videoRef.current.onloadedmetadata = () => videoRef.current.play();
          }
        } catch (err) {
          console.error("Camera error:", err);
          alert("Camera access denied or device has no camera.");
        }
      }
    };

    startCam();
  }, [isFrontCam]);

  const isDrawingRef = useRef(false);

  // Main logic loop returning data from tracking.js
  const handleGestureData = (data) => {
    const drawing = drawingSystemRef.current;
    const arvr = arvrSystemRef.current;
    const cursorCtx = cursorCanvasRef.current?.getContext("2d");
    const videoCtx = videoCanvasRef.current?.getContext("2d");

    // Safety check
    if (!drawing || !cursorCtx || !videoCtx) return;

    // 1. Draw video background always full screen
    if (data.rawResults.image && videoCanvasRef.current) {
      videoCanvasRef.current.width = window.innerWidth;
      videoCanvasRef.current.height = window.innerHeight;
      videoCtx.drawImage(data.rawResults.image, 0, 0, window.innerWidth, window.innerHeight);
    }

    // 2. Cursor Overlay
    cursorCanvasRef.current.width = window.innerWidth;
    cursorCanvasRef.current.height = window.innerHeight;
    cursorCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Current State Refs grabber for closure
    const mode = document.getElementById("hidden-draw").value === "true";
    const mode3D = document.getElementById("hidden-3d").value === "true";

    // Render targeting box (like in image)
    if (!mode3D && data.x !== null) {
      cursorCtx.beginPath();
      cursorCtx.rect(data.x - 40, data.y - 40, 80, 80);
      cursorCtx.strokeStyle = "yellow";
      cursorCtx.lineWidth = 2;
      cursorCtx.stroke();
    }

    // Red dot indicator
    if (data.x !== null) {
      cursorCtx.beginPath();
      cursorCtx.arc(data.x, data.y, 6, 0, Math.PI * 2);
      cursorCtx.fillStyle = mode ? "red" : "#8e8e93";
      cursorCtx.fill();
    }

    // 3. Handle Drawing Logic
    if (!mode) {
      drawing.endStroke(); isDrawingRef.current = false; return;
    }

    if (data.gesture === "two-hand" && data.twoHand) {
      if (mode3D && arvr) {
          arvr.handleTwoHand(data.twoHand.distance, data.twoHand.angle);
          return;
      }
      if (drawing && !mode3D) {
          const nextSize = Math.max(2, Math.min(80, Math.round(data.twoHand.distance / 6)));
          setBrushSize(nextSize);
          drawing.size = nextSize;
      }
      return;
    }

    if (data.gesture === "draw") {
      if (!isDrawingRef.current) {
        drawing.startStroke(data.x, data.y, false);
        isDrawingRef.current = true;
      } else {
        drawing.continueStroke(data.x, data.y);
      }
      drawing.renderAll();
    } else {
      if (isDrawingRef.current) {
        drawing.endStroke();
        isDrawingRef.current = false;
      }
    }
  };

  const handleClear = () => {
    drawingSystemRef.current?.clear();
    arvrSystemRef.current?.clear3D();
    setIs3DMode(false);
  };

  const toggle3D = () => {
    const next3D = !is3DMode;
    setIs3DMode(next3D);

    if (next3D && arvrSystemRef.current && drawingSystemRef.current) {
      arvrSystemRef.current.convertStrokesTo3D(drawingSystemRef.current.strokes);
      drawingCanvasRef.current.getContext("2d").clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
    } else if (!next3D && arvrSystemRef.current) {
      arvrSystemRef.current.clear3D();
      drawingSystemRef.current?.renderAll(); // bring back 2d
    }
  };

  const toggleSwitch = () => {
    setIsToggled(!isToggled);
    setIsFrontCam(!isFrontCam);
  };

  const handleSave = async () => {
    const strokes = drawingSystemRef.current?.strokes || [];
    if (strokes.length === 0) { setCloudStatus('Nothing to save.'); return; }
    try {
      setCloudStatus('Saving…');
      await saveStrokes(strokes);
      setCloudStatus(`✅ Saved ${strokes.length} stroke(s)`);
    } catch (e) {
      setCloudStatus(`❌ Save failed: ${e.message}`);
    }
  };

  const handleLoad = async () => {
    try {
      setCloudStatus('Loading…');
      const strokes = await loadStrokes();
      if (!strokes.length) { setCloudStatus('No saved drawing found.'); return; }
      if (drawingSystemRef.current) {
        drawingSystemRef.current.strokes = strokes;
        drawingSystemRef.current.renderAll();
      }
      setCloudStatus(`✅ Loaded ${strokes.length} stroke(s)`);
    } catch (e) {
      setCloudStatus(`❌ Load failed: ${e.message}`);
    }
  };

  const handleShowSessions = async () => {
    try {
      const list = await listSessions();
      setSessions(list);
      setShowCloud(s => !s);
    } catch (e) {
      setCloudStatus(`❌ ${e.message}`);
    }
  };

  const handleSessionClick = async (sessionName) => {
    try {
      const sk = await loadStrokes(sessionName);
      if (drawingSystemRef.current) {
        drawingSystemRef.current.strokes = sk;
        drawingSystemRef.current.renderAll();
      }
      setCloudStatus(`✅ Loaded "${sessionName}"`);
      setShowCloud(false);
    } catch (e) {
      setCloudStatus(`❌ Load failed: ${e.message}`);
    }
  };

  const handleAdd3DShape = () => {
    const shape = selected3DShape;
    const palette = {
      box: 0x2d9cdb,
      sphere: 0x7b61ff,
      cylinder: 0x22c55e,
      cone: 0xf59e0b,
      torus: 0xf97316,
      torusknot: 0xec4899,
      prism: 0x06b6d4,
      pyramid: 0xe11d48,
      capsule: 0x8b5cf6,
      gem: 0x38bdf8,
      heart: 0xfb7185,
      cloud: 0xe2e8f0,
      house: 0xf97316,
      tree: 0x16a34a,
      human: 0x60a5fa,
      rocket: 0xf43f5e,
      bus: 0xeab308,
      boat: 0x38bdf8,
      chair: 0x92400e,
      table: 0x78350f,
      dodecahedron: 0x8b5cf6,
      icosahedron: 0x14b8a6,
      octahedron: 0x3b82f6
    };

    arvrSystemRef.current?.addShape(shape, palette[shape] ?? 0xffffff, null, materialStyle);
  };

  const handleDuplicateSelectedShape = () => {
    const arvr = arvrSystemRef.current;
    const selected = arvr?.selectedObject;
    if (!arvr || !selected) return;
    const cloneType = selected.userData?.shapeType || 'box';
    const clone = arvr.addShape(cloneType, selected.userData?.colorHex ?? 0xffffff, {
      x: selected.position.x + 16,
      y: selected.position.y + 8,
      z: selected.position.z + 16
    });
    if (clone) arvr.focusObject(clone);
  };

  const handleReplaceSelectedShape = () => {
    const arvr = arvrSystemRef.current;
    if (!arvr?.selectedObject) return;
    arvr.replaceSelectedShape(selected3DShape, undefined, materialStyle);
  };

  const handleDeleteSelectedShape = () => {
    const arvr = arvrSystemRef.current;
    if (!arvr?.selectedObject) return;
    arvr.removeObject(arvr.selectedObject);
  };

  const handleUpdateHeight = (val) => {
    const newVal = parseFloat(val);
    setSelectedObjectProps((prev) => {
      const next = { ...prev, height: newVal };
      arvrSystemRef.current?.updateObjectScale(next.height, next.width, next.depth);
      return next;
    });
  };

  const handleUpdateWidth = (val) => {
    const newVal = parseFloat(val);
    setSelectedObjectProps((prev) => {
      const next = { ...prev, width: newVal };
      arvrSystemRef.current?.updateObjectScale(next.height, next.width, next.depth);
      return next;
    });
  };

  const handleUpdateDepth = (val) => {
    const newVal = parseFloat(val);
    setSelectedObjectProps((prev) => {
      const next = { ...prev, depth: newVal };
      arvrSystemRef.current?.updateObjectScale(next.height, next.width, next.depth);
      return next;
    });
  };

  const handleUpdateColor = (colorVal) => {
    const hex = parseInt(colorVal.replace('#', ''), 16);
    setSelectedObjectProps((prev) => ({ ...prev, color: colorVal }));
    arvrSystemRef.current?.updateObjectColor(hex);
  };

  const handleUpdateOpacity = (val) => {
    const newVal = parseFloat(val);
    setSelectedObjectProps((prev) => ({ ...prev, opacity: newVal }));
    arvrSystemRef.current?.updateObjectOpacity(newVal);
  };

  const handleOpenProperties = () => {
    const arvr = arvrSystemRef.current;
    if (arvr?.selectedObject) {
      const props = arvr.getSelectedObjectProperties();
      if (props) {
        setSelectedObjectProps(props);
        setShowPropertyPanel(true);
      }
    }
  };

  const handleAdd3DText = () => {
    const text = window.prompt('Enter text to place in 3D');
    if (!text) return;
    arvrSystemRef.current?.addTextObject(text, parseInt(brushColor.replace('#', ''), 16), null, materialStyle);
    setIs3DMode(true);
  };

  return (
    <>
      <video ref={videoRef} id="video-input" autoPlay playsInline muted style={{ display: 'none' }}></video>
      <canvas ref={bgCanvasRef} id="bg-canvas" style={{ display: "none" }}></canvas>

      {/* Hidden inputs to pass state to the tracking closure cleanly */}
      <input type="hidden" id="hidden-draw" value={isDrawingMode} />
      <input type="hidden" id="hidden-3d" value={is3DMode} />

      <div id="workspace" ref={workspaceRef} className={isFrontCam ? "mirrored" : ""}>
        <canvas ref={videoCanvasRef} id="video-output"></canvas>
        <canvas ref={drawingCanvasRef} id="drawing-canvas" style={{ display: is3DMode ? "none" : "block" }}></canvas>
        <canvas ref={cursorCanvasRef} id="cursor-canvas"></canvas>
        <canvas ref={threeCanvasRef} id="three-canvas" style={{ display: is3DMode ? "block" : "none", position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 6, pointerEvents: is3DMode ? 'auto' : 'none' }}></canvas>
      </div>

      <div id="transform-bar" style={{ display: is3DMode ? "flex" : "none", position: "absolute", top: "20px", left: "20px", zIndex: 10, gap: "10px" }}>
        <button className="action-btn" onClick={() => arvrSystemRef.current?.setTransformMode("translate")}>Move All Axes</button>
        <button className="action-btn" onClick={() => arvrSystemRef.current?.setTransformMode("rotate")}>Rotate 3D</button>
        <button className="action-btn" onClick={() => arvrSystemRef.current?.setTransformMode("scale")}>Scale Output</button>
        <button className="action-btn" onClick={handleDuplicateSelectedShape}>Duplicate Selected</button>
        <button className="action-btn" onClick={handleReplaceSelectedShape}>Replace Selected</button>
        <button className="action-btn" onClick={handleDeleteSelectedShape}>Delete Selected</button>
        <button className="action-btn" onClick={handleOpenProperties}>Properties</button>
      </div>
      {showPropertyPanel && (
        <div style={{ position: 'absolute', bottom: '260px', right: '20px', zIndex: 11, background: 'rgba(0,0,0,0.92)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', minWidth: '240px' }}>
          <div style={{ color: 'white', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Object Properties</div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ color: '#aaa', fontSize: '11px' }}>Height: {selectedObjectProps.height.toFixed(2)}x</label>
            <input type="range" min="0.1" max="4" step="0.1" value={selectedObjectProps.height} onChange={(e) => handleUpdateHeight(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ color: '#aaa', fontSize: '11px' }}>Width: {selectedObjectProps.width.toFixed(2)}x</label>
            <input type="range" min="0.1" max="4" step="0.1" value={selectedObjectProps.width} onChange={(e) => handleUpdateWidth(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ color: '#aaa', fontSize: '11px' }}>Depth: {selectedObjectProps.depth.toFixed(2)}x</label>
            <input type="range" min="0.1" max="4" step="0.1" value={selectedObjectProps.depth} onChange={(e) => handleUpdateDepth(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ color: '#aaa', fontSize: '11px' }}>Color</label>
            <input type="color" value={selectedObjectProps.color} onChange={(e) => handleUpdateColor(e.target.value)} style={{ width: '100%', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer' }} />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ color: '#aaa', fontSize: '11px' }}>Opacity: {(selectedObjectProps.opacity * 100).toFixed(0)}%</label>
            <input type="range" min="0" max="1" step="0.05" value={selectedObjectProps.opacity} onChange={(e) => handleUpdateOpacity(e.target.value)} style={{ width: '100%' }} />
          </div>
          <button className="action-btn" onClick={() => setShowPropertyPanel(false)} style={{ width: '100%', padding: '6px 10px', fontSize: '12px' }}>Close</button>
        </div>
      )}
      <div id="top-right" onClick={handleClear}>
        <i className="fa-solid fa-arrow-rotate-right"></i>
      </div>

      {/* Cloud Save/Load panel */}
      <div id="cloud-bar" style={{ position: 'absolute', top: '40px', right: '60px', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="action-btn cloud-btn" onClick={handleSave} title="Save to server">
            <i className="fa-solid fa-cloud-arrow-up" style={{ marginRight: '4px' }}></i>Save
          </button>
          <button className="action-btn cloud-btn" onClick={handleLoad} title="Load from server">
            <i className="fa-solid fa-cloud-arrow-down" style={{ marginRight: '4px' }}></i>Load
          </button>
          <button className="action-btn cloud-btn" onClick={handleShowSessions} title="Saved sessions">
            <i className="fa-solid fa-list" style={{ marginRight: '4px' }}></i>Sessions
          </button>
        </div>
        {cloudStatus && (
          <span style={{ color: 'white', fontSize: '12px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '6px' }}>{cloudStatus}</span>
        )}
        {showCloud && sessions.length > 0 && (
          <div style={{ background: 'rgba(0,0,0,0.8)', padding: '8px', borderRadius: '8px', color: 'white', fontSize: '12px' }}>
            {sessions.map((s) => (
              <div key={s} style={{ padding: '2px 0', cursor: 'pointer' }} onClick={() => handleSessionClick(s)}>📂 {s}</div>
            ))}
          </div>
        )}
      </div>
      <div id="drawing-tools" style={{ display: !is3DMode ? 'flex' : 'none', position: 'absolute', top: '80px', left: '20px', zIndex: 10, gap: '10px', flexDirection: 'column', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '10px' }}>
        <label style={{ color: 'white', fontSize: '12px' }}>Draw Tool</label>
        <select value={drawingTool} onChange={(e) => setDrawingTool(e.target.value)} style={{ padding: '5px', borderRadius: '5px' }}>
          {DRAWING_TOOLS.map((tool) => (
            <option key={tool.value} value={tool.value}>{tool.label}</option>
          ))}
        </select>
        <label style={{ color: 'white', fontSize: '12px' }}>Brush Style</label>
        <select value={brushStyle} onChange={(e) => setBrushStyle(e.target.value)} style={{ padding: '5px', borderRadius: '5px' }}>
          {BRUSH_STYLES.map((style) => (
            <option key={style.value} value={style.value}>{style.label}</option>
          ))}
        </select>
        <label style={{ color: 'white', fontSize: '12px' }}>Brush Color</label>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {COLOR_SWATCHES.map((color) => (
            <button
              key={color}
              onClick={() => setBrushColor(color)}
              title={color}
              style={{ width: '24px', height: '24px', borderRadius: '999px', border: color === brushColor ? '2px solid white' : '1px solid rgba(255,255,255,0.35)', background: color, cursor: 'pointer' }}
            />
          ))}
        </div>
        <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', cursor: 'pointer' }} />
        <label style={{ color: 'white', fontSize: '12px' }}>Brush Size: {brushSize}</label>
        <input type="range" min="2" max="80" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value, 10))} />
        <button className="action-btn" onClick={() => drawingSystemRef.current?.undo()} style={{ padding: '5px 10px', fontSize: '14px' }}>Undo Last</button>
      </div>
      <div id="bottom-bar">
      <div id="shape-bar" style={{ display: is3DMode ? 'flex' : 'none', position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, gap: '8px', flexWrap: 'wrap', width: '92%', justifyContent: 'center', alignItems: 'center' }}>
          <label style={{color:"white", fontSize:"12px"}}>3D Shape</label>
          <select value={selected3DShape} onChange={(e) => setSelected3DShape(e.target.value)} style={{padding:"5px", borderRadius:"5px"}}>
            {SHAPE_3D_OPTIONS.map((shape) => (
              <option key={shape.value} value={shape.value}>{shape.label}</option>
            ))}
          </select>
          <label style={{color:"white", fontSize:"12px"}}>Material</label>
          <select value={materialStyle} onChange={(e) => setMaterialStyle(e.target.value)} style={{padding:"5px", borderRadius:"5px"}}>
            {MATERIAL_PRESETS.map((material) => (
              <option key={material.value} value={material.value}>{material.label}</option>
            ))}
          </select>
          <button className="action-btn" onClick={handleAdd3DShape}>Add Shape</button>
          <button className="action-btn" onClick={() => arvrSystemRef.current?.setTransformMode("translate")}>Move</button>
          <button className="action-btn" onClick={() => arvrSystemRef.current?.setTransformMode("rotate")}>Rotate</button>
          <button className="action-btn" onClick={() => arvrSystemRef.current?.setTransformMode("scale")}>Scale</button>
          <button className="action-btn" onClick={handleDuplicateSelectedShape}>Replace / Copy</button>
            <span style={{ color: 'white', fontSize: '11px', opacity: 0.85 }}>Touch: drag to move, pinch to resize selected shape</span>
      </div>
        <button className={`action-btn ${isDrawingMode ? 'active' : ''}`} onClick={() => setIsDrawingMode(!isDrawingMode)}>
          <div className="shutter-icon"><div className="shutter-inner"></div></div>
          Draw
        </button>

        <button className={`action-btn ${is3DMode ? 'active' : ''}`} onClick={toggle3D}>
          <div className="shutter-icon"><div className="shutter-inner"></div></div>
          3D!
        </button>

        <button className="action-btn" onClick={() => arvrSystemRef.current?.convertStrokesTo3D(drawingSystemRef.current?.strokes || [])}>
          2D→3D
        </button>

        <button className="action-btn" onClick={handleAdd3DText}>
          Text→3D
        </button>

        <div className={`toggle-switch ${isToggled ? 'on' : ''}`} onClick={toggleSwitch}>
          <div className="toggle-knob"></div>
        </div>
      </div>
    </>
  );
}

export default App;

