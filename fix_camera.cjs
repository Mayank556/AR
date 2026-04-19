const fs = require('fs');
let code = fs.readFileSync('c:/Users/rahul/OneDrive/Desktop/my-ar-app/src/App.jsx', 'utf8');

const startIdx = code.indexOf('const startCam = () => {');
const endIdx = code.indexOf('  useEffect(() => {', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = const startCam = async () => {
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
        console.warn("Camera failed with facingMode, retrying fallback...", e);
        try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
            window.camStream = fallbackStream;
            if (videoRef.current) {
                videoRef.current.srcObject = fallbackStream;
                videoRef.current.onloadedmetadata = () => videoRef.current.play();
            }
        } catch (err) {
            console.error("Camera fully failed:", err);
            // alert("Camera access denied or no camera found. Please allow camera permissions in your browser.");
        }
    }
  };\n\n;

    code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
    
    code = code.replace('<video ref={videoRef} id="video-input" autoPlay playsInline style={{ display: \'none\' }}></video>', '<video ref={videoRef} id="video-input" autoPlay playsInline muted style={{ display: \'none\' }}></video>');
    code = code.replace('<video ref={videoRef} id="video-input" autoPlay playsInline style={{display: \'none\'}}></video>', '<video ref={videoRef} id="video-input" autoPlay playsInline muted style={{ display: \'none\' }}></video>');
    
    fs.writeFileSync('c:/Users/rahul/OneDrive/Desktop/my-ar-app/src/App.jsx', code, 'utf8');
}
