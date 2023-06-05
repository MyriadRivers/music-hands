import * as Tone from 'tone';
import { useRef, useEffect } from 'react';
import {
  HandLandmarker,
  FilesetResolver,
  HandLandmarkerResult,
  NormalizedLandmark
} from '@mediapipe/tasks-vision'

import {
  drawConnectors,
  drawLandmarks
} from '@mediapipe/drawing_utils'

import {
  HAND_CONNECTIONS
} from '@mediapipe/hands'

import { getAngle, clamp, radToDeg } from './utils';

type Extensions = {
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  pinky: number;
}

function getExtensions(handmarks: NormalizedLandmark[]): Extensions {
  let angleThumbMCP = radToDeg(getAngle(handmarks[1], handmarks[2], handmarks[3]));
  let angleThumbIP = radToDeg(getAngle(handmarks[2], handmarks[3], handmarks[4]));

  let angleIndexMCP = radToDeg(getAngle(handmarks[0], handmarks[5], handmarks[6]));
  let angleIndexPIP = radToDeg(getAngle(handmarks[5], handmarks[6], handmarks[7]));
  let angleIndexDIP = radToDeg(getAngle(handmarks[6], handmarks[7], handmarks[8]));

  let angleMiddleMCP = radToDeg(getAngle(handmarks[0], handmarks[9], handmarks[10]));
  let angleMiddlePIP = radToDeg(getAngle(handmarks[9], handmarks[10], handmarks[11]));
  let angleMiddleDIP = radToDeg(getAngle(handmarks[10], handmarks[11], handmarks[12]));

  let angleRingMCP = radToDeg(getAngle(handmarks[0], handmarks[13], handmarks[14]));
  let angleRingPIP = radToDeg(getAngle(handmarks[13], handmarks[14], handmarks[15]));
  let angleRingDIP = radToDeg(getAngle(handmarks[14], handmarks[15], handmarks[16]));

  let anglePinkyMCP = radToDeg(getAngle(handmarks[0], handmarks[17], handmarks[18]));
  let anglePinkyPIP = radToDeg(getAngle(handmarks[17], handmarks[18], handmarks[19]));
  let anglePinkyDIP = radToDeg(getAngle(handmarks[18], handmarks[19], handmarks[20]));

  let thumb = clamp((angleThumbMCP + angleThumbIP) / (180 * 2), 0, 1);
  let index = clamp((angleIndexMCP + angleIndexPIP + angleIndexDIP) / (180 * 3), 0, 1);
  let middle = clamp((angleMiddleMCP + angleMiddlePIP + angleMiddleDIP) / (180 * 3), 0, 1);
  let ring = clamp((angleRingMCP + angleRingPIP + angleRingDIP) / (180 * 3), 0, 1);
  let pinky = clamp((anglePinkyMCP + anglePinkyPIP + anglePinkyDIP) / (180 * 3), 0, 1);

  return {
    thumb: thumb,
    index: index,
    middle: middle,
    ring: ring,
    pinky: pinky
  }
}

function App() {
  const landmarker = useRef<HandLandmarker | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const oscT = useRef<Tone.Oscillator | null>(null);
  const oscI = useRef<Tone.Oscillator | null>(null);
  const oscM = useRef<Tone.Oscillator | null>(null);
  const oscR = useRef<Tone.Oscillator | null>(null);
  const oscP = useRef<Tone.Oscillator | null>(null);

  const filterT = useRef<Tone.Filter | null>(null);
  const filterI = useRef<Tone.Filter | null>(null);
  const filterM = useRef<Tone.Filter | null>(null);
  const filterR = useRef<Tone.Filter | null>(null);
  const filterP = useRef<Tone.Filter | null>(null);

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
    oscT.current = new Tone.Oscillator("C4");
    oscI.current = new Tone.Oscillator("E4");
    oscM.current = new Tone.Oscillator("G4");
    oscR.current = new Tone.Oscillator("A#4");
    oscP.current = new Tone.Oscillator("D5");

    oscT.current.volume.value = -24;
    oscI.current.volume.value = -24;
    oscM.current.volume.value = -24;
    oscR.current.volume.value = -24;
    oscP.current.volume.value = -24;

    filterT.current = new Tone.Filter(0, "lowpass");
    filterI.current = new Tone.Filter(0, "lowpass");
    filterM.current = new Tone.Filter(0, "lowpass");
    filterR.current = new Tone.Filter(0, "lowpass");
    filterP.current = new Tone.Filter(0, "lowpass");

    oscT.current.connect(filterT.current);
    oscI.current.connect(filterI.current);
    oscM.current.connect(filterM.current);
    oscR.current.connect(filterR.current);
    oscP.current.connect(filterP.current);

    gain.current = new Tone.Gain(0);

    filterT.current.connect(gain.current);
    filterI.current.connect(gain.current);
    filterM.current.connect(gain.current);
    filterR.current.connect(gain.current);
    filterP.current.connect(gain.current);

    gain.current.toDestination();
    
    oscT.current.start();
    oscI.current.start();
    oscM.current.start();
    oscR.current.start();
    oscP.current.start();
  }

  const sonify = (results: HandLandmarkerResult) => {
    if (oscT.current && oscI.current && oscM.current && oscR.current && oscP.current && 
      filterT.current && filterI.current && filterM.current && filterR.current && filterP.current && 
      gain.current) {

      // Only make sounds if hands are detected

      if (results.handednesses.length > 0) {
        gain.current.gain.rampTo(1.0);
        // HANDEDNESS TEST

        // if (results.handednesses[0][0].categoryName === "Right") {
        //   osc.current.frequency.rampTo("C5", 0);
        // } else if (results.handednesses[0][0].categoryName === "Left") {
        //   osc.current.frequency.rampTo("C4", 0);
        // }

        // Extensions Test

        let firstExtensions = getExtensions(results.landmarks[0])

        console.log(firstExtensions);
        filterT.current.frequency.rampTo(2000 * firstExtensions.thumb, 0);
        filterI.current.frequency.rampTo(2000 * firstExtensions.index, 0);
        filterM.current.frequency.rampTo(2000 * firstExtensions.middle, 0);
        filterR.current.frequency.rampTo(2000 * firstExtensions.ring, 0);
        filterP.current.frequency.rampTo(2000 * firstExtensions.pinky, 0);

        oscT.current.frequency.rampTo(1400 * firstExtensions.thumb, 0);
        oscI.current.frequency.rampTo(1200 * firstExtensions.index, 0);
        oscM.current.frequency.rampTo(1000 * firstExtensions.middle, 0);
        oscR.current.frequency.rampTo(800 * firstExtensions.ring, 0);
        oscP.current.frequency.rampTo(600 * firstExtensions.pinky, 0);

        //TODO: Have some variables store the minimum and maximum extension perceived for each finger
        // Move my hand in all ways possible
        // Then clamp the extensions and scale them to those min and max, normalizing values to 0 and 1
        // to make them easier to deal with

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
                color: "#86cecb",
                lineWidth: 5
              });
              drawLandmarks(canvasCtx, landmarks, { color: "#d12f4e", lineWidth: 2 });
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
    </div>
  );
}

export default App;
