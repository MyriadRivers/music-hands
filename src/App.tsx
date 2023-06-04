import * as Tone from 'tone';
import { useRef, useState, useEffect } from 'react';
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

function App() {
  const landmarker = useRef<HandLandmarker | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const [activeHands, setActiveHands] = useState<HandLandmarkerResult>();
  const [hasRight, setHasRight] = useState(false);
  const [hasLeft, setHasLeft] = useState(false);

  useEffect(() => {
    async function initialize() {
      await createLandmarker()
      await startWebCam();
    }
    initialize();
  }, []);

  // const makeSound = (handedness) => {
  //   const synth = new Tone.Synth().toDestination();
  //   const note = handedness === "Right" ? "C4" : "G4";
  //   synth.triggerAttackRelease(note, "8n");
  // }
  
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
  
  // const catchHands = async () => {
  //   if (video.current && detector.current) {
  //     const hands = await detector.current.estimateHands(video.current);
  //     console.log(hands);
  //     // Play a different note depending on whether it's a right or a left hand
  //     makeSound(hands[0].handedness)
  //     return hands;
  //   }
  // }
  
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
          
          // Test continuous sonification
          if (results.handednesses.length > 0) {
            if (results.handednesses[0][0].categoryName === "Right") {
              setHasRight(true);
            } else {
              setHasRight(false);
            }
            if (results.handednesses[0][0].categoryName === "Left") {
              setHasLeft(true);
            } else {
              setHasLeft(false);
            }
          } else {
            setHasRight(false);
            setHasLeft(false);
          }
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

  // const trackHands = async () => {
  //   if (video.current && activeHands) {
  //     if (activeHands.handednesses.length >= 1) {
  //       let hasRight = false;
  //       let hasLeft = false;
  //       activeHands.handednesses.forEach(hand => {
  //         hasRight = hand[0].categoryName === "Right";
  //       });
  //     }
  //   }
  // }

  const startSound = () => {
    const synth = new Tone.Synth().toDestination();
    if (hasRight) synth.triggerAttackRelease("C4", "8n");
    if (hasLeft) synth.triggerAttackRelease("G4", "8n");
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
      <button onClick={startSound} >catch these hands</button>
    </div>
  );
}

export default App;
