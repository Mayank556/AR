import React, { useEffect, useRef, useState } from 'react';
import './index.css';
import DrawingSystem from './utils/DrawingSystem';
import TrackingSystem from './utils/TrackingSystem';
import ARVRSystem from './utils/ARVRSystem';

function App() {
  const [currentMode, setCurrentMode] = useState("draw");
  const [color, setColor] = useState("#007aff");
  const [size, setSize] = useState(8);
  const [theme, setTheme] = useState("dark");
  const [isFrontCam, setIsFrontCam] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [vrBgMode, setVrBgMode] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(true);

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
  
  // MediaRecorder for video
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  useEffect(() => {
    // Inject Theme
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    // 1. Initialize Drawing System
    if (drawingCanvasRef.current && !drawingSystemRef.current) {
      drawingSystemRef.current = new DrawingSystem(drawingCanvasRef.current);
    }
    
    // 2. Initialize AR/VR System
    if (threeCanvasRef.current && bgCanvasRef.current && !arvrSystemRef.current) {
        try {
            arvrSystemRef.current = new ARVRSystem(threeCanvasRef.current, bgCanvasRef.current);
        } catch(e) {
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
          if (arvrSystemRef.current && arvrSystemRef.current.isVRBgMode) {
              await arvrSystemRef.current.segmentation.send({ image: vElem });
          }
        } catch (e) {
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

  // Watch for color/size change and update drawing system parameters
  useEffect(() => {
      if (drawingSystemRef.current) {
          drawingSystemRef.current.startParams(color, size);
      }
  }, [color, size]);

  // Handle stream from camera
  const startCam = () => {
    if (window.camStream) window.camStream.getTracks().forEach(t => t.stop());
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: isFrontCam ? "user" : "environment", width: 1280, height: 720 }
    }).then(stream => {
      window.camStream = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current.play();
      }
    }).catch(e => console.error("Camera error:", e));
  };

  useEffect(() => {
    startCam();
  }, [isFrontCam]);

  const isDrawingRef = useRef(false);
  const isErasingRef = useRef(false);

  // Main logic loop returning data from tracking.js
  const handleGestureData = (data) => {
    const drawing = drawingSystemRef.current;
    const arvr = arvrSystemRef.current;
    const cursorCtx = cursorCanvasRef.current?.getContext("2d");
    const videoCtx = videoCanvasRef.current?.getContext("2d");
    
    // Safety check
    if (!drawing || !cursorCtx || !videoCtx) return;

    // 1. Draw video background
    if (data.rawResults.image && (!arvr || !arvr.isVRBgMode)) {
      videoCanvasRef.current.width = window.innerWidth;
      videoCanvasRef.current.height = window.innerHeight;
      videoCtx.drawImage(data.rawResults.image, 0, 0, window.innerWidth, window.innerHeight);
      setIsLoadingAI(false); // Hide indicator
    } else if (data.rawResults.image && arvr && arvr.isVRBgMode) {
      videoCtx.clearRect(0, 0, window.innerWidth, window.innerHeight); 
    }

    // 2. Cursor Overlay
    cursorCanvasRef.current.width = window.innerWidth;
    cursorCanvasRef.current.height = window.innerHeight;
    cursorCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Current State Refs grabber for closure
    const mode = document.getElementById("hidden-mode").value;
    const currColor = document.getElementById("hidden-color").value;
    const currSize = parseInt(document.getElementById("hidden-size").value);

    if (data.x !== null) {
      cursorCtx.beginPath();
      cursorCtx.arc(data.x, data.y, currSize / 2, 0, Math.PI * 2);
      if (data.gesture === "erase") { 
          cursorCtx.strokeStyle = "white"; 
          cursorCtx.lineWidth = 2; cursorCtx.stroke(); 
          cursorCtx.fillStyle = "rgba(0,0,0,0.5)"; 
      } else { 
          cursorCtx.fillStyle = mode === "pointer" ? "#8e8e93" : currColor; 
      }
      cursorCtx.fill();
    }

    // 3. Handle Drawing Logic
    if (mode === "pointer") {
      drawing.endStroke(); isDrawingRef.current = false; isErasingRef.current = false; return;
    }

    if (data.gesture === "draw") {
      if (!isDrawingRef.current) { 
          drawing.startStroke(data.x, data.y, false); 
          isDrawingRef.current = true; isErasingRef.current = false; 
      } else { 
          drawing.continueStroke(data.x, data.y); 
      }
      drawing.renderAll();
    } else if (data.gesture === "erase") {
      if (!isErasingRef.current) { 
          drawing.startStroke(data.x, data.y, true); 
          isErasingRef.current = true; isDrawingRef.current = false; 
      } else { 
          drawing.continueStroke(data.x, data.y); 
      }
      drawing.renderAll();
    } else {
      if (isDrawingRef.current || isErasingRef.current) { 
          drawing.endStroke(); 
          isDrawingRef.current = false; isErasingRef.current = false; 
      }
    }

    if (data.gesture === "clear") { 
        drawing.clear(); drawing.renderAll(); 
        if (arvr) arvr.clear3D(); 
    }
  };

  // UI Handlers
  const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");
  const toggleMirror = () => { setIsFrontCam(prev => !prev); };
  const getMirroredClass = () => (isFrontCam ? "mirrored" : "");

  const handleUndo = () => { drawingSystemRef.current?.undo(); drawingSystemRef.current?.renderAll(); };
  const handleRedo = () => { drawingSystemRef.current?.redo(); drawingSystemRef.current?.renderAll(); };
  const handleClear = () => { drawingSystemRef.current?.clear(); drawingSystemRef.current?.renderAll(); arvrSystemRef.current?.clear3D(); };

  const convert3D = () => {
      if (arvrSystemRef.current && drawingSystemRef.current) {
          arvrSystemRef.current.convertStrokesTo3D(drawingSystemRef.current.strokes);
          handleClear(); // Clear 2d board 
      }
  };

  const toggleVRBg = () => {
      if(arvrSystemRef.current) {
          const active = arvrSystemRef.current.toggleVRBackground();
          setVrBgMode(active);
      }
  }

  const scanPaper = () => {
      if(arvrSystemRef.current && videoCanvasRef.current && drawingSystemRef.current) {
          const ctx = videoCanvasRef.current.getContext("2d");
          arvrSystemRef.current.scanPaperCurrentVideo(ctx, drawingSystemRef.current);
      }
  }

  const saveImage = () => {
    const comp = document.createElement("canvas");
    comp.width = window.innerWidth; comp.height = window.innerHeight;
    const cCtx = comp.getContext("2d");
    
    if (isFrontCam) { cCtx.translate(comp.width, 0); cCtx.scale(-1, 1); }
    cCtx.drawImage(videoCanvasRef.current, 0, 0); 
    cCtx.drawImage(drawingCanvasRef.current, 0, 0); 
    
    const link = document.createElement("a");
    link.download = `ARPaint-${Date.now()}.png`;
    link.href = comp.toDataURL("image/png");
    link.click();
  };

  const toggleRecord = () => {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state === "recording") {
          mr.stop();
          setIsRecording(false);
      } else {
          const stream = drawingCanvasRef.current.captureStream(30);
          const newMR = new MediaRecorder(stream, { mimeType: 'video/webm' });
          
          newMR.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
          newMR.onstop = () => {
              const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `ARPaint-${Date.now()}.webm`;
              a.click(); URL.revokeObjectURL(url);
              recordedChunksRef.current = [];
          };
          newMR.start();
          mediaRecorderRef.current = newMR;
          setIsRecording(true);
      }
  };

  return (
    <>
      <video ref={videoRef} id="video-input" autoPlay playsInline style={{display: 'none'}}></video>
      <canvas ref={bgCanvasRef} id="bg-canvas" style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1}}></canvas>
      
      {/* Hidden inputs to pass state to the tracking closure cleanly */}
      <input type="hidden" id="hidden-mode" value={currentMode} />
      <input type="hidden" id="hidden-color" value={color} />
      <input type="hidden" id="hidden-size" value={size} />

      <div id="workspace" ref={workspaceRef} className={getMirroredClass()}>
          <canvas ref={videoCanvasRef} id="video-output"></canvas>
          <canvas ref={drawingCanvasRef} id="drawing-canvas"></canvas>
          <canvas ref={cursorCanvasRef} id="cursor-canvas"></canvas>
          <canvas ref={threeCanvasRef} id="three-canvas" style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none'}}></canvas>
      </div>

      <div id="ui-container">
          <div className="top-bar">
              <div id="status-indicator" style={{ display: isLoadingAI ? "flex" : "none" }}>
                  <i className="fa-solid fa-spinner fa-spin"></i> Loading AI...
              </div>
              <div className="controls-right">
                  <button className="icon-btn" title="Theme" onClick={toggleTheme}><i className="fa-solid fa-moon"></i></button>
                  <button className={`icon-btn ${isFrontCam ? "active" : ""}`} title="Mirror" onClick={toggleMirror}><i className="fa-solid fa-arrows-left-right"></i></button>
                  <button className="icon-btn" title="Camera" onClick={toggleMirror}><i className="fa-solid fa-camera-rotate"></i></button>
              </div>
          </div>

          <div className="gesture-guide hidden-mobile">
              <div>✌️ Draw (Index Up)</div>
              <div>✌️ Erase (Index & Middle Up)</div>
              <div>✊ Stop (Fist)</div>
              <div>🖐️ Clear (Hold Hand Open 1s)</div>
          </div>

          <div className="floating-toolbar" style={{maxHeight: "80vh", overflowY: "auto"}}>
              <div className="tool-group">
                  <button className={`tool-btn ${currentMode === "draw" ? "active" : ""}`} onClick={() => setCurrentMode("draw")} title="Draw Mode"><i className="fa-solid fa-pen"></i></button>
                  <button className={`tool-btn ${currentMode === "pointer" ? "active" : ""}`} onClick={() => setCurrentMode("pointer")} title="Pointer Mode"><i className="fa-solid fa-arrow-pointer"></i></button>
              </div>
              <div className="divider"></div>
              <div className="tool-group flex-row">
                  <input type="color" id="color-picker" value={color} onChange={(e) => setColor(e.target.value)} title="Choose Color" />
                  <div className="slider-container">
                      <input type="range" id="size-slider" min="2" max="50" value={size} onChange={(e) => setSize(parseInt(e.target.value))} title="Brush Size" />
                  </div>
              </div>
              <div className="divider"></div>
              <div className="tool-group">
                  <button className={`tool-btn ${vrBgMode ? 'active' : ''}`} style={{color: "#a270ff"}} onClick={toggleVRBg} title="360 VR Background Remove"><i className="fa-solid fa-user-astronaut"></i></button>
                  <button className="tool-btn" style={{color: "#ff9f0a"}} onClick={convert3D} title="Convert to 3D AR"><i className="fa-solid fa-cube"></i></button>
                  <button className="tool-btn" style={{color: "#32d74b"}} onClick={scanPaper} title="Scan Paper Drawing"><i className="fa-solid fa-print"></i></button>
              </div>
              <div className="divider"></div>
              <div className="tool-group">
                  <button className="tool-btn" onClick={handleUndo} title="Undo"><i className="fa-solid fa-rotate-left"></i></button>
                  <button className="tool-btn" onClick={handleRedo} title="Redo"><i className="fa-solid fa-rotate-right"></i></button>
                  <button className="tool-btn text-danger" onClick={handleClear} title="Clear Canvas"><i className="fa-solid fa-trash"></i></button>
              </div>
              <div className="divider"></div>
              <div className="tool-group">
                  <button className="tool-btn" onClick={saveImage} title="Save Image"><i className="fa-solid fa-download"></i></button>
                  <button className={`tool-btn ${isRecording ? "recording" : ""}`} onClick={toggleRecord} title="Record"><i className="fa-solid fa-video"></i></button>
              </div>
          </div>
      </div>
    </>
  );
}

export default App;
