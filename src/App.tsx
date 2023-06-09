import * as Tone from 'tone';
import { useRef, useEffect } from 'react';
import {
  GestureRecognizer,  
  FilesetResolver,
  NormalizedLandmark,
  GestureRecognizerResult
} from '@mediapipe/tasks-vision'

import {
  drawConnectors,
  drawLandmarks
} from '@mediapipe/drawing_utils'

import {
  HAND_CONNECTIONS
} from '@mediapipe/hands'

import { getAngle, scale, radToDeg } from './utils';

import kickSample from "./resources/kick.wav"

type Extensions = {
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  pinky: number;
}

enum Mode {
  Rhythm = "RHYTHM",
  Melody = "MELODY"
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

  // TODO: Replace scale min and max with detected min and max extension from user
  // Right now they use hard coded values aligned with my own testing
  let thumb = scale((angleThumbMCP + angleThumbIP) / (180 * 2), 0.65, 0.965, true);
  let index = scale((angleIndexMCP + angleIndexPIP + angleIndexDIP) / (180 * 3), 0.64, 0.975, true);
  let middle = scale((angleMiddleMCP + angleMiddlePIP + angleMiddleDIP) / (180 * 3), 0.55, 0.975, true);
  let ring = scale((angleRingMCP + angleRingPIP + angleRingDIP) / (180 * 3), 0.52, 0.975, true);
  let pinky = scale((anglePinkyMCP + anglePinkyPIP + anglePinkyDIP) / (180 * 3), 0.50, 0.975, true);

  return {
    thumb: thumb,
    index: index,
    middle: middle,
    ring: ring,
    pinky: pinky
  }
}

function App() {
  const gestureRec = useRef<GestureRecognizer | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const kick = useRef<Tone.Player | null>(null);
  const prevHands = useRef<GestureRecognizerResult | null>(null);

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

  const mode = useRef<Mode>(Mode.Melody);

  useEffect(() => {
    async function initialize() {
      await createGestureRecognizer();
      await startWebCam();
      initSound();

    }
    initialize();
  }, []);
  
  const createGestureRecognizer = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    gestureRec.current = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 2
    });
  }

  const initSound = () => {
    gain.current = new Tone.Gain(0);
    gain.current.toDestination();

    kick.current = new Tone.Player(kickSample);
    kick.current.connect(gain.current);

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

    filterT.current.connect(gain.current);
    filterI.current.connect(gain.current);
    filterM.current.connect(gain.current);
    filterR.current.connect(gain.current);
    filterP.current.connect(gain.current);
    
    oscT.current.start();
    oscI.current.start();
    oscM.current.start();
    oscR.current.start();
    oscP.current.start();
  }
  
  const startWebCam = async () => {
    // Check if webcam access is supported.
    const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

    // If webcam supported, add event listener to button for when user
    // wants to activate it.
    if (hasGetUserMedia()) {
      // set up webcam and gesture recognizer
      if (!gestureRec.current) {
        console.log("The model is still loading...")
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
    let results: GestureRecognizerResult;

    let minT = 0.7;
    let minI = 0.7;
    let minM = 0.7;
    let minR = 0.7;
    let minP = 0.7;

    let maxT = 0.7;
    let maxI = 0.7;
    let maxM = 0.7;
    let maxR = 0.7;
    let maxP = 0.7;

    async function predictWebcam() {
      let nowInMs = Date.now()
      if (video.current && gestureRec.current && canvas.current) {
        if (lastVideoTime !== video.current.currentTime) {
          lastVideoTime = video.current.currentTime;
          results = gestureRec.current.recognizeForVideo(video.current, nowInMs);

          const sonify = (results: GestureRecognizerResult) => {
            if (oscT.current && oscI.current && oscM.current && oscR.current && oscP.current && 
              filterT.current && filterI.current && filterM.current && filterR.current && filterP.current && 
              gain.current) {
        
              // Only make sounds if hands are detected
        
              if (results.gestures.length > 0) {
                gain.current.gain.rampTo(1.0);
                // Extensions Test
        
                let ext = getExtensions(results.landmarks[0])
        
                // filterT.current.frequency.rampTo(300 * ext.thumb, 0);
                // filterI.current.frequency.rampTo(350 * ext.index, 0);
                // filterM.current.frequency.rampTo(400 * ext.middle, 0);
                // filterR.current.frequency.rampTo(500 * ext.ring, 0);
                // filterP.current.frequency.rampTo(600 * ext.pinky, 0);
                
                minT = Math.min(ext.thumb, minT);
                minI = Math.min(ext.index, minI);
                minM = Math.min(ext.middle, minM);
                minR = Math.min(ext.ring, minR);
                minP = Math.min(ext.pinky, minP);
        
                maxT = Math.max(ext.thumb, maxT);
                maxI = Math.max(ext.index, maxI);
                maxM = Math.max(ext.middle, maxM);
                maxR = Math.max(ext.ring, maxR);
                maxP = Math.max(ext.pinky, maxP);
        
                // console.log(`minT: ${minT}\nminI: ${minI}\nminM: ${minM}\nminR: ${minR}\nminP: ${minP}\n`);
                // console.log(`maxT: ${maxT}\nmaxI: ${maxI}\nmaxM: ${maxM}\nmaxR: ${maxR}\nmaxP: ${maxP}\n`);

                
                // TODO: Clean up the null checks of kick, etc., 
                // and make it so the first hand that closes into a fist determines the kick, not the first detected

                if (results.gestures.length > 1) {
                  if (results.gestures[0][0].categoryName === "Open_Palm" 
                  && results.gestures[1][0].categoryName === "Open_Palm"
                  && mode.current !== Mode.Rhythm
                  && kick.current) {
                    mode.current = Mode.Rhythm;
                    prevHands.current = results;
                    kick.current.start();
                  }
                }

                // Basic gesture triggered kicks

                if (prevHands.current && kick.current) {
                  let prevHand1 = prevHands.current.gestures[0][0].categoryName;
                  let prevHand2 = prevHands.current.gestures[1][0].categoryName;

                  let currHand1 = results.gestures[0][0].categoryName;
                  let currHand2 = results.gestures[1][0].categoryName;

                  if (currHand1 !== prevHand1 && (currHand1 === "Open_Palm" || currHand1 === "Closed_Fist")) {
                    kick.current.start();
                    prevHands.current = results;
                  }
                }
        
        
        
                //TODO: Have some variables store the minimum and maximum extension perceived for each finger
                // Move my hand in all ways possible
                // Then clamp the extensions and scale them to those min and max, normalizing values to 0 and 1
                // to make them easier to deal with
        
              } else {
                gain.current.gain.rampTo(0.0);
              }
            }
          }

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
