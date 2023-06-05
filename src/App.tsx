import * as Tone from 'tone';
import { useRef, useEffect } from 'react';
import {
  HandLandmarker,
  FilesetResolver,
  HandLandmarkerResult
} from '@mediapipe/tasks-vision'

import {
  drawConnectors,
  drawLandmarks
} from '@mediapipe/drawing_utils'

import {
  HAND_CONNECTIONS
} from '@mediapipe/hands'

import { Vector, getAngle, radToDeg } from './utils';

function App() {
  const landmarker = useRef<HandLandmarker | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const osc = useRef<Tone.Oscillator | null>(null);
  const gain = useRef<Tone.Gain | null>(null);

  useEffect(() => {
    async function initialize() {
      await createLandmarker()
      await startWebCam();
      initSound();
    }
    initialize();
  }, []);
  
  const createLandmarker = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    landmarker.current = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 2
    });
  }

  const initSound = () => {
    osc.current = new Tone.Oscillator();
    gain.current = new Tone.Gain(0);

    osc.current.connect(gain.current);

    gain.current.toDestination();
    osc.current.start();
  }

  const sonify = (results: HandLandmarkerResult) => {
    if (osc.current && gain.current) {

      // Only make sounds if hands are detected

      if (results.handednesses.length > 0) {
        gain.current.gain.rampTo(1.0);
        // HANDEDNESS TEST

        // if (results.handednesses[0][0].categoryName === "Right") {
        //   osc.current.frequency.rampTo("C5", 0);
        // } else if (results.handednesses[0][0].categoryName === "Left") {
        //   osc.current.frequency.rampTo("C4", 0);
        // }

        // ANGLES TEST

        // Get the landmarks for the first hand detected, marks 5 - 9 (index finger)
        let index = results.landmarks[0].slice(5, 9);
        let k1 = new Vector(index[0].x, index[0].y, index[0].z);
        let k2 = new Vector(index[1].x, index[1].y, index[1].z);
        let k3 = new Vector(index[2].x, index[2].y, index[2].z);

        let angle = radToDeg(getAngle(k1, k2, k3));
        console.log(angle);

        if (angle > 135) {
          osc.current.frequency.rampTo("E5", 0);
        } else if (angle <= 135) {
          osc.current.frequency.rampTo("E4", 0);
        }

      } else {
        gain.current.gain.rampTo(0.0);
      }
    }
  }
  
  const startWebCam = async () => {
    // Check if webcam access is supported.
    const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

    // If webcam supported, add event listener to button for when user
    // wants to activate it.
    if (hasGetUserMedia()) {
      // set up webcam and hand landmarker
      if (!landmarker) {
        console.log("The hand landmarker is still loading...")
        return;
      }

      const constraints = {
        video: true,
        audio: false
      };

      const mediaDevices = navigator.mediaDevices;
      const stream = await mediaDevices.getUserMedia(constraints);
      if (video.current) {
        video.current.srcObject = stream;
        video.current.play()
        video.current.addEventListener("loadedmetadata", predictWebcam);
      }
    } else {
      console.warn("getUserMedia() is not supported by your browser");
    }

    let lastVideoTime = -1;
    let results: HandLandmarkerResult;

    async function predictWebcam() {
      
      let startTimeMs = performance.now();
      if (video.current && landmarker.current && canvas.current) {
        if (lastVideoTime !== video.current.currentTime) {
          lastVideoTime = video.current.currentTime;
          results = landmarker.current.detectForVideo(video.current, startTimeMs)
          
          sonify(results);

        }
        canvas.current.width = video.current.videoWidth;
        canvas.current.height = video.current.videoHeight;

        let canvasCtx = canvas.current.getContext("2d");

        if (canvasCtx) {
          canvasCtx.save();
          canvasCtx.clearRect(0, 0, canvas.current.width, canvas.current.height);

          if (results.landmarks) {
            for (const landmarks of results.landmarks) {
              drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                color: "#00FF00",
                lineWidth: 5
              });
              drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });
            }
          }
          canvasCtx.restore();
        }
      }
      
      window.requestAnimationFrame(predictWebcam);
    }
  }

  return (
    <div className="App">
      <div id="liveView" style={{width: 500, height: 400, position: "relative"}}>
        <video id="video" ref={video} style={{position: "absolute"}}></video>
        <canvas id="output_canvas" ref={canvas} style={{position: "absolute", left: "0px", top: "0px"}}></canvas>
      </div>
      <br/>
      <br/>
      <br/>
      <br/>
      <br/>
      <br/>
      <button onClick={() => {console.log("click!")}} >catch these hands</button>
    </div>
  );
}

export default App;
