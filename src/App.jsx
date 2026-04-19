import React, { useEffect, useRef, useState } from 'react';
import './index.css';
import DrawingSystem from './utils/DrawingSystem';
import TrackingSystem from './utils/TrackingSystem';
import ARVRSystem from './utils/ARVRSystem';

function App() {
  const [isDrawingMode, setIsDrawingMode] = useState(true);
  const [is3DMode, setIs3DMode] = useState(false);
  const [isToggled, setIsToggled] = useState(false); // Can be used for camera flip or vr bg
  const [isFrontCam, setIsFrontCam] = useState(false); // Using back camera for AR by default

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

  // Handle stream from camera
  const startCam = () => {
    if (window.camStream) window.camStream.getTracks().forEach(t => t.stop());
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: isFrontCam ? "user" : "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
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
      }
      return;
    }

    if (data.gesture === "two-hand" && data.twoHand) {
      if (mode3D && arvr) {
          arvr.handleTwoHand(data.twoHand.distance, data.twoHand.angle);
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
    setIsFrontCam(!isFrontCam); // Tie toggle to front/back cam flip like Snapchat/IG
  };

  return (
    <>
      <video ref={videoRef} id="video-input" autoPlay playsInline style={{ display: 'none' }}></video>
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
        <button className="action-btn" onClick={() => arvrSystemRef.current?.setTransformMode("translate")}>Move</button>
        <button className="action-btn" onClick={() => arvrSystemRef.current?.setTransformMode("rotate")}>Rotate</button>
        <button className="action-btn" onClick={() => arvrSystemRef.current?.setTransformMode("scale")}>Scale</button>
      </div>
      <div id="transform-bar" style={{ display: is3DMode ? "flex" : "none", position: "absolute", top: "20px", left: "20px", zIndex: 10, gap: "10px" }}>
        <button className="action-btn" onClick={() => arvrSystemRef.current?.setTransformMode("translate")}>Move</button>
        <button className="action-btn" onClick={() => arvrSystemRef.current?.setTransformMode("rotate")}>Rotate</button>
        <button className="action-btn" onClick={() => arvrSystemRef.current?.setTransformMode("scale")}>Scale</button>
      </div>
      <div id="top-right" onClick={handleClear}>
        <i className="fa-solid fa-arrow-rotate-right"></i>
      </div>

      <div id="bottom-bar">
      <div id="shape-bar" style={{ display: is3DMode ? 'flex' : 'none', position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, gap: '10px' }}>
          <button className="action-btn" onClick={() => arvrSystemRef.current?.addShape('house', 0xffbbaaa)}>House</button>
          <button className="action-btn" onClick={() => arvrSystemRef.current?.addShape('tree', 0x228B22)}>Tree</button>
          <button className="action-btn" onClick={() => arvrSystemRef.current?.addShape('vehicle', 0xcc2222)}>Car</button>
          <button className="action-btn" onClick={() => arvrSystemRef.current?.addShape('circle', 0x2222cc)}>Circle</button>
          <button className="action-btn" onClick={() => arvrSystemRef.current?.addShape('rectangle', 0xccaacc)}>Rect</button>
          <button className="action-btn" onClick={() => arvrSystemRef.current?.addShape('human', 0x4499ff)}>Human</button>
      </div>
        <button className={`action-btn ${isDrawingMode ? 'active' : ''}`} onClick={() => setIsDrawingMode(!isDrawingMode)}>
          <div className="shutter-icon"><div className="shutter-inner"></div></div>
          Draw
        </button>

        <button className={`action-btn ${is3DMode ? 'active' : ''}`} onClick={toggle3D}>
          <div className="shutter-icon"><div className="shutter-inner"></div></div>
          3D!
        </button>

        <div className={`toggle-switch ${isToggled ? 'on' : ''}`} onClick={toggleSwitch}>
          <div className="toggle-knob"></div>
        </div>
      </div>
    </>
  );
}

export default App;

